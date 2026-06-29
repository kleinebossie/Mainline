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
        findFirst: async () => null,
      },
      // M14: the calibration board reads the user's play medium (targetFocus) for its interface
      // restrictions; with no saved constraints it defaults to "online".
      constraintSet: {
        findFirst: async () => null,
      },
      lichessPuzzle: {
        findMany: async () => {
          // Filter to simulate selectPuzzles behavior roughly
          return puzzlesPool.filter((p) => {
            const excludeIds = savedResponses
              ? savedResponses.map((r) => r.puzzleId)
              : [];
            return !excludeIds.includes(p.puzzleId);
          });
        },
      },
    } as unknown as PrismaClient;

    // 1. Initial State: activePuzzle should be selected from the pool
    const state1 = await getCalibrationState(db, "user-1");
    expect(state1.activePuzzle).not.toBeNull();
    const firstPuzzleId = state1.activePuzzle!.puzzleId;
    expect(["p1", "p2", "p3"]).toContain(firstPuzzleId);

    // 2. Deterministic check: same user gets the same puzzle
    const state1b = await getCalibrationState(db, "user-1");
    expect(state1b.activePuzzle!.puzzleId).toBe(firstPuzzleId);

    // 3. Apply Calibration Response (Solve it!)
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

    // Verify response was saved and the solved puzzle is excluded, yielding a new active puzzle
    expect(savedResponses).not.toBeNull();
    expect(savedResponses).toHaveLength(1);
    expect(savedResponses![0]!.puzzleId).toBe(firstPuzzleId);
    expect(savedResponses![0]!.correct).toBe(true);

    expect(state2.activePuzzle).not.toBeNull();
    expect(state2.activePuzzle!.puzzleId).not.toBe(firstPuzzleId);
  });
});
