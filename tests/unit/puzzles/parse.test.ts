import { describe, expect, it } from "vitest";

import {
  parsePuzzleCsv,
  parsePuzzleCsvLine,
} from "@/integrations/puzzles/parse";

// Golden parsing tests (BUILD.md M3: "golden test on a fixed puzzle fixture"). Pure
// mapper — fixed CSV line → exact record. Raw facts only (L1).

describe("parsePuzzleCsvLine", () => {
  it("parses a full CSV row exactly", () => {
    const line =
      "00sHx,q3k1nr/1pp1nQpp/3p4/1P2p3/4P3/B1PP1b2/B5PP/5K2 b k - 0 17,e8d7 a2e6 d7d8 f7f8,1760,80,83,72,mate mateIn2 short,https://lichess.org/yyznGmXs/black#34,";
    expect(parsePuzzleCsvLine(line)).toEqual({
      puzzleId: "00sHx",
      fen: "q3k1nr/1pp1nQpp/3p4/1P2p3/4P3/B1PP1b2/B5PP/5K2 b k - 0 17",
      moves: "e8d7 a2e6 d7d8 f7f8",
      rating: 1760,
      ratingDeviation: 80,
      popularity: 83,
      nbPlays: 72,
      themes: ["mate", "mateIn2", "short"],
      gameUrl: "https://lichess.org/yyznGmXs/black#34",
      openingTags: [],
    });
  });

  it("parses opening tags when present", () => {
    const line =
      "abcde,8/8/8/8/8/8/8/K6k w - - 0 1,a1a2,1500,75,90,1000,endgame,https://lichess.org/x,Sicilian_Defense Sicilian_Defense_Other";
    expect(parsePuzzleCsvLine(line)?.openingTags).toEqual([
      "Sicilian_Defense",
      "Sicilian_Defense_Other",
    ]);
  });

  it("rejects the header row, blanks, and malformed lines", () => {
    expect(
      parsePuzzleCsvLine(
        "PuzzleId,FEN,Moves,Rating,RatingDeviation,Popularity,NbPlays,Themes,GameUrl,OpeningTags",
      ),
    ).toBeNull();
    expect(parsePuzzleCsvLine("")).toBeNull();
    expect(parsePuzzleCsvLine("   ")).toBeNull();
    expect(parsePuzzleCsvLine("too,few,cols")).toBeNull();
  });
});

describe("parsePuzzleCsv", () => {
  it("skips header/blank lines and keeps valid rows in order", () => {
    const body = [
      "PuzzleId,FEN,Moves,Rating,RatingDeviation,Popularity,NbPlays,Themes,GameUrl,OpeningTags",
      "00sHx,8/8/8/8/8/8/8/K6k w - - 0 1,a1a2,1760,80,83,72,fork,https://lichess.org/x,",
      "",
      "00sIx,8/8/8/8/8/8/8/K6k w - - 0 1,a1a2,900,80,50,30,pin endgame,https://lichess.org/y,",
    ].join("\n");
    const rows = parsePuzzleCsv(body);
    expect(rows.map((r) => r.puzzleId)).toEqual(["00sHx", "00sIx"]);
    expect(rows[1]?.themes).toEqual(["pin", "endgame"]);
  });
});
