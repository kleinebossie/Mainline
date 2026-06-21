// Generic Glicko-2 confidence-interval math (BUILD.md §2.8: detectPlateau / isProgressReal
// "may call glickoConfidenceInterval"). Pure + science-free (L1): a rating is a distribution,
// not a number, and a rating ± multiplier·RD is its confidence band. The multiplier (≈1.96
// for 95%) is supplied by the caller from the Seam-Measurement config — this util only does
// the arithmetic (METHODOLOGY Measurement (a), Glickman 2012).

export interface ConfidenceInterval {
  lower: number;
  upper: number;
}

/** The rating's confidence interval: [R − k·RD, R + k·RD] for CI multiplier `k`. */
export function glickoConfidenceInterval(
  rating: number,
  rd: number,
  ciMultiplier: number,
): ConfidenceInterval {
  const half = ciMultiplier * rd;
  return { lower: rating - half, upper: rating + half };
}
