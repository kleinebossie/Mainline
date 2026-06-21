// Pure parser for the Lichess open puzzle-DB CSV (BUILD.md §6.4). No I/O, no clock —
// golden-testable. Emits RAW catalog facts only (L1): nothing here interprets a
// puzzle's difficulty or merit.
//
// CSV columns (CC0 export):
//   PuzzleId, FEN, Moves, Rating, RatingDeviation, Popularity, NbPlays, Themes,
//   GameUrl, OpeningTags
// No field in this dataset contains a comma (FEN/Moves/Themes/OpeningTags are
// space-separated, URLs are comma-free), so a plain comma split is safe and avoids a
// CSV-parser dependency.

export interface LichessPuzzleInput {
  puzzleId: string;
  fen: string;
  moves: string;
  rating: number;
  ratingDeviation: number;
  popularity: number;
  nbPlays: number;
  themes: string[];
  gameUrl: string | null;
  openingTags: string[];
}

function splitTags(field: string | undefined): string[] {
  return (field ?? "")
    .split(" ")
    .map((t) => t.trim())
    .filter(Boolean);
}

/**
 * Parse one CSV line into a puzzle input, or null for blank/header/malformed rows.
 * The header row (and any garbage) is rejected because its numeric columns are NaN.
 */
export function parsePuzzleCsvLine(line: string): LichessPuzzleInput | null {
  const trimmed = line.trim();
  if (!trimmed) return null;

  const cols = trimmed.split(",");
  if (cols.length < 8) return null;

  const puzzleId = cols[0];
  const fen = cols[1];
  const moves = cols[2];
  const themesS = cols[7];
  if (
    puzzleId === undefined ||
    fen === undefined ||
    moves === undefined ||
    themesS === undefined
  ) {
    return null;
  }
  if (!puzzleId || !fen || !moves) return null;

  const rating = Number(cols[3]);
  const ratingDeviation = Number(cols[4]);
  const popularity = Number(cols[5]);
  const nbPlays = Number(cols[6]);
  if (
    ![rating, ratingDeviation, popularity, nbPlays].every((n) =>
      Number.isFinite(n),
    )
  ) {
    return null; // header row or corrupt line
  }

  const gameUrl = cols[8];
  return {
    puzzleId,
    fen,
    moves,
    rating,
    ratingDeviation,
    popularity,
    nbPlays,
    themes: splitTags(themesS),
    gameUrl: gameUrl ? gameUrl : null,
    openingTags: splitTags(cols[9]),
  };
}

/** Parse a whole CSV body (used in tests; the ingest script streams line-by-line). */
export function parsePuzzleCsv(body: string): LichessPuzzleInput[] {
  const out: LichessPuzzleInput[] = [];
  for (const line of body.split("\n")) {
    const p = parsePuzzleCsvLine(line);
    if (p) out.push(p);
  }
  return out;
}
