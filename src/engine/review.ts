// Interactive game review (BUILD.md M12) — PURE (L2) and science-free (L1). Projects the
// raw per-move evals (analysis emits them, mover's-perspective cp) into a user-perspective
// "advantage graph" the ReviewBoard renders. It judges no chess merit — it only re-bases the
// signs and marks which plies the upstream analysis already flagged as the user's blunders.
// No clock, no randomness, no config: a deterministic transform of (moveEvals, userColor).

import type { RawGameFeatures } from "@/lib/raw-features";

export interface EvalGraphPoint {
  ply: number;
  /** Centipawns after this half-move, from the USER's perspective (positive = user better).
   *  Mate already arrives capped in `cpAfter`, so the curve stays bounded. */
  cp: number;
  /** True when this half-move was the user's (the only plies that can be blunders/drills). */
  userMove: boolean;
  /** Centipawns the user lost on this move (0 on opponent moves). */
  cpLoss: number;
  /** True when this ply is one the upstream analysis flagged as a user blunder. */
  blunder: boolean;
}

/** Whether the mover at half-move `ply` (1-based) is the user. The mover faces position
 *  ply−1; position 0 is White to move, so White moves on odd plies. Pure parity — no board. */
export function userIsMover(ply: number, userColor: "w" | "b"): boolean {
  return (userColor === "w") === (ply % 2 === 1);
}

/**
 * Project the raw move evals into a user-perspective advantage curve. `cpAfter` is the
 * mover's-perspective eval after their move; for an opponent move we negate it so the whole
 * series is one consistent "how good is it for the user" line. Blunder marks come from the
 * supplied `blunderPlies` (the upstream `blunders[]`, already user-only + thresholded) — so
 * this projection holds no blunder threshold of its own (L1: the science stays in analysis).
 */
export function projectEvalGraph(
  moveEvals: RawGameFeatures["moveEvals"],
  userColor: "w" | "b",
  blunderPlies: ReadonlySet<number>,
): EvalGraphPoint[] {
  return moveEvals.map((m) => {
    const userMove = userIsMover(m.ply, userColor);
    return {
      ply: m.ply,
      cp: userMove ? m.cpAfter : -m.cpAfter,
      userMove,
      cpLoss: userMove ? m.cpLoss : 0,
      blunder: userMove && blunderPlies.has(m.ply),
    };
  });
}
