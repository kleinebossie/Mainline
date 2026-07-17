import { Chess } from "chess.js";
import { describe, expect, it } from "vitest";

import {
  finalizeManualPgn,
  MANUAL_PGN_MAX_BATCH_BYTES,
  MANUAL_PGN_MAX_GAME_BYTES,
  MANUAL_PGN_MAX_GAMES,
  MANUAL_PGN_MAX_PLIES,
  parseManualPgnBatch,
} from "@/integrations/manual-pgn";

function validEntries(pgn: string) {
  const result = parseManualPgnBatch(pgn);
  expect(result.ok).toBe(true);
  if (!result.ok) throw new Error(result.message);
  return result.entries.filter((entry) => entry.status === "valid");
}

describe("parseManualPgnBatch", () => {
  it("parses and canonicalizes one game", () => {
    const entries = validEntries('[Event "Club"]\n\n1. e4 e5 2. Nf3 *');

    expect(entries).toHaveLength(1);
    expect(entries[0]).toMatchObject({
      status: "valid",
      index: 0,
      plyCount: 3,
      metadata: { event: "Club", result: "*" },
    });
    expect(entries[0]?.canonicalPgn).toContain("1. e4 e5 2. Nf3 *");
  });

  it("splits concatenated tagged and headerless games", () => {
    const tagged = parseManualPgnBatch(
      '[Event "One"]\n\n1. e4 e5 1-0\n\n[Event "Two"]\n\n1. d4 d5 0-1',
    );
    expect(tagged.ok && tagged.entries.map((entry) => entry.status)).toEqual([
      "valid",
      "valid",
    ]);

    const headerless = parseManualPgnBatch("1. e4 e5 1-0\n1. d4 d5 0-1");
    expect(
      headerless.ok && headerless.entries.map((entry) => entry.status),
    ).toEqual(["valid", "valid"]);
  });

  it("keeps valid siblings when one game is malformed", () => {
    const result = parseManualPgnBatch(
      '[Event "Good"]\n\n1. e4 e5 1-0\n\n[Event "Bad"]\n\n1. d4 NotAMove 0-1\n\n[Event "Also good"]\n\n1. c4 e5 *',
    );

    expect(result.ok && result.entries).toMatchObject([
      { status: "valid", index: 0 },
      { status: "rejected", index: 1, code: "invalid" },
      { status: "valid", index: 2 },
    ]);
  });

  it("rejects a zero-ply PGN without discarding a valid sibling", () => {
    const result = parseManualPgnBatch(
      '[Event "No moves"]\n\n*\n\n[Event "Playable"]\n\n1. e4 *',
    );

    expect(result.ok && result.entries).toMatchObject([
      { status: "rejected", index: 0, code: "no_moves" },
      { status: "valid", index: 1, plyCount: 1 },
    ]);
  });

  it("returns a distinct unsupported entry for a non-standard variant", () => {
    const result = parseManualPgnBatch(
      '[Event "Variant"]\n[Variant "Chess960"]\n\n1. e4 *',
    );

    expect(result.ok && result.entries).toEqual([
      {
        status: "unsupported",
        index: 0,
        code: "unsupported_variant",
        variant: "Chess960",
        message: "Only standard chess PGN is supported.",
      },
    ]);
  });

  it("accepts legal standard SetUp and FEN games", () => {
    const entries = validEntries(
      '[Event "Position"]\n[SetUp "1"]\n[FEN "8/8/8/8/8/8/k6P/7K w - - 0 1"]\n[Variant "Standard"]\n\n1. h4 *',
    );

    expect(entries).toHaveLength(1);
    expect(entries[0]).toMatchObject({
      plyCount: 1,
      metadata: { variant: "Standard" },
    });
    expect(entries[0]?.canonicalPgn).toContain('[SetUp "1"]');
    expect(entries[0]?.canonicalPgn).toContain(
      '[FEN "8/8/8/8/8/8/k6P/7K w - - 0 1"]',
    );
  });

  it("preserves mainline comments and clock annotations", () => {
    const entries = validEntries(
      '[Event "Clocked"]\n\n1. e4 {[%clk 0:05:00]} e5 {reply} *',
    );

    expect(entries[0]?.canonicalPgn).toContain("{[%clk 0:05:00]}");
    expect(entries[0]?.canonicalPgn).toContain("{reply}");
  });

  it("normalizes a leading BOM and CRLF newlines", () => {
    const entries = validEntries(
      '\uFEFF[Event "Windows"]\r\n[White "Alice"]\r\n\r\n1. e4 *\r\n',
    );

    expect(entries).toHaveLength(1);
    expect(entries[0]?.canonicalPgn).not.toContain("\r");
    expect(entries[0]?.canonicalPgn).not.toContain("\uFEFF");
    expect(entries[0]?.metadata.white).toBe("Alice");
  });

  it("fails the entire batch when it is empty or exceeds a batch bound", () => {
    expect(parseManualPgnBatch(" \r\n\t")).toMatchObject({
      ok: false,
      code: "empty_input",
    });
    expect(
      parseManualPgnBatch("x".repeat(MANUAL_PGN_MAX_BATCH_BYTES + 1)),
    ).toMatchObject({
      ok: false,
      code: "batch_too_large",
    });

    const tooMany = Array.from(
      { length: MANUAL_PGN_MAX_GAMES + 1 },
      (_, index) => `[Event "${index}"]\n\n1. e4 *`,
    ).join("\n\n");
    expect(parseManualPgnBatch(tooMany)).toMatchObject({
      ok: false,
      code: "too_many_games",
      gameCount: MANUAL_PGN_MAX_GAMES + 1,
    });
  });

  it("rejects an oversized game without discarding a valid sibling", () => {
    const oversized = `[Event "Large"]\n\n{${"x".repeat(MANUAL_PGN_MAX_GAME_BYTES)}} *`;
    const result = parseManualPgnBatch(
      `${oversized}\n\n[Event "Small"]\n\n1. e4 *`,
    );

    expect(result.ok && result.entries).toMatchObject([
      { status: "rejected", index: 0, code: "game_too_large" },
      { status: "valid", index: 1 },
    ]);
  });

  it("rejects a game over the ply limit", () => {
    const chess = new Chess();
    const moves = ["Nf3", "Nf6", "Ng1", "Ng8"];
    for (let index = 0; index < MANUAL_PGN_MAX_PLIES + 1; index += 1) {
      chess.move(moves[index % moves.length] ?? "Nf3");
    }

    const result = parseManualPgnBatch(chess.pgn());
    expect(result.ok && result.entries).toMatchObject([
      { status: "rejected", index: 0, code: "too_many_plies" },
    ]);
  });

  it("extracts raw game metadata", () => {
    const entries = validEntries(
      [
        '[Event "City Championship"]',
        '[Site "Utrecht"]',
        '[Round "3"]',
        '[Date "2025.05.06"]',
        '[UTCDate "2025.05.07"]',
        '[White "Alice"]',
        '[Black "Bob"]',
        '[Result "1-0"]',
        '[TimeControl "5400+30"]',
        '[WhiteElo "1810"]',
        '[BlackElo "1775"]',
        '[ECO "C50"]',
        '[Opening "Italian Game"]',
        '[Variant "Chess"]',
        "",
        "1. e4 e5 1-0",
      ].join("\n"),
    );

    expect(entries[0]?.metadata).toEqual({
      white: "Alice",
      black: "Bob",
      event: "City Championship",
      site: "Utrecht",
      round: "3",
      date: "2025.05.06",
      utcDate: "2025.05.07",
      timeControl: "5400+30",
      result: "1-0",
      whiteElo: "1810",
      blackElo: "1775",
      eco: "C50",
      opening: "Italian Game",
      variant: "Chess",
    });
  });
});

