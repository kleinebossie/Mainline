import { describe, expect, it, vi } from "vitest";

import type { ConstraintsInput } from "@/lib/constraints";
import {
  getCurrentConstraints,
  getTargetFocus,
  saveConstraints,
} from "@/server/constraints";
import { constraintsRouter } from "@/server/routers/constraints";

const validConstraints: ConstraintsInput = {
  minutesPerDay: 30,
  daysPerWeek: 4,
  goals: [{ kind: "rating", label: "Reach 1600" }],
  ownedResources: [{ kind: "book", label: "Silman Reassess" }],
  formatPrefs: {
    formats: ["rapid", "blitz"],
    preferredVariety: true,
    targetFocus: "otb",
  },
  sessionStyle: { depthVsBreadth: "depth", interleave: true },
  ifThenPlan: { cue: "after work", plan: "do 15 minutes of training" },
};

describe("constraints service", () => {
  it("returns null when no constraint set exists for user", async () => {
    const db = {
      constraintSet: {
        findFirst: vi.fn().mockResolvedValue(null),
      },
    };

    const current = await getCurrentConstraints(db as never, "user-1");
    expect(current).toBeNull();
  });

  it("decodes stored constraint set with defaults", async () => {
    const db = {
      constraintSet: {
        findFirst: vi.fn().mockResolvedValue({
          id: "cs-1",
          version: 2,
          minutesPerDay: 25,
          daysPerWeek: 5,
          goals: [{ kind: "rating", label: "Improve calculation" }],
          ownedResources: [],
          formatPrefs: {
            formats: ["blitz"],
            preferredVariety: false,
            targetFocus: "online",
          },
          sessionStyle: null,
          ifThenPlan: null,
        }),
      },
    };

    const current = await getCurrentConstraints(db as never, "user-1");
    expect(current).toMatchObject({
      id: "cs-1",
      version: 2,
      minutesPerDay: 25,
      daysPerWeek: 5,
      goals: [{ kind: "rating", label: "Improve calculation" }],
      formatPrefs: {
        formats: ["blitz"],
        preferredVariety: false,
        targetFocus: "online",
      },
      sessionStyle: { depthVsBreadth: "balanced", interleave: true },
      ifThenPlan: null,
    });
  });

  it("returns target focus defaulting to online when none saved", async () => {
    const db = {
      constraintSet: {
        findFirst: vi.fn().mockResolvedValue(null),
      },
    };

    const focus = await getTargetFocus(db as never, "user-1");
    expect(focus).toBe("online");
  });

  it("returns stored target focus", async () => {
    const db = {
      constraintSet: {
        findFirst: vi.fn().mockResolvedValue({
          id: "cs-1",
          version: 1,
          minutesPerDay: 20,
          daysPerWeek: 3,
          goals: [],
          ownedResources: [],
          formatPrefs: {
            formats: ["classical"],
            preferredVariety: false,
            targetFocus: "otb",
          },
          sessionStyle: null,
          ifThenPlan: null,
        }),
      },
    };

    const focus = await getTargetFocus(db as never, "user-1");
    expect(focus).toBe("otb");
  });

  it("saves a new constraint set, bumps version, and supersedes previous current row", async () => {
    const updateMany = vi.fn().mockResolvedValue({ count: 1 });
    const create = vi.fn().mockResolvedValue({
      id: "cs-2",
      version: 2,
      minutesPerDay: validConstraints.minutesPerDay,
      daysPerWeek: validConstraints.daysPerWeek,
      goals: validConstraints.goals,
      ownedResources: validConstraints.ownedResources,
      formatPrefs: validConstraints.formatPrefs,
      sessionStyle: validConstraints.sessionStyle,
      ifThenPlan: validConstraints.ifThenPlan,
    });

    const tx = {
      constraintSet: {
        findFirst: vi.fn().mockResolvedValue({ version: 1 }),
        updateMany,
        create,
      },
    };

    const db = {
      $transaction: vi.fn(async (cb: (txArg: typeof tx) => unknown) => cb(tx)),
    };

    const result = await saveConstraints(
      db as never,
      "user-1",
      validConstraints,
    );

    expect(updateMany).toHaveBeenCalledWith({
      where: { userId: "user-1", isCurrent: true },
      data: { isCurrent: false },
    });
    expect(create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        userId: "user-1",
        version: 2,
        isCurrent: true,
        minutesPerDay: 30,
        daysPerWeek: 4,
      }),
    });
    expect(result.id).toBe("cs-2");
    expect(result.version).toBe(2);
  });

  it("rejects saving constraints when format list is empty", async () => {
    const db = {
      $transaction: vi.fn(),
    };

    const emptyFormatsInput: ConstraintsInput = {
      ...validConstraints,
      formatPrefs: {
        formats: [],
        preferredVariety: false,
        targetFocus: "online",
      },
    };

    await expect(
      saveConstraints(db as never, "user-1", emptyFormatsInput),
    ).rejects.toMatchObject({
      code: "BAD_REQUEST",
    });
  });
});

describe("constraints router", () => {
  const activeUser = {
    deletedAt: null,
    betaAccessGrantedAt: new Date("2026-07-01T00:00:00Z"),
  };

  it("invokes getCurrent via tRPC caller", async () => {
    const db = {
      user: {
        findUnique: vi.fn().mockResolvedValue(activeUser),
      },
      constraintSet: {
        findFirst: vi.fn().mockResolvedValue(null),
      },
    };

    const caller = constraintsRouter.createCaller({
      session: { user: { id: "user-1" }, expires: "2099-01-01" },
      prisma: db as never,
    });

    const res = await caller.getCurrent();
    expect(res).toBeNull();
  });

  it("rejects empty formats via tRPC caller with BAD_REQUEST", async () => {
    const db = {
      user: {
        findUnique: vi.fn().mockResolvedValue(activeUser),
      },
      $transaction: vi.fn(),
    };

    const caller = constraintsRouter.createCaller({
      session: { user: { id: "user-1" }, expires: "2099-01-01" },
      prisma: db as never,
    });

    const emptyFormatsInput: ConstraintsInput = {
      ...validConstraints,
      formatPrefs: {
        formats: [],
        preferredVariety: false,
        targetFocus: "online",
      },
    };

    await expect(caller.save(emptyFormatsInput)).rejects.toMatchObject({
      code: "BAD_REQUEST",
    });
  });
});
