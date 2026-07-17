import { describe, expect, it } from "vitest";
import type { PrismaClient } from "@prisma/client";

import {
  completeProgramItem,
  logOutcome,
  runDailyAdaptation,
  undoSkip,
} from "@/server/tracker";
import { DAY_MS, fixedClock } from "@/lib/clock";

// M7 server orchestration: logOutcome (= applyEvent §7.3) over an in-memory fake Prisma.
// The graded decisions are golden-tested in engine/adaptation + methodology; this pins the
// plumbing — the append-only log, the item status flip, and the persisted FSRS/skill/log.

interface Recorder {
  events: {
    requestId: string | null;
    type: string;
    payload: unknown;
    programItemId: string | null;
  }[];
  itemUpdates: { id: string; status: string }[];
  scheduleUpserts: {
    itemRef: string;
    itemType: string;
    due: Date;
    lastGrade: number;
  }[];
  skillUpserts: { dimension: string; estimate: number; sampleSize: number }[];
  skillSnapshots: {
    dimension: string;
    estimate: number;
    sampleSize: number;
    methodologyVersion: unknown;
    runAt: Date;
  }[];
  logs: { trigger: string; decisions: unknown; runAt?: Date }[];
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
    skillSnapshots: [],
    logs: [],
    rewardCreates: [],
  };

  const db = {
    programItem: {
      findFirst: async () => item,
      count: async () =>
        rec.itemUpdates.filter((update) => update.status === "done").length,
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
      findUnique: async ({
        where,
      }: {
        where: { userId_requestId: { requestId: string } };
      }) =>
        rec.events.some(
          (event) => event.requestId === where.userId_requestId.requestId,
        )
          ? { id: "existing-event" }
          : null,
      create: async ({
        data,
      }: {
        data: {
          requestId: string | null;
          type: string;
          payload: unknown;
          programItemId: string | null;
        };
      }) => {
        rec.events.push({
          requestId: data.requestId,
          type: data.type,
          payload: data.payload,
          programItemId: data.programItemId,
        });
        return { id: `e${rec.events.length}` };
      },
      // Engagement rollup reads (M9): the appended events are "today" at the fixed clock.
      findMany: async () => rec.events.map(() => ({ occurredAt: new Date(T) })),
      count: async () =>
        rec.events.filter((event) => event.programItemId === null).length,
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
    skillStateSnapshot: {
      createMany: async ({
        data,
      }: {
        data: {
          dimension: string;
          estimate: number;
          sampleSize: number;
          methodologyVersion: unknown;
          runAt: Date;
        }[];
      }) => {
        for (const d of data)
          rec.skillSnapshots.push({
            dimension: d.dimension,
            estimate: d.estimate,
            sampleSize: d.sampleSize,
            methodologyVersion: d.methodologyVersion,
            runAt: d.runAt,
          });
        return { count: data.length };
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
      findFirst: async () =>
        rec.logs.some((log) => log.trigger === "daily_cron")
          ? { id: "daily-log" }
          : null,
      create: async ({
        data,
      }: {
        data: { trigger: string; decisions: unknown; runAt?: Date };
      }) => {
        rec.logs.push({
          trigger: data.trigger,
          decisions: data.decisions,
          runAt: data.runAt,
        });
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
const REQUEST_ID = "00000000-0000-4000-8000-000000000001";
const SECOND_REQUEST_ID = "00000000-0000-4000-8000-000000000002";
const puzzleItem = {
  dimensionsTargeted: ["tactics"],
  params: { track: "pattern", theme: "fork" },
};

describe("logOutcome (applyEvent)", () => {
  it("rejects another user's program item before writing or mutating anything", async () => {
    const { db, rec } = fakeDb(null);

    await expect(
      logOutcome(
        db,
        "u1",
        {
          requestId: REQUEST_ID,
          programItemId: "owned-by-u2",
          type: "puzzle_attempt",
          correct: false,
        },
        clock,
      ),
    ).rejects.toMatchObject({
      code: "CONFLICT",
      message:
        "That block changed since this page loaded. Reload Today before logging it.",
    });

    expect(rec.events).toEqual([]);
    expect(rec.itemUpdates).toEqual([]);
    expect(rec.skillUpserts).toEqual([]);
    expect(rec.scheduleUpserts).toEqual([]);
    expect(rec.logs).toEqual([]);
  });

  it("a struggled puzzle appends an immutable event, marks the item done, and schedules a redo", async () => {
    const { db, rec } = fakeDb(puzzleItem);
    const res = await logOutcome(
      db,
      "u1",
      {
        requestId: REQUEST_ID,
        programItemId: "p1",
        type: "puzzle_attempt",
        correct: false,
      },
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

    // P4: an immutable SkillStateSnapshot is appended per dimension this run touched,
    // stamped with the run's logical time + methodology version.
    expect(rec.skillSnapshots).toEqual([
      {
        dimension: "tactics",
        estimate: 0,
        sampleSize: 1,
        methodologyVersion: expect.any(String),
        runAt: new Date(T),
      },
    ]);
  });

  it("the event log is append-only — logging twice writes two rows, never overwrites", async () => {
    const { db, rec } = fakeDb(puzzleItem);
    await logOutcome(
      db,
      "u1",
      {
        requestId: REQUEST_ID,
        programItemId: "p1",
        type: "puzzle_attempt",
        correct: false,
      },
      clock,
    );
    await logOutcome(
      db,
      "u1",
      {
        requestId: SECOND_REQUEST_ID,
        programItemId: "p1",
        type: "puzzle_attempt",
        correct: true,
      },
      clock,
    );
    expect(rec.events).toHaveLength(2);
  });

  it("treats a repeated request as a no-op", async () => {
    const { db, rec } = fakeDb(puzzleItem);
    const input = {
      requestId: REQUEST_ID,
      programItemId: "p1",
      type: "puzzle_attempt" as const,
      correct: false,
    };

    await logOutcome(db, "u1", input, clock);
    const retry = await logOutcome(db, "u1", input, clock);

    expect(rec.events).toHaveLength(1);
    expect(rec.logs).toHaveLength(1);
    expect(rec.rewardCreates).toHaveLength(1);
    expect(retry).toMatchObject({
      scheduledReviews: 0,
      decisions: 0,
      rewardEvents: [],
    });
  });

  it("a solved puzzle records the outcome but schedules no review", async () => {
    const { db, rec } = fakeDb(puzzleItem);
    const res = await logOutcome(
      db,
      "u1",
      {
        requestId: REQUEST_ID,
        programItemId: "p1",
        type: "puzzle_attempt",
        correct: true,
      },
      clock,
    );
    expect(rec.scheduleUpserts).toEqual([]);
    expect(rec.skillUpserts[0]!.estimate).toBe(1);
    expect(res.scheduledReviews).toBe(0);
  });

  it("keeps a multi-position block open until its session is completed", async () => {
    const { db, rec } = fakeDb(puzzleItem);
    const outcome = await logOutcome(
      db,
      "u1",
      {
        requestId: REQUEST_ID,
        programItemId: "p1",
        completeProgramItem: false,
        type: "puzzle_attempt",
        correct: true,
      },
      clock,
    );

    expect(rec.itemUpdates).toEqual([]);
    expect(outcome.rewardEvents).toEqual([]);
    expect(rec.rewardCreates).toEqual([]);

    await completeProgramItem(
      db,
      "u1",
      { requestId: SECOND_REQUEST_ID, programItemId: "p1" },
      clock,
    );

    expect(rec.events.at(-1)).toMatchObject({
      requestId: SECOND_REQUEST_ID,
      type: "session_completed",
      programItemId: "p1",
    });
    expect(rec.itemUpdates).toEqual([{ id: "p1", status: "done" }]);
    expect(rec.rewardCreates.map((event) => event.type)).toEqual([
      "streak_tick",
    ]);

    await completeProgramItem(
      db,
      "u1",
      { requestId: SECOND_REQUEST_ID, programItemId: "p1" },
      clock,
    );
    expect(
      rec.events.filter((event) => event.type === "session_completed"),
    ).toHaveLength(1);
    expect(rec.itemUpdates).toEqual([{ id: "p1", status: "done" }]);
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
        requestId: REQUEST_ID,
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

  it("M14: a book_session feeds the SAME loop — appended + logged, with no skill/schedule move", async () => {
    // Logged from /library with no ProgramItem; carries the external resource + self-reported
    // success. It must append to the immutable log, run the adaptation loop (an AdaptationLog),
    // and tick the engagement streak — but NEVER move skill or schedule, because the success
    // rate is for the 85% nudge only, not skill diagnosis (Seam 2). correct stays null.
    const { db, rec } = fakeDb(null);
    const res = await logOutcome(
      db,
      "u1",
      {
        requestId: REQUEST_ID,
        type: "book_session",
        resourceRefId: "silman_reassess_your_chess",
        durationMin: 30,
        position: { chapter: 4 },
        selfReport: { successRate: 0.8, woodpeckerCycle: 2 },
      },
      clock,
    );

    expect(rec.events).toHaveLength(1);
    expect(rec.events[0]).toMatchObject({
      type: "book_session",
      programItemId: null,
      payload: {
        resourceRefId: "silman_reassess_your_chess",
        position: { chapter: 4 },
        selfReport: { successRate: 0.8, woodpeckerCycle: 2 },
      },
    });
    // No ProgramItem to flip, and a book session never moves skill/schedule (correct is null).
    expect(rec.itemUpdates).toEqual([]);
    expect(rec.scheduleUpserts).toEqual([]);
    expect(rec.skillUpserts).toEqual([]);
    // It still runs the same adaptation loop and ticks the forgiving streak (it's a completion).
    expect(rec.logs).toHaveLength(1);
    expect(rec.rewardCreates[0]!.type).toBe("streak_tick");
    expect(res.scheduledReviews).toBe(0);
  });
});

describe("undoSkip", () => {
  it("appends a reversal event and returns the active item to todo", async () => {
    const events: Array<{ type: string; payload: unknown }> = [];
    const updates: Array<{ status: string }> = [];
    const db = {
      programItem: {
        findFirst: async () => ({ activityEvents: [{ id: "skip-1" }] }),
        update: async ({ data }: { data: { status: string } }) => {
          updates.push(data);
          return {};
        },
      },
      activityEvent: {
        create: async ({
          data,
        }: {
          data: { type: string; payload: unknown };
        }) => {
          events.push({ type: data.type, payload: data.payload });
          return { id: "undo-1" };
        },
      },
      $transaction: async (work: (tx: unknown) => unknown) => work(db),
    } as unknown as PrismaClient;

    await undoSkip(db, "u1", "p1", clock);

    expect(events).toEqual([
      { type: "skip_undone", payload: { reversesEventId: "skip-1" } },
    ]);
    expect(updates).toEqual([{ status: "todo" }]);
  });
});

describe("runDailyAdaptation", () => {
  it("persists at most one deterministic daily cron log", async () => {
    const { db, rec } = fakeDb(null);

    const first = await runDailyAdaptation(db, "u1", clock);
    const second = await runDailyAdaptation(db, "u1", clock);

    expect(first.decisions).toBe(0);
    expect(second.decisions).toBe(0);
    expect(rec.logs.filter((log) => log.trigger === "daily_cron")).toHaveLength(
      1,
    );
  });
});
