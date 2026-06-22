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

/** One line of a multi-PV search: a principal variation with its eval, same perspective
 *  conventions as EvalResult. `rank` is the 1-based MultiPV index (1 = engine's best). */
export interface EvalLine {
  /** Principal variation as UCI long-algebraic moves, best first. */
  pv: string[];
  /** Centipawns from the side-to-move's view (0 when `mate` is set). */
  scoreCp: number;
  /** Moves-to-mate from the side-to-move's view (+ mating, − being mated), else null. */
  mate: number | null;
  /** Search depth reached for this line. */
  depth: number;
  /** 1-based MultiPV rank (1 = engine's best line). */
  rank: number;
}

/** Search bound for one position/game. At least one of depth/movetime should be set; the
 *  adapter applies an infrastructure default if neither is (keeps the UI responsive, §6.5).
 *  `multiPv` (≥1) asks for that many ranked lines from `analyzeLines` (ignored elsewhere). */
export interface AnalysisLimit {
  depth?: number;
  movetimeMs?: number;
  multiPv?: number;
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
  /** Evaluate one FEN with MultiPV, returning up to `limit.multiPv` ranked real lines
   *  (best first). Never fabricates lines: returns only what the engine reports. */
  analyzeLines(fen: string, limit: AnalysisLimit): Promise<EvalLine[]>;
  /** Walk a PGN, evaluate each position, and assemble RAW features (L1). */
  analyzeGame(
    pgn: string,
    limit: AnalysisLimit,
    ctx: AnalyzeGameContext,
  ): Promise<RawGameFeatures>;
  /** Tear down the worker and free WASM memory. */
  dispose(): void;
}
