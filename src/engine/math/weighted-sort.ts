// Generic stable sort by a numeric score, descending, with a string tiebreak (BUILD.md
// §2.8: prioritizeDailyMix "may call weighted-sort (generic)"). Pure + deterministic
// (L2): equal scores fall back to the tiebreak so the result never depends on input order
// or the engine's array-sort stability. Science-free (L1) — the score function (which
// reads config weights) is supplied by the caller in the Methodology layer.

export function stableSortByScoreDesc<T>(
  items: readonly T[],
  score: (item: T) => number,
  tiebreak: (item: T) => string,
): T[] {
  return [...items].sort((a, b) => {
    const byScore = score(b) - score(a);
    if (byScore !== 0) return byScore;
    const ta = tiebreak(a);
    const tb = tiebreak(b);
    return ta < tb ? -1 : ta > tb ? 1 : 0;
  });
}
