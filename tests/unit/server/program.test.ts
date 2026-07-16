import { describe, expect, it } from "vitest";
import type { PrismaClient } from "@prisma/client";

import { generateAndSaveProgram, getTodayProgram } from "@/server/program";
import { fixedClock } from "@/lib/clock";
import {
  ACTIVE_METHODOLOGY_VERSION,
  loadMethodology,
  rationaleFor,
} from "@/methodology";
import { programGenerationInputSchema } from "@/lib/weekly-focus";

// M6 server orchestration: a generate → read round-trip over an in-memory fake Prisma.
// The graded decisions are golden-tested in engine/generator + methodology/program-seams;
// this pins the plumbing : persistence of the L3 snapshot and the /today DTO shaping.

interface FakeOpts {
  tacticalRating?: number;
  minutesPerDay?: number;
  features?: unknown[];
  seededRefIds?: string[];
  dueRows?: { itemRef: string; itemType: string; due: Date }[];
  puzzleRows?: { puzzleId: string; themes: string[] }[];
  recentAttempts?: {
    payload: unknown;
    programItem: { params: unknown } | null;
  }[];
  ratings?: unknown;
  ownedResources?: {
    kind: "book" | "course" | "membership" | "trainer" | "other";
    label: string;
    externalRef?: string;
  }[];
  initialProgram?: {
    id: string;
    createdAt: Date;
    methodologyVersion: string;
    items: CreatedItem[];
  };
}

interface CreatedItem {
  id: string;
  orderIndex: number;
  activityId: string;
  activityType: string;
  resourceRefId: string | null;
  params: unknown;
  dimensionsTargeted: string[];
  rationaleKey: string;
  rationaleText: string;
  evidenceGrade: string;
  evidenceTier: number;
  citationKey: string;
  confidence: string;
  soften: boolean;
  status: string;
  resourceRef: null;
}

const savedGenerationInputs = new WeakMap<object, unknown>();
const savedRecommendationExposures = new WeakMap<object, unknown[]>();

function fakeDb(opts: FakeOpts) {
  const state: {
    created: {
      id: string;
      createdAt: Date;
      methodologyVersion: string;
      items: CreatedItem[];
    } | null;
  } = { created: opts.initialProgram ?? null };

  const db = {
    user: {
      findUnique: async () => ({ primaryPlatform: null }),
    },
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
        (opts.features ?? []).map((f) => ({ rawFeatures: f })),
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
              ownedResources: opts.ownedResources ?? [],
              formatPrefs: { formats: [], preferredVariety: false },
              sessionStyle: null,
              ifThenPlan: null,
            }
          : null,
    },
    resourceRef: {
      findMany: async ({ where }: { where: { id: { in: string[] } } }) =>
        (opts.seededRefIds ?? [])
          .filter((id) => where.id.in.includes(id))
          .map((id) => ({ id })),
    },
    scheduleState: {
      findMany: async () => opts.dueRows ?? [],
      // M13: ensureEndgameDrills seeds endgame schedules; the fake just accepts the write.
      upsert: async () => undefined,
    },
    lichessPuzzle: {
      findMany: async ({ where }: { where: { puzzleId: { in: string[] } } }) =>
        (opts.puzzleRows ?? []).filter((row) =>
          where.puzzleId.in.includes(row.puzzleId),
        ),
    },
    // M13: ensureEndgameDrills upserts curated endgame PracticeItems before reading due items.
    practiceItem: {
      upsert: async ({ create }: { create: { sourceRef: string } }) => ({
        id: `pi_${create.sourceRef}`,
      }),
    },
    activityEvent: { findMany: async () => opts.recentAttempts ?? [] },
    // P4: the assembler reads longitudinal state (latest skill rows, immutable history,
    // training preferences). The fakes return empty defaults so the assembled snapshot
    // pins "no prior history" deterministically.
    skillState: { findMany: async () => [] },
    skillStateSnapshot: { findMany: async () => [] },
    trainingPreferenceState: { findUnique: async () => null },
    weeklyFocus: {
      findFirst: async () => null,
      updateMany: async () => ({ count: 0 }),
      create: async ({ data }: { data: Record<string, unknown> }) => ({
        id: "focus1",
        selectedAlternative: null,
        status: "active",
        createdAt: new Date(clock.now()),
        ...data,
      }),
    },
    program: {
      updateMany: async () => ({ count: 0 }),
      create: async ({
        data,
      }: {
        data: {
          generationInput: unknown;
          methodologyVersion: string;
          items: {
            create: Omit<CreatedItem, "id" | "status" | "resourceRef">[];
          };
        };
      }) => {
        savedGenerationInputs.set(db, data.generationInput);
        state.created = {
          id: "prog1",
          createdAt: new Date(0),
          methodologyVersion: data.methodologyVersion,
          items: data.items.create.map((it, i) => ({
            ...it,
            id: `item${i}`,
            status: "pending",
            resourceRef: null,
          })),
        };
        return {
          id: "prog1",
          items: state.created.items.map(({ id, orderIndex }) => ({
            id,
            orderIndex,
          })),
        };
      },
      findFirst: async () => state.created,
    },
    recommendationExposure: {
      createMany: async ({ data }: { data: unknown[] }) => {
        savedRecommendationExposures.set(db, data);
        return { count: data.length };
      },
    },
    $transaction: async (cb: (tx: unknown) => unknown) => cb(db),
  } as unknown as PrismaClient;

  return db;
}

