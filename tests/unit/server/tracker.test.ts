import { describe, expect, it } from "vitest";
import type { PrismaClient } from "@prisma/client";

import { logOutcome } from "@/server/tracker";
import { DAY_MS, fixedClock } from "@/lib/clock";

// M7 server orchestration: logOutcome (= applyEvent §7.3) over an in-memory fake Prisma.
// The graded decisions are golden-tested in engine/adaptation + methodology; this pins the
// plumbing — the append-only log, the item status flip, and the persisted FSRS/skill/log.

interface Recorder {
  events: { type: string; payload: unknown; programItemId: string | null }[];
  itemUpdates: { id: string; status: string }[];
  scheduleUpserts: {
    itemRef: string;
    itemType: string;
    due: Date;
    lastGrade: number;
  }[];
  skillUpserts: { dimension: string; estimate: number; sampleSize: number }[];
  logs: { trigger: string; decisions: unknown }[];
  rewardCreates: { type: string; copyKey: string }[];
}

function fakeDb(
  item: {
    dimensionsTargeted: string[];
    params: unknown;
    activityType?: string;
  } | null,
) {
  const rec: Recorder = {
    events: [],
    itemUpdates: [],
    scheduleUpserts: [],
    skillUpserts: [],
    logs: [],
    rewardCreates: [],
  };

  const db = {
    programItem: {
      findUnique: async () => item,
      update: async ({
        where,
        data,
      }: {
        where: { id: string };
        data: { status: string };
      }) => {
        rec.itemUpdates.push({ id: where.id, status: data.status });
        return {};
      },
    },
    activityEvent: {
      create: async ({
        data,
      }: {
        data: { type: string; payload: unknown; programItemId: string | null };
      }) => {
        rec.events.push({
          type: data.type,
          payload: data.payload,
          programItemId: data.programItemId,
        });
        return { id: `e${rec.events.length}` };
      },
      // Engagement rollup reads (M9): the appended events are "today" at the fixed clock.
      findMany: async () => rec.events.map(() => ({ occurredAt: new Date(T) })),
      count: async () => rec.events.length,
    },
    rewardEvent: {
      createMany: async ({
        data,
      }: {
        data: { type: string; copyKey: string }[];
      }) => {
        for (const d of data)
          rec.rewardCreates.push({ type: d.type, copyKey: d.copyKey });
        return { count: data.length };
      },
    },
    skillState: {
      findMany: async () => [],
      upsert: async ({
        create,
      }: {
        create: { dimension: string; estimate: number; sampleSize: number };
      }) => {
        rec.skillUpserts.push({
          dimension: create.dimension,
          estimate: create.estimate,
          sampleSize: create.sampleSize,
        });
        return {};
      },
    },
    scheduleState: {
      findMany: async () => [],
      count: async () => 0,
      upsert: async ({
        create,
      }: {
        create: {
          itemRef: string;
          itemType: string;
          due: Date;
          lastGrade: number;
        };
      }) => {
        rec.scheduleUpserts.push({
          itemRef: create.itemRef,
          itemType: create.itemType,
          due: create.due,
          lastGrade: create.lastGrade,
        });
        return {};
      },
    },
    adaptationLog: {
      create: async ({
        data,
      }: {
        data: { trigger: string; decisions: unknown };
      }) => {
        rec.logs.push({ trigger: data.trigger, decisions: data.decisions });
        return {};
      },
    },
    chessProfileSnapshot: { findMany: async () => [] },
    $transaction: async (cb: (tx: unknown) => unknown) => cb(db),
  } as unknown as PrismaClient;

  return { db, rec };
}

const T = 1_700_000_000_000;
const clock = fixedClock(T);
const puzzleItem = {
  dimensionsTargeted: ["tactics"],
  params: { track: "pattern", theme: "fork" },
};

describe("logOutcome (applyEvent)", () => {
  it("a struggled puzzle appends an immutable event, marks the item done, and schedules a redo", async () => {
    const { db, rec } = fakeDb(puzzleItem);
    const res = await logOutcome(
      db,
      "u1",
      { programItemId: "p1", type: "puzzle_attempt", correct: false },
      clock,
    );

    expect(rec.events).toHaveLength(1);
    expect(rec.events[0]).toMatchObject({
      type: "puzzle_attempt",
      programItemId: "p1",
      payload: { correct: false },
    });
    expect(rec.itemUpdates).toEqual([{ id: "p1", status: "done" }]);

    expect(rec.scheduleUpserts).toHaveLength(1);
    expect(rec.scheduleUpserts[0]!.itemRef).toBe("fork");
    expect(rec.scheduleUpserts[0]!.lastGrade).toBe(1);
    expect(rec.scheduleUpserts[0]!.due.getTime()).toBe(T + DAY_MS);

    expect(rec.skillUpserts).toEqual([
      { dimension: "tactics", estimate: 0, sampleSize: 1 },
    ]);
    expect(rec.logs).toHaveLength(1);
    expect(res.scheduledReviews).toBe(1);

    // M9: completing an activity fires a Seam-9 engagement event (a capped streak tick).
    expect(rec.rewardCreates).toHaveLength(1);
    expect(rec.rewardCreates[0]!.type).toBe("streak_tick");
    expect(res.rewardEvents[0]!.payload.streakDay).toBe(1);
  });

  it("the event log is append-only — logging twice writes two rows, never overwrites", async () => {
    const { db, rec } = fakeDb(puzzleItem);
    await logOutcome(
      db,
      "u1",
      { programItemId: "p1", type: "puzzle_attempt", correct: false },
      clock,
    );
    await logOutcome(
      db,
      "u1",
      { programItemId: "p1", type: "puzzle_attempt", correct: true },
      clock,
    );
    expect(rec.events).toHaveLength(2);
  });

  it("a solved puzzle records the outcome but schedules no review", async () => {
    const { db, rec } = fakeDb(puzzleItem);
    const res = await logOutcome(
      db,
      "u1",
      { programItemId: "p1", type: "puzzle_attempt", correct: true },
      clock,
    );
    expect(rec.scheduleUpserts).toEqual([]);
    expect(rec.skillUpserts[0]!.estimate).toBe(1);
    expect(res.scheduledReviews).toBe(0);
  });

  it("M13: an endgame drill_done spaces on its own 'endgame' FSRS queue", async () => {
    // A failed endgame conversion re-steps the personal position by id on the "endgame" queue
    // (not "blunder_drill") — the per-activity routing that keeps endgame spacing separate.
    const endgameItem = {
      dimensionsTargeted: ["endgames"],
      params: {},
      activityType: "endgame_drill",
    };
    const { db, rec } = fakeDb(endgameItem);
    await logOutcome(
      db,
      "u1",
      {
        programItemId: "p1",
        type: "drill_done",
        correct: false,
        practiceItemId: "pi-endgame-1",
      },
      clock,
    );
    expect(rec.scheduleUpserts).toHaveLength(1);
    expect(rec.scheduleUpserts[0]).toMatchObject({
      itemRef: "pi-endgame-1",
      itemType: "endgame",
      lastGrade: 1,
    });
    expect(rec.skillUpserts).toEqual([
      { dimension: "endgames", estimate: 0, sampleSize: 1 },
    ]);
  });
});
