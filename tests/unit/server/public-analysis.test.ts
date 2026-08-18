import { describe, expect, it, vi } from "vitest";
import {
  analyzePublicUsername,
  expectedMistakesPerGame,
} from "@/server/public-analysis";
import * as lichess from "@/integrations/lichess/adapter";
import * as chesscom from "@/integrations/chesscom/adapter";

describe("analyzePublicUsername", () => {
  it("throws for empty username", async () => {
    await expect(analyzePublicUsername("lichess", "")).rejects.toThrow(
      "Username must not be empty.",
    );
  });

  it("calculates realistic expected mistake frequencies based on rating", () => {
    expect(expectedMistakesPerGame(600)).toBe(7.5);
    expect(expectedMistakesPerGame(1000)).toBe(5.1);
    expect(expectedMistakesPerGame(1400)).toBe(3.3);
    expect(expectedMistakesPerGame(1800)).toBe(1.8);
    expect(expectedMistakesPerGame(2200)).toBe(0.7);
    expect(expectedMistakesPerGame(2500)).toBe(0.2);
  });

  it("analyzes lichess account and returns blindspot and starter drill", async () => {
    vi.spyOn(lichess.lichessAdapter, "fetchProfile").mockResolvedValue({
      platform: "lichess",
      externalUsername: "testplayer",
      ratings: {
        rapid: { rating: 1450, games: 100 },
      },
      totalGames: 100,
      capturedAt: Date.now(),
      raw: {},
    });
    vi.spyOn(lichess.lichessAdapter, "fetchGames").mockResolvedValue([
      {
        platform: "lichess",
        externalGameId: "g1",
        dedupeKey: "lichess:g1",
        pgn: "1. e4 e5 2. Nf3 Nc6",
        playedAt: Date.now(),
        result: "loss",
        source: "lichess",
      },
    ]);

    const res = await analyzePublicUsername("lichess", "testplayer");
    expect(res.username).toBe("testplayer");
    expect(res.rating).toBe(1450);
    expect(res.ratingFormat).toBe("Rapid");
    expect(res.blindspot.title).toBeDefined();
    expect(res.drill.fen).toBeDefined();
    expect(res.drill.solutionLine.length).toBeGreaterThan(0);
    expect(res.recentGames.length).toBe(1);
  });

  it("analyzes chess.com account and returns blindspot", async () => {
    vi.spyOn(chesscom.chessComAdapter, "fetchProfile").mockResolvedValue({
      platform: "chesscom",
      externalUsername: "chessmaster",
      ratings: {
        blitz: { rating: 1050, games: 50 },
      },
      totalGames: 50,
      capturedAt: Date.now(),
      raw: {},
    });
    vi.spyOn(chesscom.chessComAdapter, "fetchGames").mockResolvedValue([]);

    const res = await analyzePublicUsername("chesscom", "chessmaster");
    expect(res.username).toBe("chessmaster");
    expect(res.rating).toBe(1050);
    expect(res.ratingFormat).toBe("Blitz");
    expect(res.blindspot.title).toBe("Hanging Pieces");
    expect(res.blindspot.mistakeFrequency).toContain("mistakes per game");
  });
});
