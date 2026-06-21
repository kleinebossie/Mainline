// Measurement conventions for raw feature extraction (BUILD.md §5.2, §7.2).
//
// L1 BOUNDARY — read this before "fixing" these into MethodologyConfig. These constants
// define WHAT WE MEASURE, not WHAT IT MEANS. They are universal annotation conventions —
// the same centipawn-loss buckets an analysis board uses to label a move an "inaccuracy",
// and standard piece values for a material-based phase split. They are deliberately NOT
// graded methodology: turning a cp-loss count into a *weakness*, a *priority*, or a
// *recommendation* is the chess decision, and that lives entirely in Seam 3
// (interpretGameFeatures) + Seam 4/7, which CONSUME these raw counts (M6). This mirrors
// the M3 precedent, where the puzzle retrieval radius stayed an infrastructure knob rather
// than inventing an ungraded "science" number (see BUILD.md M3 status note). If research
// ever wants graded thresholds, they move into config with a citation — no Engine change.
//
// Everything here is a fixed scalar (no clock, no randomness) so feature extraction stays
// pure and golden-testable (L2).

/**
 * Centipawn-loss severity buckets for a played move (mover's perspective). Disjoint and
 * ascending: a move is counted in exactly the highest bucket its loss reaches.
 */
export const CP_LOSS = {
  inaccuracy: 50,
  mistake: 100,
  blunder: 300,
  grossBlunder: 900,
} as const;

/** A forced mate maps to this centipawn magnitude (minus distance-to-mate, so mate-in-1
 *  ranks above mate-in-5) before capping — keeps evals comparable and finite. */
export const MATE_SCORE_CP = 10000;
/** Distance-to-mate is capped here so the mate magnitude never underflows the cap below. */
export const MATE_MAX_DISTANCE = 99;
/** Evals and cp-loss are clamped to ±this. A single mate/decisive swing therefore can't
 *  dominate an average centipawn-loss (the standard "capped ACPL" approach). */
export const CP_CLAMP = 1000;

/** Eval magnitude (mover's perspective, cp) that the conversion measurement treats as
 *  "winning" (or, negated, "losing"). */
export const WINNING_CP = 200;

/** Standard non-pawn piece values (pawn units) for the material-based phase split. Kings
 *  and pawns are excluded from the non-pawn total. */
export const PIECE_VALUE: Readonly<Record<string, number>> = {
  n: 3,
  b: 3,
  r: 5,
  q: 9,
} as const;

/** The endgame begins at the first ply whose position has total non-pawn material (both
 *  sides, pawn units) at or below this — roughly "queens plus a pair of minors traded". */
export const ENDGAME_NONPAWN_MATERIAL = 24;

/** The opening ends at the earlier of this ply cap (12 full moves) or the endgame start. */
export const OPENING_PLY_CAP = 24;
