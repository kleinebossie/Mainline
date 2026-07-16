import { describe, expect, it } from "vitest";

import {
  MAX_ANALYSIS_BLUNDERS,
  MAX_ANALYSIS_PLIES,
  rawGameFeaturesSchema,
} from "@/lib/raw-features";
import {
  analysisSessionInputSchema,
  MAX_SESSION_OUTCOMES,
} from "@/server/routers/analysis";

const baseFeatures = {
  acplOverall: 0,
  acplByPhase: { opening: 0, middlegame: 0, endgame: 0 },
  phaseBoundaries: { openingEndsPly: 20, endgameStartsPly: 60 },
  moveEvals: [],
  blunders: [],
  errorCounts: {
    inaccuracies: 0,
    mistakes: 0,
    blunders: 0,
    grossBlunders: 0,
  },
};

describe("analysis payload limits", () => {
  it("rejects oversized raw feature arrays", () => {
    const moveEval = { ply: 1, cpBefore: 0, cpAfter: 0, cpLoss: 0 };
    const blunder = { ply: 1, fen: "8/8/8/8/8/8/8/8 w - - 0 1", cpLoss: 1 };

    expect(
      rawGameFeaturesSchema.safeParse({
        ...baseFeatures,
        moveEvals: Array.from(
          { length: MAX_ANALYSIS_PLIES + 1 },
          () => moveEval,
        ),
      }).success,
    ).toBe(false);
    expect(
      rawGameFeaturesSchema.safeParse({
        ...baseFeatures,
        blunders: Array.from(
          { length: MAX_ANALYSIS_BLUNDERS + 1 },
          () => blunder,
        ),
      }).success,
    ).toBe(false);
  });

  it("rejects oversized sessions and duplicate reviewed plies", () => {
    const baseInput = {
      gameId: "game-1",
      requestId: "2c164f2f-8494-4b7e-8243-0a11c35e2038",
      reflectionNote: "I rushed the position.",
    };

    expect(
      analysisSessionInputSchema.safeParse({
        ...baseInput,
        outcomes: Array.from(
          { length: MAX_SESSION_OUTCOMES + 1 },
          (_, index) => ({ ply: index + 1, correct: false }),
        ),
      }).success,
    ).toBe(false);
    expect(
      analysisSessionInputSchema.safeParse({
        ...baseInput,
        outcomes: [
          { ply: 12, correct: false },
          { ply: 12, correct: true },
        ],
      }).success,
    ).toBe(false);
  });
});
