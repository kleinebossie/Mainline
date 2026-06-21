// Generic servo controller (BUILD.md §2.8: targetPuzzleRating "may call servo controller
// (generic)"). Pure math, science-free (L1): the Engine owns the control algorithm; every
// number (seed, gain, target) is supplied by the caller from config.
//
// Success rate is the control variable, the puzzle-rating offset is the actuator
// (METHODOLOGY Seam 5). When measured success exceeds the target the items are too easy,
// so the offset rises (harder puzzles); when it falls short the offset drops (easier). At
// measured == target (or no measurement yet) the offset is exactly the seed.

/**
 * Adjust a seed rating-offset toward the success target.
 * `successToRating` converts a success-rate error (measured − target) into rating points.
 */
export function servoOffset(
  seedOffset: number,
  measuredSuccess: number,
  targetSuccess: number,
  successToRating: number,
): number {
  return seedOffset + (measuredSuccess - targetSuccess) * successToRating;
}
