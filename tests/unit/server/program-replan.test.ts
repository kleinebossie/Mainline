import { describe, expect, it, vi } from "vitest";

import { saveProgram } from "@/db/program";
import {
  exposureForPersistedItem,
  preserveUnfinishedActivities,
} from "@/server/program";

describe("explicit Replan completed-work preservation", () => {
  it("persists exactly one exposure per new item in the program transaction", async () => {
    const createMany = vi.fn().mockResolvedValue({ count: 1 });
    const tx = {
      $queryRaw: vi.fn(),
      program: {
        updateMany: vi.fn().mockResolvedValue({ count: 0 }),
        create: vi.fn().mockResolvedValue({
          id: "program-1",
          items: [{ id: "item-1", orderIndex: 0 }],
        }),
      },
      recommendationExposure: { createMany },
    };
    const db = {
      $transaction: async (work: (value: typeof tx) => unknown) => work(tx),
      program: tx.program,
    };
    const exposure = {
      servedRecommendation: {
        activityId: "tactics",
        activityType: "puzzle",
        dimensionsTargeted: ["calculation"],
        rank: 0,
        score: 3,
        dueEligible: false,
        confidence: "low" as const,
        evidenceGrade: "B" as const,
        evidenceTier: 2 as const,
        citationKey: "source",
        softened: true,
        allocatedMinutes: 10,
      },
      eligibleAlternatives: {
        complete: true as const,
        totalEligibleCount: 1,
        alternatives: [],
      },
    };

    const result = await saveProgram(db as never, {
      userId: "u1",
      methodologyVersion: "research-1.4.0",
      generationInput: {},
      date: new Date("2026-07-16T00:00:00Z"),
      exposedAt: new Date("2026-07-16T08:30:00Z"),
      items: [
        {
          orderIndex: 0,
          activityId: "tactics",
          activityType: "puzzle",
          resourceRefId: null,
          params: {},
          dimensionsTargeted: ["calculation"],
          rationaleKey: "puzzle",
          rationaleText: "Association-safe rationale.",
          evidenceGrade: "B",
          evidenceTier: 2,
          citationKey: "source",
          confidence: "low",
          soften: true,
          exposure,
        },
      ],
    });

    expect(result).toEqual({
      programId: "program-1",
      reusedStartedProgram: false,
    });
    expect(createMany).toHaveBeenCalledOnce();
    expect(createMany.mock.calls[0]?.[0].data).toHaveLength(1);
    expect(createMany.mock.calls[0]?.[0].data[0]).toMatchObject({
      userId: "u1",
      programId: "program-1",
      programItemId: "item-1",
      methodologyVersion: "research-1.4.0",
      servedRecommendation: exposure.servedRecommendation,
      eligibleAlternatives: exposure.eligibleAlternatives,
      exposedAt: new Date("2026-07-16T08:30:00Z"),
    });
  });

  it("removes only matching completed occurrences from replacement Today", () => {
    const generated = [
      {
        activityId: "review",
        activityType: "spaced_review",
        params: {
          theme: null,
          track: null,
          dueItemRefs: ["p1", "p2"],
          count: 2,
        },
        estMinutes: 10,
      },
      {
        activityId: "play",
        activityType: "play_game",
        params: { theme: null, track: null },
        estMinutes: 15,
      },
    ];
    const result = preserveUnfinishedActivities(generated, [
      {
        activityId: "review",
        activityType: "spaced_review",
        params: { dueItemRefs: ["p1"] },
      },
    ]);

    expect(result[0]).toMatchObject({
      params: { dueItemRefs: ["p2"], count: 1 },
      estMinutes: 5,
    });
    expect(result[1]).toEqual(generated[1]);
    expect(generated[0]?.params.dueItemRefs).toEqual(["p1", "p2"]);
  });

  it("synchronizes the exposure dose after a partial due block is preserved", () => {
    const exposure = {
      servedRecommendation: {
        activityId: "review",
        activityType: "spaced_review",
        dimensionsTargeted: ["tactics"],
        rank: 0,
        score: 5,
        dueEligible: true,
        confidence: "medium" as const,
        evidenceGrade: "A" as const,
        evidenceTier: 2 as const,
        citationKey: "spacing",
        softened: false,
        allocatedMinutes: 10,
      },
      eligibleAlternatives: {
        complete: true as const,
        totalEligibleCount: 1,
        alternatives: [],
      },
    };
    const [remaining] = preserveUnfinishedActivities(
      [
        {
          activityId: "review",
          activityType: "spaced_review",
          params: {
            theme: null,
            track: null,
            dueItemRefs: ["p1", "p2"],
            count: 2,
          },
          estMinutes: 10,
          exposure,
        },
      ],
      [
        {
          activityId: "review",
          activityType: "spaced_review",
          params: { dueItemRefs: ["p1"] },
        },
      ],
    );

    expect(remaining).toBeDefined();
    expect(remaining!.estMinutes).toBe(5);
    expect(
      exposureForPersistedItem(remaining!).servedRecommendation
        .allocatedMinutes,
    ).toBe(5);
    expect(exposure.servedRecommendation.allocatedMinutes).toBe(10);
  });

  it("rechecks started Today under the program mutation lock", async () => {
    const updateMany = vi.fn();
    const create = vi.fn();
    const afterSave = vi.fn();
    const tx = {
      $queryRaw: vi.fn(),
      program: {
        findFirst: vi.fn().mockResolvedValue({ id: "started-program" }),
        updateMany,
        create,
      },
    };
    const db = {
      $transaction: async (work: (value: typeof tx) => unknown) => work(tx),
      program: tx.program,
    };

    const result = await saveProgram(
      db as never,
      {
        userId: "u1",
        methodologyVersion: "research-1.1.0",
        generationInput: {},
        date: new Date("2026-07-13T00:00:00Z"),
        exposedAt: new Date("2026-07-13T08:30:00Z"),
        items: [],
      },
      { preventStartedReplacement: true, afterSave },
    );

    expect(tx.$queryRaw).toHaveBeenCalledOnce();
    expect(tx.program.findFirst).toHaveBeenCalledWith({
      where: {
        userId: "u1",
        status: "active",
        items: {
          some: {
            date: new Date("2026-07-13T00:00:00Z"),
            activityEvents: { some: {} },
          },
        },
      },
      select: { id: true },
    });
    expect(result).toEqual({
      programId: "started-program",
      reusedStartedProgram: true,
    });
    expect(updateMany).not.toHaveBeenCalled();
    expect(create).not.toHaveBeenCalled();
    expect(afterSave).not.toHaveBeenCalled();
  });

  it("reuses an existing session date when duplicate build requests arrive", async () => {
    const updateMany = vi.fn();
    const create = vi.fn();
    const tx = {
      $queryRaw: vi.fn(),
      program: {
        findFirst: vi.fn().mockResolvedValue({ id: "today-program" }),
        updateMany,
        create,
      },
    };
    const db = {
      $transaction: async (work: (value: typeof tx) => unknown) => work(tx),
      program: tx.program,
    };
    const date = new Date("2026-07-15T00:00:00Z");

    const result = await saveProgram(
      db as never,
      {
        userId: "u1",
        methodologyVersion: "research-1.3.0",
        generationInput: {},
        date,
        exposedAt: new Date("2026-07-15T08:30:00Z"),
        items: [],
      },
      { reuseExistingDate: true },
    );

    expect(result).toEqual({
      programId: "today-program",
      reusedStartedProgram: true,
    });
    expect(tx.program.findFirst).toHaveBeenCalledWith({
      where: {
        userId: "u1",
        status: "active",
        items: { some: { date } },
      },
      select: { id: true },
    });
    expect(updateMany).not.toHaveBeenCalled();
    expect(create).not.toHaveBeenCalled();
  });

  it("does not let a started earlier day block today's session", async () => {
    const updateMany = vi.fn().mockResolvedValue({ count: 1 });
    const create = vi.fn().mockResolvedValue({ id: "new-day-program" });
    const tx = {
      $queryRaw: vi.fn(),
      program: {
        findFirst: vi.fn().mockResolvedValue(null),
        updateMany,
        create,
      },
    };
    const db = {
      $transaction: async (work: (value: typeof tx) => unknown) => work(tx),
      program: tx.program,
    };
    const date = new Date("2026-07-15T00:00:00Z");

    const result = await saveProgram(
      db as never,
      {
        userId: "u1",
        methodologyVersion: "research-1.3.0",
        generationInput: {},
        date,
        exposedAt: new Date("2026-07-15T08:30:00Z"),
        items: [],
      },
      { preventStartedReplacement: true },
    );

    expect(tx.program.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          items: {
            some: { date, activityEvents: { some: {} } },
          },
        }),
      }),
    );
    expect(updateMany).toHaveBeenCalledOnce();
    expect(create).toHaveBeenCalledOnce();
    expect(result).toEqual({
      programId: "new-day-program",
      reusedStartedProgram: false,
    });
  });
});
