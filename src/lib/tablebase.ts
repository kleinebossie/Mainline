// Tablebase boundary types (BUILD.md §5.3, §6.6, M13). Shared by the Lichess tablebase
// adapter, the DB cache, the server lookup, and the endgame surface — one validation truth
// (BUILD.md §3), like lib/tracker.ts. These are RAW ground-truth facts about a position
// (theoretical result + distance + best move), never a graded recommendation: the tablebase
// is a correctness ORACLE, not chess methodology.

import { z } from "zod";

/** The parsed, cache-shaped result of a Lichess tablebase probe for one FEN. */
export const tablebaseResultSchema = z
  .object({
    // Raw Lichess category from the side-to-move perspective: win | draw | loss |
    // cursed-win | blessed-loss | maybe-win | maybe-loss | unknown.
    category: z.string(),
    dtz: z.number().nullable(),
    dtm: z.number().nullable(),
    checkmate: z.boolean(),
    stalemate: z.boolean(),
    // Best move for the side to move (UCI) — Lichess sorts moves best-first; null if none.
    bestMove: z.string().nullable(),
    bestMoveSan: z.string().nullable(),
  })
  .strict();
export type TablebaseResult = z.infer<typeof tablebaseResultSchema>;

/** The practical theoretical verdict for the side to move, collapsing the 50-move-rule
 *  half-categories: a "cursed win" / "blessed loss" is a draw in practice. */
export type TablebaseVerdict = "win" | "draw" | "loss" | "unknown";

export function tablebaseVerdict(category: string): TablebaseVerdict {
  switch (category) {
    case "win":
    case "maybe-win":
      return "win";
    case "loss":
    case "maybe-loss":
      return "loss";
    case "draw":
    case "cursed-win": // winnable in theory but the 50-move rule forces a draw
    case "blessed-loss": // lost in theory but the 50-move rule saves the draw
      return "draw";
    default:
      return "unknown";
  }
}

/** Count non-empty squares in a FEN's piece-placement field — the tablebase only covers
 *  positions with ≤ 7 pieces, so we never probe (or cache) larger positions. */
export function fenPieceCount(fen: string): number {
  const placement = fen.split(/\s+/)[0] ?? "";
  let count = 0;
  for (const ch of placement) {
    if (/[pnbrqkPNBRQK]/.test(ch)) count += 1;
  }
  return count;
}

/** The most pieces the Lichess standard tablebase covers (infra constant, not methodology). */
export const TABLEBASE_MAX_PIECES = 7;
