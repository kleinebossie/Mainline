import { describe, expect, it } from "vitest";
import type { PrismaClient } from "@prisma/client";

import { getProgressSummary } from "@/server/progress";
import { DAY_MS, fixedClock } from "@/lib/clock";

const T = 1_700_000_000_000;
const clock = fixedClock(T);

function fakeDb() {
  const activityEvents = [
    {
      type: "puzzle_attempt",
      occurredAt: new Date(T - DAY_MS),
      payload: { correct: true, solveTimeMs: 180_000 },
    },
    {
      type: "book_session",
      occurredAt: new Date(T - 2 * DAY_MS),
      payload: { durationMin: 25 },
    },
    {
      type: "skip",
      occurredAt: new Date(T - 3 * DAY_MS),
      payload: {},
    },
  ];

  return {
    user: {
      findUnique: async ({ where }: { where: { id: string } }) =>
        where.id === "u1" ? { primaryPlatform: null } : null,
    },
    constraintSet: {
      findFirst: async () => null,
    },
    activityEvent: {
      findMany: async ({
        where,
      }: {
        where?: { type?: { not?: string }; occurredAt?: { gte?: Date } };
      }) =>
        activityEvents
          .filter((event) =>
            where?.type?.not ? event.type !== where.type.not : true,
          )
          .filter((event) =>
            where?.occurredAt?.gte
              ? event.occurredAt >= where.occurredAt.gte
              : true,
          ),
      count: async () =>
        activityEvents.filter((event) => event.type !== "skip").length,
    },
    notificationPref: { findUnique: async () => null },
    rewardEvent: {
      findMany: async () =>
        Array.from({ length: 8 }, (_, index) => ({
          id: `streak-${index}`,
          type: "streak_tick",
          copyKey: "streak_tick",
          payload: { streakDay: 1, streak: 1 },
          occurredAt: new Date(T - index),
          seen: false,
        })),
      findFirst: async () => ({
        id: "recovery-1",
        type: "recovery_prompt",
        copyKey: "recovery_prompt",
        payload: {},
        occurredAt: new Date(T - DAY_MS),
        seen: false,
      }),
    },
    programItem: {
      count: async ({ where }: { where: { status: string } }) =>
        where.status === "done" ? 2 : 1,
    },
    scheduleState: {
      findMany: async () => [
        {
          itemType: "puzzle",
          due: new Date(T - DAY_MS),
        },
        {
          itemType: "endgame",
          due: new Date(T - 2 * DAY_MS),
        },
      ],
    },
    skillState: {
      findMany: async () => [
        {
          dimension: "tactics",
          estimate: 0.75,
          uncertainty: 0.12,
          sampleSize: 16,
        },
      ],
    },
    chessProfileSnapshot: {
      findMany: async () => [
        {
          platform: "lichess",
          capturedAt: new Date(T - 90 * DAY_MS),
          ratings: { rapid: { rating: 1500, rd: 60 } },
        },
        {
          platform: "lichess",
          capturedAt: new Date(T),
          ratings: { rapid: { rating: 1530, rd: 70 } },
        },
      ],
    },
  } as unknown as PrismaClient;
}

describe("getProgressSummary", () => {
  it("rolls up process progress with methodology-backed windows and evidence copy", async () => {
    const summary = await getProgressSummary(fakeDb(), "u1", clock);

    expect(summary.work.windowDays).toBe(7);
    expect(summary.work.completedBlocks).toBe(2);
    expect(summary.work.skippedBlocks).toBe(1);
    expect(summary.work.minutesLogged).toBe(28);
    expect(summary.reviews.dueCount).toBe(2);
    expect(summary.reviews.itemTypes).toEqual({ puzzle: 1, endgame: 1 });

    expect(summary.evidence.progressSurface.evidenceGrade).toBe("A");
    expect(summary.evidence.progressSurface.citationKey).toBe("deci1999");
    expect(summary.evidence.ratingNoise.citationKey).toBe("glickman2012");
    expect(summary.consistency.recoveryEvents).toMatchObject([
      {
        id: "recovery-1",
        type: "recovery_prompt",
        evidenceGrade: "B",
        evidenceTier: 2,
        citationKey: "lally2010",
        seen: false,
      },
    ]);
  });

  it("surfaces rating as uncertainty ranges, not a raw headline number", async () => {
    const summary = await getProgressSummary(fakeDb(), "u1", clock);

    expect(summary.rating).not.toBeNull();
    expect(summary.rating!.platform).toBe("lichess");
    expect(summary.rating!.platformLabel).toBe("Lichess");
    expect(summary.rating!.platformSet).toBe(false);
    expect(summary.rating!.formatsSet).toBe(false);
    expect(summary.rating!.formats).toHaveLength(1);
    expect(summary.rating!.formats[0]!.format).toBe("rapid");
    expect(summary.rating!.formats[0]!.latest).not.toHaveProperty("rating");
    expect(summary.rating!.formats[0]!.latest.range).toEqual({
      lower: 1392.8,
      upper: 1667.2,
    });
    expect(summary.rating!.formats[0]!.realProgress).toBe(false);
    expect(summary.rating!.formats[0]!.expectation?.text).toContain(
      "several months",
    );
  });
});
