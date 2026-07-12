import { beforeEach, describe, expect, it, vi } from "vitest";
import type { PrismaClient } from "@prisma/client";

const { redirect } = vi.hoisted(() => ({
  redirect: vi.fn(),
}));

vi.mock("next/navigation", () => ({ redirect }));

import {
  getOnboardingStatus,
  requireOnboardingComplete,
} from "@/server/onboarding";

interface State {
  connectionStatus?: "active" | "error" | "revoked";
  assessmentCompleted?: boolean;
  formatPrefs?: unknown;
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
  } as unknown as PrismaClient;
}

describe("onboarding completion", () => {
  beforeEach(() => redirect.mockClear());

  it.each(["error", "revoked"] as const)(
    "does not accept a %s connection",
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

      expect(status.complete).toBe(false);
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

  it("requires a completed assessment and preserves first-incomplete order", async () => {
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

    expect(status.steps.map((step) => step.done)).toEqual([true, false, true]);
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
      nextStep: null,
    });
    await expect(getOnboardingStatus(db, "user-2")).resolves.toMatchObject({
      complete: false,
    });
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
