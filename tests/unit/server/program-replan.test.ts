import { describe, expect, it, vi } from "vitest";

import { saveProgram } from "@/db/program";
import { preserveUnfinishedActivities } from "@/server/program";

describe("explicit Replan completed-work preservation", () => {
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
