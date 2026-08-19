import { describe, expect, it } from "vitest";
import type { LichessPuzzle, PrismaClient } from "@prisma/client";
import {
  getCalibrationState,
  applyCalibrationResponse,
} from "@/server/assessment";

interface StoredResponse {
  track: string;
  ratingShown: number;
  correct: boolean;
  puzzleId?: string;
}

function mockPuzzle(
  puzzleId: string,
  rating: number,
  theme: string,
): LichessPuzzle {
  return {
    puzzleId,
    fen: "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1",
    moves: "e2e4 e7e5",
    rating,
    ratingDeviation: 50,
    popularity: 90,
    nbPlays: 100,
    themes: [theme],
    gameUrl: null,
    openingTags: [],
    createdAt: new Date(0),
    updatedAt: new Date(0),
  };
}

describe("calibration-puzzle test", () => {
  it("selects active puzzle deterministically and applies calibration response", async () => {
    let savedResponses: StoredResponse[] | null = null;
    const puzzlesPool = [
      mockPuzzle("p1", 1200, "fork"),
      mockPuzzle("p2", 1210, "fork"),
      mockPuzzle("p3", 1220, "fork"),
    ];

    const db = {
      assessment: {
        findUnique: async () => {
          return savedResponses
            ? { calibrationResponses: savedResponses, completedAt: null }
            : null;
        },
        upsert: async ({
          create,
        }: {
          create: { calibrationResponses: StoredResponse[] };
        }) => {
          savedResponses = create.calibrationResponses;
          return {};
        },
      },
      chessProfileSnapshot: {
        findMany: async () => [],
        findFirst: async () => null,
      },
      platformConnection: {
        findMany: async () => [{ platform: "lichess" }],
      },
      // With no saved constraints, target focus defaults to online.
      constraintSet: {
        findFirst: async () => null,
      },
      lichessPuzzle: {
        findMany: async ({
          where,
        }: {
          where: { puzzleId?: { notIn?: string[] } };
        }) =>
          puzzlesPool.filter(
            (p) => !where.puzzleId?.notIn?.includes(p.puzzleId),
          ),
      },
    } as unknown as PrismaClient;

    const state1 = await getCalibrationState(db, "user-1");
    expect(state1.activePuzzle).not.toBeNull();
    const firstPuzzleId = state1.activePuzzle!.puzzleId;
    expect(["p1", "p2", "p3"]).toContain(firstPuzzleId);

    const state1b = await getCalibrationState(db, "user-1");
    expect(state1b.activePuzzle!.puzzleId).toBe(firstPuzzleId);

    const date = new Date();
    const state2 = await applyCalibrationResponse(
      db,
      "user-1",
      {
        ratingShown: state1.activeTrack!.next.ratingTarget,
        correct: true,
        puzzleId: firstPuzzleId,
      },
      date,
    );

    expect(savedResponses).not.toBeNull();
    expect(savedResponses).toHaveLength(1);
    expect(savedResponses![0]!.puzzleId).toBe(firstPuzzleId);
    expect(savedResponses![0]!.correct).toBe(true);

    expect(state2.activePuzzle).not.toBeNull();
    expect(state2.activePuzzle!.puzzleId).not.toBe(firstPuzzleId);
  });

  it("continues a historic partial assessment under its persisted methodology", async () => {
    const historicResponses: StoredResponse[] = [
      { track: "tactics", ratingShown: 1200, correct: true },
      { track: "tactics", ratingShown: 1250, correct: false },
      { track: "tactics", ratingShown: 1050, correct: true },
    ];
    const db = {
      assessment: {
        findUnique: async () => ({
          calibrationResponses: historicResponses,
          completedAt: null,
          methodologyVersion: "research-1.1.0",
        }),
      },
      chessProfileSnapshot: {
        findMany: async () => [],
        findFirst: async () => null,
      },
      platformConnection: {
        findMany: async () => [{ platform: "lichess" }],
      },
      constraintSet: { findFirst: async () => null },
      lichessPuzzle: { findMany: async () => [] },
    } as unknown as PrismaClient;


    const state = await getCalibrationState(db, "historic-user");

    expect(state.completed).toBe(false);
    expect(state.trackCount).toBe(3);
    expect(state.maxItems).toBe(12);
    expect(state.activeTrack?.id).toBe("tactics");
    expect(state.activeTrack?.responseCount).toBe(3);
  });
});
