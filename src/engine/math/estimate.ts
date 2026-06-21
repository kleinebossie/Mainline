// Generic running-proportion estimator (BUILD.md §7.4: the adaptation loop "updates
// SkillState"). Pure + science-free (L1): this is descriptive statistics — the observed
// success rate of a sequence of pass/fail trials and its standard error — not a graded
// chess decision. The Engine owns the arithmetic; what the proportion *means* (which
// dimension, when to act on it) is decided elsewhere. Updating incrementally lets the
// adaptation loop fold only the new events into a prior (estimate, sampleSize).

export interface ProportionEstimate {
  /** Observed success proportion in [0, 1]. */
  estimate: number;
  /** Standard error of the proportion: √(p·(1−p)/n) (0 when n = 0). */
  uncertainty: number;
  /** Total trials after folding in the new ones. */
  sampleSize: number;
}

/**
 * Fold `successes` out of `trials` new outcomes into a prior (estimate over priorN trials),
 * returning the updated proportion + its standard error. With no prior pass priorEstimate=0,
 * priorN=0. Deterministic (L2): a pure function of its numeric inputs.
 */
export function runningProportion(
  priorEstimate: number,
  priorN: number,
  successes: number,
  trials: number,
): ProportionEstimate {
  const n = priorN + trials;
  if (n === 0) return { estimate: 0, uncertainty: 0, sampleSize: 0 };
  const priorSuccesses = priorEstimate * priorN;
  const p = (priorSuccesses + successes) / n;
  const uncertainty = Math.sqrt((p * (1 - p)) / n);
  return { estimate: p, uncertainty, sampleSize: n };
}
