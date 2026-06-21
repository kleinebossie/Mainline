import { describe, expect, it } from "vitest";

import { parseLichessGame } from "@/integrations/lichess/parse";
import {
  gameIdFromUrl,
  parseChessComGame,
} from "@/integrations/chesscom/parse";

// Golden parsing tests (BUILD.md M2: "PGN/result parsing"). Pure mappers — fixed
// input → exact output, including the dedupeKey that drives idempotency.

describe("parseLichessGame", () => {
  const base = {
    id: "g1",
    createdAt: 1_700_000_000_000,
    clock: { initial: 300, increment: 0 },
    opening: { eco: "C50", name: "Italian Game" },
    pgn: '[ECO "C50"]',
    players: {
      white: { user: { name: "alice" }, rating: 1600 },
      black: { user: { name: "bob" }, rating: 1700 },
    },
  };

  it("maps a white win for the user", () => {
    expect(parseLichessGame({ ...base, winner: "white" }, "alice")).toEqual({
      platform: "lichess",
      externalGameId: "g1",
      dedupeKey: "lichess:g1",
      pgn: '[ECO "C50"]',
      playedAt: 1_700_000_000_000,
      timeControl: "300+0",
      color: "w",
      result: "win",
      userRatingAtGame: 1600,
      opponentRating: 1700,
      eco: "C50",
      opening: "Italian Game",
      source: "lichess",
    });
  });

  it("maps a loss and a draw from the black player's view", () => {
    expect(parseLichessGame({ ...base, winner: "white" }, "bob").result).toBe(
      "loss",
    );
    expect(parseLichessGame({ ...base }, "bob").result).toBe("draw"); // no winner
  });

  it("falls back to PGN tags when opening fields are absent", () => {
    const g = parseLichessGame(
      { ...base, opening: undefined, pgn: '[ECO "D20"]\n[Opening "QGA"]' },
      "alice",
    );
    expect(g.eco).toBe("D20");
    expect(g.opening).toBe("QGA");
  });
});

describe("parseChessComGame", () => {
  it("derives the game id from the url and maps a draw", () => {
    expect(gameIdFromUrl("https://www.chess.com/game/live/9988")).toBe("9988");
    const g = parseChessComGame(
      {
        url: "https://www.chess.com/game/live/9988",
        time_control: "180",
        end_time: 1_650_000_000,
        white: { username: "carol", rating: 1200, result: "stalemate" },
        black: { username: "dave", rating: 1210, result: "stalemate" },
        pgn: "",
      },
      "Carol",
    );
    expect(g).toMatchObject({
      dedupeKey: "chesscom:9988",
      playedAt: 1_650_000_000_000,
      color: "w",
      result: "draw",
      userRatingAtGame: 1200,
      opponentRating: 1210,
    });
  });

  it("maps loss codes to a loss", () => {
    const g = parseChessComGame(
      {
        url: "x/1",
        end_time: 1,
        white: { username: "carol", result: "checkmated" },
        black: { username: "dave", result: "win" },
      },
      "carol",
    );
    expect(g.result).toBe("loss");
  });
});
