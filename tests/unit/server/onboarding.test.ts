import { beforeEach, describe, expect, it, vi } from "vitest";
import type { PrismaClient } from "@prisma/client";

const { redirect } = vi.hoisted(() => ({
  redirect: vi.fn(),
}));

vi.mock("next/navigation", () => ({ redirect }));

import {
  getPostAuthDestination,
  getOnboardingStatus,
  postAuthDestination,
  requireOnboardingComplete,
} from "@/server/onboarding";

interface State {
  connectionStatus?: "active" | "error" | "revoked";
  assessmentCompleted?: boolean;
  formatPrefs?: unknown;
  revealSeen?: boolean;
  programCount?: number;
}

function dbFor(state: State): PrismaClient {
  return {
    platformConnection: {
      count: vi.fn(async ({ where }: { where: Record<string, unknown> }) =>
        state.connectionStatus === "active" &&
        where.userId === "user-1" &&
        where.status === "active"
          ? 1
          : 0,
      ),
    },
    assessment: {
      findUnique: vi.fn(async ({ where }: { where: { userId: string } }) =>
        where.userId === "user-1" && state.assessmentCompleted
          ? { completedAt: new Date(0) }
          : null,
      ),
    },
    constraintSet: {
      findFirst: vi.fn(async ({ where }: { where: { userId: string } }) =>
        where.userId === "user-1" && state.formatPrefs !== undefined
          ? { formatPrefs: state.formatPrefs }
          : null,
      ),
    },
    user: {
      findUnique: vi.fn(async ({ where }: { where: { id: string } }) =>
        where.id === "user-1"
          ? {
              setupRevealSeenAt: state.revealSeen ? new Date(0) : null,
            }
          : null,
      ),
    },
    program: {
      count: vi.fn(async ({ where }: { where: { userId: string } }) =>
        where.userId === "user-1" ? (state.programCount ?? 0) : 0,
      ),
    },
  } as unknown as PrismaClient;
}

describe("onboarding completion", () => {
  beforeEach(() => redirect.mockClear());

  it.each(["error", "revoked"] as const)(
    "marks connections as incomplete for %s status while allowing training with valid constraints",
    async (connectionStatus) => {
      const status = await getOnboardingStatus(
        dbFor({
          connectionStatus,
          assessmentCompleted: true,
          formatPrefs: {
            formats: ["rapid"],
            preferredVariety: false,
            targetFocus: "online",
          },
        }),
        "user-1",
      );

      // Constraints is the single required step, so complete is true but next optional step is connections
      expect(status.complete).toBe(true);
      expect(status.nextStep?.href).toBe("/connections");
    },
  );

  it.each([
    ["missing", undefined],
    ["invalid", { formats: ["postal"] }],
    ["empty", { formats: [], preferredVariety: false, targetFocus: "online" }],
  ])("does not accept %s format preferences", async (_label, formatPrefs) => {
    const status = await getOnboardingStatus(
      dbFor({
        connectionStatus: "active",
        assessmentCompleted: true,
        formatPrefs,
      }),
      "user-1",
    );

    expect(status.complete).toBe(false);
    expect(status.nextStep?.href).toBe("/onboarding/constraints");
  });

  it("tracks completed assessment and preserves first-incomplete order", async () => {
    const status = await getOnboardingStatus(
      dbFor({
        connectionStatus: "active",
        assessmentCompleted: false,
        formatPrefs: {
          formats: ["rapid"],
          preferredVariety: false,
          targetFocus: "online",
        },
      }),
      "user-1",
    );

    // Step 0: constraints (true), Step 1: connections (true), Step 2: calibration (false), Step 3: reveal (false), Step 4: today (false)
    expect(status.steps.map((step) => step.done)).toEqual([
      true,
      true,
      false,
      false,
      false,
    ]);
    expect(status.nextStep?.href).toBe("/onboarding/calibration");
  });

  it("completes only for the requested tenant with all valid state", async () => {
    const db = dbFor({
      connectionStatus: "active",
      assessmentCompleted: true,
      formatPrefs: {
        formats: ["blitz"],
        preferredVariety: false,
        targetFocus: "online",
      },
    });

    await expect(getOnboardingStatus(db, "user-1")).resolves.toMatchObject({
      complete: true,
      nextStep: { href: "/onboarding/reveal" },
    });
    await expect(getOnboardingStatus(db, "user-2")).resolves.toMatchObject({
      complete: false,
    });
  });

  it("persists the reveal and first-session steps independently", async () => {
    const base = {
      connectionStatus: "active" as const,
      assessmentCompleted: true,
      formatPrefs: {
        formats: ["rapid"],
        preferredVariety: false,
        targetFocus: "online",
      },
    };

    const revealDone = await getOnboardingStatus(
      dbFor({ ...base, revealSeen: true }),
      "user-1",
    );
    expect(revealDone.steps.map((step) => step.done)).toEqual([
      true,
      true,
      true,
      true,
      false,
    ]);
    expect(revealDone.allComplete).toBe(false);

    const allDone = await getOnboardingStatus(
      dbFor({ ...base, revealSeen: true, programCount: 1 }),
      "user-1",
    );
    expect(allDone.steps.map((step) => step.done)).toEqual([
      true,
      true,
      true,
      true,
      true,
    ]);
    expect(allDone.allComplete).toBe(true);
    expect(allDone.nextStep).toBeNull();
  });

  it("uses one post-auth landing rule for incomplete and complete users", async () => {
    expect(postAuthDestination({ complete: false })).toBe("/onboarding");
    expect(postAuthDestination({ complete: true })).toBe("/today");

    await expect(getPostAuthDestination(dbFor({}), "user-1")).resolves.toBe(
      "/onboarding",
    );
    await expect(
      getPostAuthDestination(
        dbFor({
          connectionStatus: "active",
          assessmentCompleted: true,
          formatPrefs: {
            formats: ["rapid"],
            preferredVariety: false,
            targetFocus: "online",
          },
        }),
        "user-1",
      ),
    ).resolves.toBe("/today");
  });

  it("redirects incomplete users and permits complete users", async () => {
    await expect(
      requireOnboardingComplete(dbFor({}), "user-1"),
    ).resolves.toBeUndefined();
    expect(redirect).toHaveBeenCalledWith("/onboarding");

    await expect(
      requireOnboardingComplete(
        dbFor({
          connectionStatus: "active",
          assessmentCompleted: true,
          formatPrefs: {
            formats: ["rapid"],
            preferredVariety: false,
            targetFocus: "online",
          },
        }),
        "user-1",
      ),
    ).resolves.toBeUndefined();
  });
});