describe("finalizeManualPgn", () => {
  it("produces the same lowercase SHA-256 hash across PGN formatting", () => {
    const first = finalizeManualPgn(
      '[Event "Club Night"]\n[White "Alice"]\n[Black "Bob"]\n[Date "2025.01.02"]\n\n1. e4 e5 2. Nf3 *',
    );
    const second = finalizeManualPgn(
      '[Black "Bob"]\r\n[Date "2025.01.02"]\r\n[Event "  Club   Night  "]\r\n[White "Alice"]\r\n\r\n1.e4   e5 2.Nf3 *',
    );

    expect(second.contentHash).toBe(first.contentHash);
    expect(first.contentHash).toMatch(/^[a-f0-9]{64}$/);
  });

  it("changes the hash when meaningful game identity changes", () => {
    const first = finalizeManualPgn('[Event "Round one"]\n\n1. e4 e5 *');
    const second = finalizeManualPgn('[Event "Round two"]\n\n1. e4 e5 *');

    expect(second.contentHash).not.toBe(first.contentHash);
  });

  it("normalizes overrides and re-canonicalizes the PGN", () => {
    const finalized = finalizeManualPgn('[Event "Old"]\n\n1. e4 e5 *', {
      event: '  Club  "Final" ',
      playedDate: "2024-02-29",
      timeControl: " 90+30 ",
      resultHeader: "1-0",
      whiteRating: 1820,
      blackRating: 1795,
    });

    expect(finalized.metadata).toMatchObject({
      event: "Club 'Final'",
      date: "2024.02.29",
      timeControl: "90+30",
      result: "1-0",
      whiteElo: "1820",
      blackElo: "1795",
    });
    expect(finalized.canonicalPgn).toContain('[Result "1-0"]');
    expect(finalized.canonicalPgn).toMatch(/1\. e4 e5 1-0$/);
    expect(() =>
      finalizeManualPgn("1. e4 *", { playedDate: "2023-02-29" }),
    ).toThrow(/real date/);
  });
});
