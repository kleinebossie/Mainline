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
    expect(result).toEqual({
      programId: "started-program",
      reusedStartedProgram: true,
    });
    expect(updateMany).not.toHaveBeenCalled();
    expect(create).not.toHaveBeenCalled();
    expect(afterSave).not.toHaveBeenCalled();
  });
});
