// Lichess puzzle-theme reference data (BUILD.md §5.3, §6.4). This is platform
// reference data — the taxonomy Lichess itself publishes at /training/themes — not
// chess-learning methodology. WHICH theme addresses WHICH weakness, and at what
// difficulty, is Seam 4/5 methodology (decided later, in config); here we only list
// the trainable themes so the resource catalog can point at real external pages.
//
// Every key below resolves to a Lichess training page: https://lichess.org/training/<key>
// and matches the `Themes` tags used in the open puzzle DB CSV (§6.4).

export const LICHESS_PUZZLE_THEMES = [
  // Phases
  "opening",
  "middlegame",
  "endgame",
  "rookEndgame",
  "bishopEndgame",
  "pawnEndgame",
  "knightEndgame",
  "queenEndgame",
  "queenRookEndgame",
  // Motifs
  "advancedPawn",
  "attackingF2F7",
  "capturingDefender",
  "discoveredAttack",
  "doubleCheck",
  "exposedKing",
  "fork",
  "hangingPiece",
  "kingsideAttack",
  "pin",
  "queensideAttack",
  "sacrifice",
  "skewer",
  "trappedPiece",
  // Advanced
  "attraction",
  "clearance",
  "defensiveMove",
  "deflection",
  "interference",
  "intermezzo",
  "quietMove",
  "xRayAttack",
  "zugzwang",
  // Mates
  "mate",
  "mateIn1",
  "mateIn2",
  "mateIn3",
  "mateIn4",
  "mateIn5",
  "anastasiaMate",
  "arabianMate",
  "backRankMate",
  "bodenMate",
  "doubleBishopMate",
  "dovetailMate",
  "hookMate",
  "smotheredMate",
  // Special moves
  "castling",
  "enPassant",
  "promotion",
  "underPromotion",
  // Goals
  "equality",
  "advantage",
  "crushing",
  // Lengths
  "oneMove",
  "short",
  "long",
  "veryLong",
  // Origin
  "master",
  "masterVsMaster",
  "superGM",
] as const;

// A few themes read better with hand-written titles; the rest are humanized from the
// camelCase key. Pure + golden-tested (display only — carries no methodology).
const TITLE_OVERRIDES: Readonly<Record<string, string>> = {
  enPassant: "En passant",
  xRayAttack: "X-ray attack",
  attackingF2F7: "Attacking f2/f7",
  mateIn1: "Mate in 1",
  mateIn2: "Mate in 2",
  mateIn3: "Mate in 3",
  mateIn4: "Mate in 4",
  mateIn5: "Mate in 5",
  superGM: "Super GM",
  masterVsMaster: "Master vs Master",
};

/** camelCase theme key → human-readable title (e.g. "rookEndgame" → "Rook Endgame"). */
export function humanizeTheme(theme: string): string {
  const override = TITLE_OVERRIDES[theme];
  if (override) return override;
  const spaced = theme
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .replace(/([A-Za-z])(\d)/g, "$1 $2");
  return spaced.charAt(0).toUpperCase() + spaced.slice(1);
}
