// Pure raw-feature extraction (BUILD.md §5.2, §7.2). Given a PGN, a per-position eval
// trace, and which side is the user, compute the RawGameFeatures contract.
//
// PURE & DETERMINISTIC (L2): no clock, no randomness, no I/O. The engine's evals are an
// INPUT, so the whole function is golden-testable in Node without running WASM. The
// adapter (stockfish-adapter.ts) collects the evals from the real engine and calls this.
//
// RAW ONLY (L1): every number is a measurement. Nothing here decides whether a result is
// "good", a "weakness", or worth training — that is Seam 3 (interpretGameFeatures), which
// consumes this output. The few scalars used (cp-loss buckets, phase split) are universal
// measurement conventions documented in thresholds.ts, not graded methodology.
//
// Sign convention: centipawns are from the MOVER's perspective (see lib/raw-features.ts).
// The engine reports each position from the SIDE-TO-MOVE's view, and the neat identity
// cpLoss = score(before) + score(afterFromOpponent) falls out of that — see below.

import { Chess } from "chess.js";

import type {
  Blunder,
  ClockEntry,
  MoveEval,
  RawGameFeatures,
} from "@/lib/raw-features";
import type { Color } from "@/analysis/engine-adapter";
import {
  CP_CLAMP,
  CP_LOSS,
  ENDGAME_NONPAWN_MATERIAL,
  MATE_MAX_DISTANCE,
  MATE_SCORE_CP,
  OPENING_PLY_CAP,
  PIECE_VALUE,
  WINNING_CP,
} from "@/analysis/thresholds";

/** One position's engine eval, side-to-move perspective (what the adapter collects). */
export interface PositionEval {
  /** Centipawns, side-to-move POV. Ignored when `mate` is non-null. */
  cp: number | null;
  /** Moves-to-mate, side-to-move POV (+ mating, − being mated), else null. */
  mate: number | null;
}

export interface ExtractFeaturesInput {
  pgn: string;
  /** Evals aligned to positions p0..pN (length = moveCount + 1; p0 is the start position). */
  evals: readonly PositionEval[];
  /** The player being profiled; aggregates (ACPL, blunders, conversion) cover their moves. */
  userColor: Color;
}

type Phase = "opening" | "middlegame" | "endgame";

function round2(x: number): number {
  return Math.round(x * 100) / 100;
}

function cap(cp: number): number {
  return Math.max(-CP_CLAMP, Math.min(CP_CLAMP, cp));
}

/** Normalise an eval to a centipawn scalar (side-to-move POV), folding mate into a large
 *  bounded value so a forced mate compares sensibly against material evals. */
function evalToCp(e: PositionEval): number {
  if (e.mate !== null) {
    const dist = Math.min(Math.abs(e.mate), MATE_MAX_DISTANCE);
    const sign = e.mate > 0 ? 1 : -1;
    return sign * (MATE_SCORE_CP - dist);
  }
  return e.cp ?? 0;
}

/** Total non-pawn material (both sides, pawn units) from a FEN's piece-placement field. */
function nonPawnMaterial(fen: string): number {
  const placement = fen.split(" ")[0] ?? "";
  let total = 0;
  for (const ch of placement) {
    const v = PIECE_VALUE[ch.toLowerCase()];
    if (v !== undefined) total += v;
  }
  return total;
}

const mean = (xs: readonly number[]): number =>
  xs.length === 0 ? 0 : round2(xs.reduce((s, x) => s + x, 0) / xs.length);

/** Parse a single `[%clk H:MM:SS(.f)]` (or `MM:SS`) comment to milliseconds. */
function parseClk(comment: string): number | null {
  const hms = comment.match(/\[%clk\s+(\d+):(\d+):(\d+(?:\.\d+)?)\]/);
  if (hms) {
    return Math.round(
      (Number(hms[1]) * 3600 + Number(hms[2]) * 60 + Number(hms[3])) * 1000,
    );
  }
  const ms = comment.match(/\[%clk\s+(\d+):(\d+(?:\.\d+)?)\]/);
  if (ms) return Math.round((Number(ms[1]) * 60 + Number(ms[2])) * 1000);
  return null;
}

/** Parse a PGN TimeControl tag ("300+3", "600", …) to base/increment milliseconds. */
function parseTimeControl(tc?: string): { baseMs: number; incMs: number } {
  const m = tc?.match(/^(\d+)(?:\+(\d+))?$/);
  if (!m) return { baseMs: 0, incMs: 0 };
  return { baseMs: Number(m[1]) * 1000, incMs: Number(m[2] ?? 0) * 1000 };
}

/** Best-effort per-ply clock from `%clk` comments; null if the PGN carries no clocks. */
function extractClock(chess: Chess): ClockEntry[] | null {
  const comments = chess.getComments();
  if (comments.length === 0) return null;
  const clkByFen = new Map<string, number>();
  for (const { fen, comment } of comments) {
    const ms = parseClk(comment);
    if (ms !== null) clkByFen.set(fen, ms);
  }
  if (clkByFen.size === 0) return null;

  const { baseMs, incMs } = parseTimeControl(chess.getHeaders().TimeControl);
  const lastRemaining: Record<Color, number> = { w: baseMs, b: baseMs };
  const moves = chess.history({ verbose: true });
  const out: ClockEntry[] = [];
  for (let i = 1; i <= moves.length; i++) {
    const move = moves[i - 1]!;
    const remaining = clkByFen.get(move.after);
    if (remaining === undefined) continue;
    const color = move.color as Color;
    const spent = Math.max(0, lastRemaining[color] + incMs - remaining);
    out.push({ ply: i, remainingMs: remaining, spentMs: spent });
    lastRemaining[color] = remaining;
  }
  return out.length > 0 ? out : null;
}

