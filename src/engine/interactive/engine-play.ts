import type { AnalysisEngineAdapter, AnalysisLimit } from "@/analysis";
import type { Clock } from "@/lib/clock";
import { Chess } from "chess.js";

export interface EnginePlayOpponent {
  getOpponentMove(
    fen: string,
    limit: AnalysisLimit,
  ): Promise<{ san: string; uci: string; solveMs: number }>;
}

/**
 * Creates an opponent player harness over the client-side stockfish engine.
 * Pure given the injected adapter and Clock.
 */
export function createEnginePlay(
  adapter: AnalysisEngineAdapter,
  clock: Clock,
): EnginePlayOpponent {
  return {
    async getOpponentMove(fen: string, limit: AnalysisLimit) {
      const start = clock.now();
      const result = await adapter.analyzePosition(fen, limit);
      const end = clock.now();
      const solveMs = Math.max(0, end - start);

      if (!result.bestMove) {
        throw new Error("Engine failed to return a best move");
      }

      const uci = result.bestMove;
      const chess = new Chess(fen);

      // Convert UCI (e.g. "e2e4") to SAN (e.g. "e4") for UI and validation compatibility
      const from = uci.substring(0, 2);
      const to = uci.substring(2, 4);
      const promotion = uci.length > 4 ? uci.substring(4, 5) : undefined;

      const moveResult = chess.move({ from, to, promotion });

      return {
        san: moveResult.san,
        uci,
        solveMs,
      };
    },
  };
}
