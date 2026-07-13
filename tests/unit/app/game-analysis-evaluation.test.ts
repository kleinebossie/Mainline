import { describe, expect, it } from "vitest";

import type { EvalLine } from "@/analysis/engine-adapter";
import {
  pctBetterThanGame,
  pctWinChance,
  playerEvalAfter,
  rootEval,
  uciToSan,
} from "@/app/analysis/[gameId]/game-analysis-evaluation";

const STARTING_FEN = "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1";

function evalLine(overrides: Partial<EvalLine> = {}): EvalLine {
  return {
    pv: ["e2e4"],
    scoreCp: 120,
    mate: null,
    depth: 12,
    rank: 1,
    ...overrides,
  };
}

describe("game analysis evaluation", () => {
  it("normalizes engine scores to the reviewing player's perspective", () => {
    expect(rootEval(evalLine())).toBe(120);
    expect(playerEvalAfter(evalLine())).toBe(-120);
    expect(rootEval(evalLine({ mate: 2 }))).toBe(100_000);
    expect(rootEval(evalLine({ mate: -2 }))).toBe(-100_000);
    expect(playerEvalAfter(evalLine({ mate: -2 }))).toBe(100_000);
    expect(playerEvalAfter(evalLine({ mate: 2 }))).toBe(-100_000);
    expect(rootEval(undefined)).toBe(0);
    expect(playerEvalAfter(undefined)).toBe(-100_000);
  });

  it("bounds human-readable improvement percentages", () => {
    expect(pctBetterThanGame(200, 50)).toBe(75);
    expect(pctBetterThanGame(200, 300)).toBe(0);
    expect(pctBetterThanGame(200, -20)).toBe(100);
    expect(pctBetterThanGame(0, 0)).toBeNull();
    expect(pctBetterThanGame(50_000, 0)).toBeNull();
    expect(pctWinChance(0.126)).toBe(13);
    expect(pctWinChance(-0.1)).toBe(0);
  });

  it("converts legal UCI moves to SAN and preserves invalid input", () => {
    expect(uciToSan(STARTING_FEN, "e2e4")).toBe("e4");
    expect(uciToSan(STARTING_FEN, "bad")).toBe("bad");
    expect(uciToSan(STARTING_FEN, "e2e5")).toBe("e2e5");
  });
});
