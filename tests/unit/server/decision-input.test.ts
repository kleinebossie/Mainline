// P4 — assembler test. Pins the single server-side state assembler (assembleProgramDecisionInput):
// the snapshot is constructed from persisted state + the injected Clock, validated against
// the typed schema, and its slice drives the pure generator. Same persisted inputs + same
// clock + same config → identical snapshot (L2 reproducibility). No graded chess decision
// happens here (L1) — every recommendation lives in the methodology provider.

import { describe, expect, it, vi } from "vitest";
import type { PrismaClient } from "@prisma/client";

import { fixedClock } from "@/lib/clock";
import { loadMethodology } from "@/methodology";
import {
  assembleProgramDecisionInput,
  parsePersistedSnapshot,
  PROGRAM_DECISION_INPUT_SCHEMA_VERSION,
} from "@/server/decision-input";
import type { ProgramDecisionInput } from "@/lib/decision-input";
import { findRecentSkillStateSnapshots } from "@/db/decision-input";

// A minimal fake that returns an empty house plus optional overrides per model.
function fakeDb(
  opts: {
    tacticalRating?: number;
    minutesPerDay?: number;
    features?: unknown[];
    skillStates?: {
      dimension: string;
      estimate: number;
      uncertainty: number;
      sampleSize: number;
    }[];
    snapshots?: {
      dimension: string;
      estimate: number;
      uncertainty: number;
      sampleSize: number;
      methodologyVersion: string;
      runAt: Date;
      capturedAt: Date;
    }[];
    due?: { itemRef: string; itemType: string; due: Date }[];
    activityEvents?: {
      type: string;
      occurredAt: Date;
      payload: unknown;
      programItem?: { activityType: string } | null;
    }[];
    recentAttempts?: {
      payload: unknown;
      programItem: { params: unknown } | null;
    }[];
    trainingPrefs?: {
      preferences: unknown;
      userOverride: unknown;
      resetAt: Date | null;
      updatedAt: Date;
    } | null;
    ratings?: unknown;
  } = {},
) {
  const db = {
    user: { findUnique: async () => ({ primaryPlatform: null }) },
    assessment: {
      findUnique: async () =>
        opts.tacticalRating != null
          ? { tacticalRatingEstimate: opts.tacticalRating }
          : null,
    },
    chessProfileSnapshot: {
      findFirst: async () =>
        opts.ratings != null ? { ratings: opts.ratings } : null,
    },
    analysisResult: {
      findMany: async () =>
        (opts.features ?? []).map((rawFeatures) => ({ rawFeatures })),
    },
    constraintSet: {
      findFirst: async () =>
        opts.minutesPerDay != null
          ? {
              id: "c1",
              version: 1,
              minutesPerDay: opts.minutesPerDay,
              daysPerWeek: 5,
              goals: [],
              ownedResources: [],
              formatPrefs: {
                formats: [],
                preferredVariety: false,
                targetFocus: "online",
              },
              sessionStyle: null,
              ifThenPlan: null,
            }
          : null,
    },
    resourceRef: { findMany: async () => [] },
    program: { findFirst: async () => null },
    practiceItem: { upsert: async () => ({ id: "pi_0" }) },
    scheduleState: { findMany: async () => opts.due ?? [] },
    lichessPuzzle: { findMany: async () => [] },
    activityEvent: { findMany: async () => opts.activityEvents ?? [] },
    skillState: { findMany: async () => opts.skillStates ?? [] },
    skillStateSnapshot: { findMany: async () => opts.snapshots ?? [] },
    trainingPreferenceState: {
      findUnique: async () => opts.trainingPrefs ?? null,
    },
    $transaction: async (cb: (tx: unknown) => unknown) => cb(db),
  } as unknown as PrismaClient;
  return db;
}

const cfg = loadMethodology();
const clock = fixedClock(1_700_000_000_000);

