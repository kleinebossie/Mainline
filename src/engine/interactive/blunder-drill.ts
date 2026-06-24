// Personalised blunder-drill derivation (BUILD.md M12) — PURE (L2), science-free (L1). Turns
// the user's own blundered positions (RawGameFeatures.blunders[]) into trainable PracticeItem
// drafts: each is the position the user faced before the blunder + the engine's best move as
// the solution line, validated on the board by `stepSolve`. Deterministic given its inputs —
// the blunder severity floor is a config value the caller passes in (the engine takes the
// number, never owns it), and the best moves are computed CLIENT-SIDE by Stockfish upstream.

/** One trainable in-app blunder drill, before persistence as a PracticeItem (§5.3). */
export interface PracticeItemDraft {
  kind: "blunder_drill";
  /** The position the solver faces (the position BEFORE the user's blundered move). */
  fen: string;
  /** The known answer: the engine's best move(s) here, as UCI — what the solver must find. */
  solutionLine: string[];
  /** Idempotency key tying the drill to its origin: "blunder:<gameId>:<ply>". */
  sourceRef: string;
}

export interface BlunderDrillInput {
  gameId: string;
  /** The user's blundered positions (analysis emits these, user-only, with the position FEN). */
  blunders: ReadonlyArray<{ ply: number; fen: string; cpLoss: number }>;
  /** The engine's best move (UCI) at each blunder ply — computed client-side, passed in so
   *  this stays a pure function (no engine call here). A ply with no entry is skipped. */
  bestMoveByPly: Readonly<Record<number, string>>;
}

/**
 * Derive blunder-drill drafts from a game's blunders. Deterministic: ply-ascending, deduped
 * by ply, keeping only blunders that (a) clear the config-supplied severity floor `minCpLoss`,
 * (b) carry a position FEN, and (c) have a resolved best move. Same (inputs, minCpLoss) → same
 * drafts, so it is golden-testable (§13.1).
 */
export function deriveBlunderDrills(
  input: BlunderDrillInput,
  opts: { minCpLoss: number },
): PracticeItemDraft[] {
  const seen = new Set<number>();
  return [...input.blunders]
    .sort((a, b) => a.ply - b.ply)
    .filter((b) => {
      if (seen.has(b.ply)) return false;
      if (b.cpLoss < opts.minCpLoss) return false;
      if (!b.fen) return false;
      if (!input.bestMoveByPly[b.ply]) return false;
      seen.add(b.ply);
      return true;
    })
    .map((b) => ({
      kind: "blunder_drill" as const,
      fen: b.fen,
      solutionLine: [input.bestMoveByPly[b.ply]!],
      sourceRef: `blunder:${input.gameId}:${b.ply}`,
    }));
}
