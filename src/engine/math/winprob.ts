// Win-probability from a centipawn eval — a generic, pure scale conversion (BUILD.md §7,
// engine/math). PURE & science-free (L2/L1): it is the published Lichess "Win%" logistic,
// a *measurement convention* for putting evals on a 0..1 scale, NOT a graded chess decision
// (the same class as the FSRS/Glicko math that also lives here). What COUNTS as a mistake
// (the threshold on a win-probability drop) is graded methodology — this file only does the
// arithmetic.
//
// Why this exists: centipawns are linear, but a decided position saturates — a forced mate
// and "+6 and still winning" win equally in practice, especially below master level. The
// logistic makes that explicit: winProb(1000) ≈ winProb(10000) ≈ 1, so missing a forced
// mate while staying winning is a ~0 win-probability drop, where the raw cp difference is a
// meaningless ~99000. Measuring move severity as the DROP in win-probability is therefore
// rating-robust and mate-safe, which is exactly what the analysis/diagnosis layers need.

/** The Lichess Win% logistic constant (Win% = 100 / (1 + e^(-k·cp))). */
const WIN_PROB_K = 0.00368208;

/**
 * Win probability (0..1) for a centipawn eval from the scored side's perspective.
 * 0.5 at equality, saturating toward 1 (winning) / 0 (losing). Mate scores fold into a
 * large cp magnitude upstream and saturate here automatically.
 */
export function winProb(cp: number): number {
  if (!Number.isFinite(cp)) return cp > 0 ? 1 : 0;
  return 1 / (1 + Math.exp(-WIN_PROB_K * cp));
}

/** Win probability for an explicit eval where a forced mate is signalled separately
 *  (mate ⇒ 1 if winning, 0 if being mated; otherwise the logistic of `cp`). */
export function evalToWinProb(e: {
  cp: number;
  mate?: number | null;
}): number {
  if (e.mate != null && e.mate !== 0) return e.mate > 0 ? 1 : 0;
  return winProb(e.cp);
}

/** How much win probability a move gave away (scored side), clamped to ≥ 0. The saturating
 *  severity measure: ~0 for a missed mate that stays winning, large for a real swing. */
export function winProbDrop(beforeCp: number, afterCp: number): number {
  return Math.max(0, winProb(beforeCp) - winProb(afterCp));
}
