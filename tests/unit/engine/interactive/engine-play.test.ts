import { describe, expect, it, vi } from "vitest";

import type { AnalysisEngineAdapter, EvalResult } from "@/analysis";
import { createEnginePlay } from "@/engine/interactive/engine-play";

describe("createEnginePlay", () => {
  const startFen = "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1";

  it("converts UCI bestMove to SAN and records solve time", async () => {
    let currentTime = 1_000;
    const clock = { now: () => currentTime };
    const analyzePosition = vi.fn().mockImplementation(async () => {
      currentTime += 350;
      return {
        bestMove: "e2e4",
        scoreCp: 20,
        mate: null,
        depth: 10,
      } as EvalResult;
    });

    const adapter: AnalysisEngineAdapter = {
      analyzePosition,
      dispose: vi.fn(),
      init: vi.fn(),
      analyzeLines: vi.fn(),
      analyzeGame: vi.fn(),
    };

    const enginePlay = createEnginePlay(adapter, clock);
    const result = await enginePlay.getOpponentMove(startFen, {
      movetimeMs: 500,
    });

    expect(analyzePosition).toHaveBeenCalledWith(startFen, { movetimeMs: 500 });
    expect(result).toEqual({
      san: "e4",
      uci: "e2e4",
      solveMs: 350,
    });
  });

  it("converts pawn promotion UCI to SAN", async () => {
    const promotionFen = "8/4P3/8/8/8/8/k6K/8 w - - 0 1";
    const clock = { now: () => 1_000 };
    const analyzePosition = vi.fn().mockResolvedValue({
      bestMove: "e7e8q",
      scoreCp: 1000,
      mate: 1,
      depth: 10,
    } as EvalResult);

    const adapter: AnalysisEngineAdapter = {
      analyzePosition,
      dispose: vi.fn(),
      init: vi.fn(),
      analyzeLines: vi.fn(),
      analyzeGame: vi.fn(),
    };

    const enginePlay = createEnginePlay(adapter, clock);
    const result = await enginePlay.getOpponentMove(promotionFen, {
      depth: 10,
    });

    expect(result).toEqual({
      san: "e8=Q",
      uci: "e7e8q",
      solveMs: 0,
    });
  });

  it("converts black moves accurately", async () => {
    const blackToMoveFen =
      "rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq e3 0 1";
    const clock = { now: () => 1_000 };
    const analyzePosition = vi.fn().mockResolvedValue({
      bestMove: "g8f6",
      scoreCp: -15,
      mate: null,
      depth: 8,
    } as EvalResult);

    const adapter: AnalysisEngineAdapter = {
      analyzePosition,
      dispose: vi.fn(),
      init: vi.fn(),
      analyzeLines: vi.fn(),
      analyzeGame: vi.fn(),
    };

    const enginePlay = createEnginePlay(adapter, clock);
    const result = await enginePlay.getOpponentMove(blackToMoveFen, {
      depth: 8,
    });

    expect(result).toEqual({
      san: "Nf6",
      uci: "g8f6",
      solveMs: 0,
    });
  });

  it("throws when the engine does not return a best move", async () => {
    const clock = { now: () => 1_000 };
    const analyzePosition = vi.fn().mockResolvedValue({
      bestMove: undefined,
      scoreCp: 0,
      mate: null,
      depth: 1,
    } as unknown as EvalResult);

    const adapter: AnalysisEngineAdapter = {
      analyzePosition,
      dispose: vi.fn(),
      init: vi.fn(),
      analyzeLines: vi.fn(),
      analyzeGame: vi.fn(),
    };

    const enginePlay = createEnginePlay(adapter, clock);
    await expect(
      enginePlay.getOpponentMove(startFen, { depth: 1 }),
    ).rejects.toThrow("Engine failed to return a best move");
  });
});