const clock = fixedClock(1_700_000_000_000);

describe("generateAndSaveProgram + getTodayProgram (round-trip)", () => {
  it("persists a graded session for a fresh user and shapes the /today DTO", async () => {
    const db = fakeDb({ tacticalRating: 1300, minutesPerDay: 30 });

    const saved = await generateAndSaveProgram(db, "u1", clock);
    expect(saved).toEqual({
      programId: "prog1",
      reusedStartedProgram: false,
    });

    const persisted = savedGenerationInputs.get(db);
    const parsed = programGenerationInputSchema.parse(persisted);
    expect(parsed).toEqual(persisted);
    expect(parsed.weeklyFocus.id).toBe("focus1");
    expect(parsed.weeklyFocus.focusAreas.length).toBeGreaterThan(0);
    expect(savedRecommendationExposures.get(db)).toHaveLength(3);

    const today = await getTodayProgram(db, "u1");
    expect(today).not.toBeNull();
    expect(today!.scheduledDate).toEqual(new Date("2023-11-14T00:00:00Z"));
    expect(today!.methodologyVersion).toBe(ACTIVE_METHODOLOGY_VERSION);
    // Honest framing copy is surfaced (Seam 8).
    expect(today!.honesty.processGoal.length).toBeGreaterThan(0);
    expect(today!.honesty.expectations.length).toBeGreaterThan(0);

    // Same order as the generator golden at b1200_1600 / 30 min (Goal 1: time-divisible
    // puzzles fit a third item within the budget).
    expect(today!.items.map((i) => i.label)).toEqual([
      "Analyse your own games",
      "Themed tactics (reflective)",
      "Calculation / Visualisation drill",
    ]);

    // Every item carries a graded, snapshotted "why" (L3).
    for (const item of today!.items) {
      expect(item.rationaleText.length).toBeGreaterThan(0);
      expect(["A", "B", "C", "D"]).toContain(item.evidenceGrade);
      expect(item.citationSource).not.toBeNull(); // resolved from the ledger
    }

    // The puzzle item resolves an external Lichess URL from its theme (no seed needed).
    const tactics = today!.items.find(
      (i) => i.label === "Themed tactics (reflective)",
    )!;
    expect(tactics.externalUrl).toBe("https://lichess.org/training/fork");
    expect(tactics.params.targetRating).toBe(1150);
    // estMinutes is the visible time cap the packer ALLOTTED (Goal 1):
    // 15 pattern puzzles fit under a whole-minute 12 min cap.
    expect(tactics.estMinutes).toBe(12);
    expect(tactics.params.count).toBe(15);
    expect("dueItemRefs" in tactics.params).toBe(false);
  });

  it("returns null when no program has been generated", async () => {
    const db = fakeDb({ tacticalRating: 1300, minutesPerDay: 30 });
    expect(await getTodayProgram(db, "u1")).toBeNull();
  });

  it("renders a historic program with its persisted methodology version", async () => {
    const stub = loadMethodology("stub-0.1.0");
    const rationale = rationaleFor("play_games", stub);
    const db = fakeDb({
      initialProgram: {
        id: "historic-program",
        createdAt: new Date(0),
        methodologyVersion: "stub-0.1.0",
        items: [
          {
            id: "historic-item",
            orderIndex: 0,
            activityId: "play_games",
            activityType: "play_game",
            resourceRefId: null,
            params: { theme: null, track: null, estMinutes: 15 },
            dimensionsTargeted: ["tactics"],
            rationaleKey: rationale.key,
            rationaleText: rationale.value,
            evidenceGrade: rationale.grade,
            evidenceTier: rationale.tier,
            citationKey: rationale.citationKey,
            confidence: "low",
            soften: rationale.soften,
            status: "pending",
            resourceRef: null,
          },
        ],
      },
    });
    const requested: Array<string | undefined> = [];

    const today = await getTodayProgram(db, "u1", (version) => {
      requested.push(version);
      return loadMethodology(version);
    });

    expect(requested).toEqual(["stub-0.1.0"]);
    expect(today?.methodologyVersion).toBe("stub-0.1.0");
    expect(today?.items[0]?.rationaleText).toBe(rationale.value);
  });

  it("a due review surfaces a spaced-review item in the regenerated session (M7)", async () => {
    const db = fakeDb({
      tacticalRating: 1300,
      minutesPerDay: 60,
      dueRows: [
        { itemRef: "puzzle-a", itemType: "puzzle", due: new Date(0) },
        { itemRef: "puzzle-b", itemType: "puzzle", due: new Date(0) },
      ],
      puzzleRows: [
        { puzzleId: "puzzle-a", themes: ["fork", "mateIn2"] },
        { puzzleId: "puzzle-b", themes: ["fork"] },
      ],
    });
    await generateAndSaveProgram(db, "u1", clock);
    const today = await getTodayProgram(db, "u1");
    const review = today!.items.find((i) => i.activityType === "spaced_review");
    expect(review).toBeDefined();
    expect(review!.reviewThemes).toEqual(["Fork", "Mate in 2"]);
    expect("dueItemRefs" in review!.params).toBe(false);
  });

  it("falls back to neutral review details when due puzzle themes are unavailable", async () => {
    const db = fakeDb({
      tacticalRating: 1300,
      minutesPerDay: 60,
      dueRows: [{ itemRef: "opaque-id", itemType: "puzzle", due: new Date(0) }],
    });
    await generateAndSaveProgram(db, "u1", clock);
    const today = await getTodayProgram(db, "u1");
    const review = today!.items.find((i) => i.activityType === "spaced_review");
    expect(review).toBeDefined();
    expect(review!.reviewThemes).toEqual([]);
    expect("dueItemRefs" in review!.params).toBe(false);
  });

  it("uses the library band instead of tactical band to select owned books during program generation", async () => {
    const db = fakeDb({
      tacticalRating: 2100, // tactical band: b2000_2200
      minutesPerDay: 45,
      ratings: {
        blitz: { rating: 1100 }, // library band: b800_1200
      },
      ownedResources: [{ kind: "book", label: "polgar_5334" }],
    });
    await generateAndSaveProgram(db, "u1", clock);
    const today = await getTodayProgram(db, "u1");
    const bookItem = today!.items.find((i) => i.activityType === "book");
    expect(bookItem).toBeDefined();
    expect(bookItem!.bookResource?.id).toBe("polgar_5334");
  });
});