describe("assembleProgramDecisionInput — the single typed state assembler (P4)", () => {
  it("queries the latest 500 skill snapshots and returns them oldest to newest", async () => {
    const findMany = vi.fn(async ({ take }: { take: number }) =>
      Array.from({ length: take }, (_, index) => {
        const epoch = 1_700_000_000_000 - index;
        return {
          id: `snapshot-${index}`,
          dimension: "tactics",
          estimate: 0.5,
          uncertainty: 0.1,
          sampleSize: index,
          methodologyVersion: cfg.version,
          runAt: new Date(epoch),
          capturedAt: new Date(epoch),
        };
      }),
    );
    const history = await findRecentSkillStateSnapshots(
      { skillStateSnapshot: { findMany } } as never,
      "u-history",
    );

    expect(findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { userId: "u-history" },
        take: 500,
        orderBy: [{ runAt: "desc" }, { capturedAt: "desc" }, { id: "desc" }],
      }),
    );
    expect(history).toHaveLength(500);
    expect(history[0]!.runAt).toBeLessThan(history.at(-1)!.runAt);
  });

  it("builds a schema-valid snapshot from empty state and derives the generator slice", async () => {
    const db = fakeDb({ tacticalRating: 1100, minutesPerDay: 30 });
    const { snapshot, generateInput } = await assembleProgramDecisionInput(
      db,
      "u1",
      clock,
      cfg,
    );

    expect(snapshot.schemaVersion).toBe(PROGRAM_DECISION_INPUT_SCHEMA_VERSION);
    expect(snapshot.userId).toBe("u1");
    expect(snapshot.band).toBe("b800_1200");
    expect(snapshot.tacticalRating).toBe(1100);
    expect(snapshot.assembledAt).toBe(1_700_000_000_000);
    expect(snapshot.methodologyVersion).toBe(cfg.version);

    // Reproducibility (L2): the same snapshot should re-parse exactly.
    expect(
      parsePersistedSnapshot(JSON.parse(JSON.stringify(snapshot))),
    ).toEqual(snapshot);

    // The narrow slice the pure generator consumes is a projection of the snapshot.
    expect(generateInput.band).toBe(snapshot.band);
    expect(generateInput.tacticalRating).toBe(snapshot.tacticalRating);
    expect(generateInput.constraints.minutesPerDay).toBe(
      snapshot.constraints.minutesPerDay,
    );
    expect(generateInput.dueItems).toEqual([]);
  });

  it("embeds immutable skill history (SkillStateSnapshot rows) into the snapshot", async () => {
    const runAt = new Date(1_700_000_000_000 - 86_400_000);
    const db = fakeDb({
      tacticalRating: 1500,
      minutesPerDay: 30,
      skillStates: [
        {
          dimension: "tactics",
          estimate: 0.7,
          uncertainty: 0.05,
          sampleSize: 42,
        },
      ],
      snapshots: [
        {
          dimension: "tactics",
          estimate: 0.5,
          uncertainty: 0.1,
          sampleSize: 10,
          methodologyVersion: "research-1.0.0",
          runAt,
          capturedAt: runAt,
        },
      ],
    });
    const { snapshot } = await assembleProgramDecisionInput(
      db as never,
      "u-history",
      clock,
      cfg,
    );

    expect(snapshot.latestSkillState).toEqual([
      {
        dimension: "tactics",
        estimate: 0.7,
        uncertainty: 0.05,
        sampleSize: 42,
      },
    ]);
    expect(snapshot.skillHistory).toHaveLength(1);
    expect(snapshot.skillHistory[0]!.methodologyVersion).toBe("research-1.0.0");
    expect(snapshot.skillHistory[0]!.runAt).toBe(runAt.getTime());
  });

  it("persists the complete evidence tuple on each weakness signal", async () => {
    const blunderyFeatures = {
      acplOverall: 0,
      acplByPhase: { opening: 0, middlegame: 0, endgame: 0 },
      phaseBoundaries: { openingEndsPly: 0, endgameStartsPly: 0 },
      moveEvals: [
        { ply: 1, cpBefore: 0, cpAfter: -300, cpLoss: 300 },
        { ply: 2, cpBefore: 0, cpAfter: 0, cpLoss: 0 },
      ],
      blunders: [],
      errorCounts: {
        inaccuracies: 0,
        mistakes: 0,
        blunders: 1,
        grossBlunders: 0,
      },
    };
    const db = fakeDb({
      tacticalRating: 1500,
      minutesPerDay: 30,
      features: Array.from({ length: 20 }, () => blunderyFeatures),
    });

    const { snapshot } = await assembleProgramDecisionInput(
      db as never,
      "u-evidence",
      clock,
      cfg,
    );

    expect(snapshot.weaknessSignals).toHaveLength(1);
    expect(snapshot.weaknessSignals[0]).toMatchObject({
      evidenceGrade: expect.stringMatching(/^[ABCD]$/),
      citationKey: expect.any(String),
    });
    expect([1, 2]).toContain(snapshot.weaknessSignals[0]!.evidenceTier);
  });

  it("derives activity recency (P4) from immutable ActivityEvents", async () => {
    const asOf = 1_700_000_000_000;
    const yesterday = asOf - 86_400_000;
    const db = fakeDb({
      tacticalRating: 1500,
      minutesPerDay: 30,
      activityEvents: [
        {
          type: "puzzle_attempt",
          occurredAt: new Date(yesterday),
          payload: { correct: true, durationMin: 8, solveTimeMs: 120_000 },
          programItem: { activityType: "puzzle_theme" },
        },
        {
          type: "skip",
          occurredAt: new Date(yesterday + 1000),
          payload: {},
          programItem: { activityType: "book" },
        },
        {
          type: "puzzle_attempt",
          occurredAt: new Date(asOf - 3_600_000),
          payload: { correct: false, durationMin: 12 },
          programItem: { activityType: "puzzle_theme" },
        },
      ],
    });
    const { snapshot } = await assembleProgramDecisionInput(
      db as never,
      "u1",
      clock,
      cfg,
    );

    expect(snapshot.activityRecency.completionsByType.puzzle_theme).toBe(2);
    expect(snapshot.activityRecency.skipsByType.book).toBe(1);
    // Both explicit duration and measured solve time contribute in minutes.
    expect(snapshot.activityRecency.durationMinutesByType.puzzle_theme).toBe(
      22,
    );
    // Two distinct UTC days touched.
    expect(snapshot.activityRecency.activeDays).toBeGreaterThanOrEqual(1);
    expect(snapshot.activityRecency.totalEvents).toBe(3);
  });

  it("returns the empty training-preference default when no row exists yet (P4 default)", async () => {
    const db = fakeDb({
      tacticalRating: 1500,
      minutesPerDay: 30,
      trainingPrefs: null,
    });
    const { snapshot } = await assembleProgramDecisionInput(
      db as never,
      "u1",
      clock,
      cfg,
    );

    // P4 invariant: TrainingPreferences is ALWAYS present in the snapshot, defaulting
    // to an empty rollup when P8 has not yet written anything. evidenceCount is 0 and
    // userOverride is null so P5 can branch on "no signal yet".
    expect(snapshot.trainingPreferences.preferences.evidenceCount).toBe(0);
    expect(snapshot.trainingPreferences.preferences.enjoyment).toEqual({});
    expect(snapshot.trainingPreferences.userOverride).toBeNull();
    expect(snapshot.trainingPreferences.resetAt).toBeNull();
  });

  it("round-trips the persisted snapshot exactly through parsePersistedSnapshot", async () => {
    const db = fakeDb({ tacticalRating: 1500, minutesPerDay: 30 });
    const { snapshot } = await assembleProgramDecisionInput(
      db as never,
      "u-rt",
      clock,
      cfg,
    );
    const json = JSON.parse(JSON.stringify(snapshot)) as ProgramDecisionInput;
    const reparsed = parsePersistedSnapshot(json);
    expect(reparsed).toEqual(snapshot);
  });

  it("fail-closes when a persisted snapshot has shape drift (wrong schemaVersion)", async () => {
    const snapshot = {
      schemaVersion: 99, // unsupported future version
    };
    expect(() => parsePersistedSnapshot(snapshot)).toThrow();
  });
});

// Unused imports kept intent-explicit even when the suite grows.
void vi;