/**
 * Compute the RawGameFeatures (§5.2) for one game. `moveEvals` is the full raw trace (every
 * ply); the aggregates (ACPL, error counts, blunders, conversion, opening deviation) are
 * computed over the USER's moves only — the player we coach.
 */
export function extractFeatures(input: ExtractFeaturesInput): RawGameFeatures {
  const { pgn, evals, userColor } = input;
  const chess = new Chess();
  chess.loadPgn(pgn);
  const moves = chess.history({ verbose: true });
  const n = moves.length;

  // Positions p0..pN. p0 is the start (move 1's `before`); p_i is move i's `after`.
  const startFen = n > 0 ? moves[0]!.before : chess.fen();
  const fenAt = (k: number): string =>
    k === 0 ? startFen : moves[k - 1]!.after;
  const evalAt = (k: number): PositionEval => evals[k] ?? { cp: 0, mate: null };
  const isUserPly = (ply: number): boolean =>
    userColor === "w" ? ply % 2 === 1 : ply % 2 === 0;

  // --- Phase split (material-based measurement convention) ---
  // The endgame starts at the first move whose FACED position is at/under the threshold.
  let endgameStartsPly = n + 1;
  for (let i = 1; i <= n; i++) {
    if (nonPawnMaterial(fenAt(i - 1)) <= ENDGAME_NONPAWN_MATERIAL) {
      endgameStartsPly = i;
      break;
    }
  }
  const openingEndsPly = Math.max(
    0,
    Math.min(OPENING_PLY_CAP, endgameStartsPly - 1),
  );
  const phaseOf = (ply: number): Phase =>
    ply <= openingEndsPly
      ? "opening"
      : ply >= endgameStartsPly
        ? "endgame"
        : "middlegame";

  // --- Per-move evals (all plies) + user-centric aggregates ---
  const moveEvals: MoveEval[] = [];
  const blunders: Blunder[] = [];
  const errorCounts = {
    inaccuracies: 0,
    mistakes: 0,
    blunders: 0,
    grossBlunders: 0,
  };
  const lossByPhase: Record<Phase, number[]> = {
    opening: [],
    middlegame: [],
    endgame: [],
  };
  const openingLosses: number[] = [];
  let firstDeviationPly = 0;

  for (let i = 1; i <= n; i++) {
    // Mover faces p_{i-1} (their POV); after the move the opponent faces p_i, so flip it.
    const cpBefore = cap(evalToCp(evalAt(i - 1)));
    const cpAfter = cap(-evalToCp(evalAt(i)));
    const cpLoss = Math.max(0, cpBefore - cpAfter);
    moveEvals.push({ ply: i, cpBefore, cpAfter, cpLoss });

    if (!isUserPly(i)) continue;
    const phase = phaseOf(i);
    lossByPhase[phase].push(cpLoss);

    if (cpLoss >= CP_LOSS.grossBlunder) errorCounts.grossBlunders += 1;
    else if (cpLoss >= CP_LOSS.blunder) errorCounts.blunders += 1;
    else if (cpLoss >= CP_LOSS.mistake) errorCounts.mistakes += 1;
    else if (cpLoss >= CP_LOSS.inaccuracy) errorCounts.inaccuracies += 1;

    if (cpLoss >= CP_LOSS.blunder) {
      blunders.push({ ply: i, fen: fenAt(i - 1), cpLoss });
    }
    if (phase === "opening") {
      openingLosses.push(cpLoss);
      if (firstDeviationPly === 0 && cpLoss >= CP_LOSS.inaccuracy) {
        firstDeviationPly = i;
      }
    }
  }

  // --- Conversion (user-POV eval reached across the whole game) ---
  let reachedWinningPlus = false;
  let reachedLosingMinus = false;
  for (let k = 0; k <= n; k++) {
    const sideToMove: Color = k % 2 === 0 ? "w" : "b";
    const stmCp = cap(evalToCp(evalAt(k)));
    const userCp = sideToMove === userColor ? stmCp : -stmCp;
    if (userCp >= WINNING_CP) reachedWinningPlus = true;
    if (userCp <= -WINNING_CP) reachedLosingMinus = true;
  }
  const result = chess.getHeaders().Result;
  const userWon =
    (result === "1-0" && userColor === "w") ||
    (result === "0-1" && userColor === "b");
  const userLost =
    (result === "1-0" && userColor === "b") ||
    (result === "0-1" && userColor === "w");

  const clock = extractClock(chess);

  return {
    acplOverall: mean([
      ...lossByPhase.opening,
      ...lossByPhase.middlegame,
      ...lossByPhase.endgame,
    ]),
    acplByPhase: {
      opening: mean(lossByPhase.opening),
      middlegame: mean(lossByPhase.middlegame),
      endgame: mean(lossByPhase.endgame),
    },
    phaseBoundaries: { openingEndsPly, endgameStartsPly },
    moveEvals,
    blunders,
    errorCounts,
    ...(clock ? { clock } : {}),
    conversion: {
      reachedWinningPlus,
      converted: reachedWinningPlus && userWon,
      reachedLosingMinus,
      saved: reachedLosingMinus && !userLost,
    },
    openingDeviation: {
      firstDeviationPly,
      earlyCpl: mean(openingLosses),
    },
  };
}
