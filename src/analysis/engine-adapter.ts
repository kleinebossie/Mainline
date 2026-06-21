// AnalysisEngineAdapter — the typed boundary around the client-side chess engine
// (Stockfish WASM), BUILD.md §6.5. The Engine talks to "the chess engine" only through
// this interface, so the transport (Web Worker, UCI protocol, which WASM flavour) can
// change without touching callers. The adapter emits RAW features only (L1): it never
// labels a move good/bad — interpretation is Seam 3.

import type { RawGameFeatures } from "@/lib/raw-features";

/** Side identifiers, matching chess.js and ImportedGame.color. */
export type Color = "w" | "b";

/**
 * A single position evaluation, normalised to the SIDE-TO-MOVE's perspective (positive =
 * the player to move is better). Exactly one of `cp`/`mate` is the real signal; the engine
 * reports `mate` for forced mates, otherwise `cp`.
 */
export interface EvalResult {
  /** Centipawns from the side-to-move's view (NaN/absent when `mate` is set). */
  scoreCp: number;
  /** Moves-to-mate from the side-to-move's view (+ mating, − being mated), else null. */
  mate: number | null;
  /** Best move in UCI long algebraic (e.g. "e2e4"), when reported. */
  bestMove?: string;
  /** Search depth actually reached. */
  depth: number;
}

/** Search bound for one position/game. At least one of depth/movetime should be set; the
 *  adapter applies an infrastructure default if neither is (keeps the UI responsive, §6.5). */
export interface AnalysisLimit {
  depth?: number;
  movetimeMs?: number;
}

/** Extra context analyzeGame needs that the PGN alone doesn't carry: which side is the
 *  user being profiled (game result is read from the PGN's Result header). A deliberate,
 *  documented extension of the §6.5 sketch `analyzeGame(pgn, limit)` — aggregates such as
 *  ACPL/blunders/conversion are user-centric, so the producer must know the user's color. */
export interface AnalyzeGameContext {
  userColor: Color;
}

export interface AnalysisEngineAdapter {
  /** Boot the engine. `threads` is ignored by the single-thread fallback build. */
  init(opts: { threads: number; hashMb: number }): Promise<void>;
  /** Evaluate one FEN to the given bound; resolves with a side-to-move-relative eval. */
  analyzePosition(fen: string, limit: AnalysisLimit): Promise<EvalResult>;
  /** Walk a PGN, evaluate each position, and assemble RAW features (L1). */
  analyzeGame(
    pgn: string,
    limit: AnalysisLimit,
    ctx: AnalyzeGameContext,
  ): Promise<RawGameFeatures>;
  /** Tear down the worker and free WASM memory. */
  dispose(): void;
}
