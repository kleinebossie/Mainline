import { describe, expect, it } from "vitest";

import { pgnTag } from "@/integrations/pgn";
import { gameIdentity } from "@/server/game-identity";

describe("pgnTag", () => {
  const pgn = [
    '[Event "World Championship"]',
    '[Site "London"]',
    '[Date "2024.11.25"]',
    '[White "Carlsen, Magnus"]',
    '[Black "Niemann, Hans"]',
    '[Result "1-0"]',
    "",
    "1. e4 e5 1-0",
  ].join("\n");

  it("extracts requested tag values from PGN header", () => {
    expect(pgnTag(pgn, "White")).toBe("Carlsen, Magnus");
    expect(pgnTag(pgn, "Black")).toBe("Niemann, Hans");
    expect(pgnTag(pgn, "Event")).toBe("World Championship");
    expect(pgnTag(pgn, "Result")).toBe("1-0");
  });

  it("returns undefined for missing tags", () => {
    expect(pgnTag(pgn, "ECO")).toBeUndefined();
    expect(pgnTag(pgn, "TimeControl")).toBeUndefined();
  });

  it("trims whitespace from tag values", () => {
    const padded = '[Opening "   Sicilian Defense   "]\n\n1. e4 c5';
    expect(pgnTag(padded, "Opening")).toBe("Sicilian Defense");
  });
});

describe("gameIdentity", () => {
  const pgn = [
    '[Event "Tata Steel Masters"]',
    '[White "Ding Liren"]',
    '[Black "Gukesh D"]',
    "",
    "1. d4 d5 *",
  ].join("\n");

  it("orients identity when user played as White", () => {
    const identity = gameIdentity(pgn, "w");
    expect(identity).toEqual({
      white: "Ding Liren",
      black: "Gukesh D",
      event: "Tata Steel Masters",
      you: "Ding Liren",
      opponent: "Gukesh D",
    });
  });

  it("orients identity when user played as Black", () => {
    const identity = gameIdentity(pgn, "b");
    expect(identity).toEqual({
      white: "Ding Liren",
      black: "Gukesh D",
      event: "Tata Steel Masters",
      you: "Gukesh D",
      opponent: "Ding Liren",
    });
  });

  it("leaves user and opponent undefined when color is null", () => {
    const identity = gameIdentity(pgn, null);
    expect(identity).toEqual({
      white: "Ding Liren",
      black: "Gukesh D",
      event: "Tata Steel Masters",
      you: undefined,
      opponent: undefined,
    });
  });
});
