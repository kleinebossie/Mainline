// Raw game-identity extraction (BUILD.md §6, L1). Recovers the human-facing "who/when" of
// an imported game from its PGN seven-tag roster so the UI can say *which* game is on screen.
// Pure string extraction — no chess/learning interpretation lives here.

import { pgnTag } from "@/integrations/pgn";

export interface GameIdentity {
  white?: string;
  black?: string;
  /** The opponent's name from the user's perspective (requires a known colour). */
  opponent?: string;
  /** The user's own name from the PGN (requires a known colour). */
  you?: string;
  event?: string;
}

/** Pull display names from a PGN, oriented by the user's colour ("w" | "b" | null). */
export function gameIdentity(pgn: string, color: string | null): GameIdentity {
  const white = pgnTag(pgn, "White");
  const black = pgnTag(pgn, "Black");
  const event = pgnTag(pgn, "Event");
  const youIsWhite = color === "w";
  return {
    white,
    black,
    event,
    you: color ? (youIsWhite ? white : black) : undefined,
    opponent: color ? (youIsWhite ? black : white) : undefined,
  };
}
