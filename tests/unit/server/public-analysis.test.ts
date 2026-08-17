import { describe, expect, it, vi } from "vitest";
import { analyzePublicUsername } from "@/server/public-analysis";
import * as lichess from "@/integrations/lichess/adapter";
import * as chesscom from "@/integrations/chesscom/adapter";

describe("analyzePublicUsername", () => {
  it("throws for empty username", async () => {
    await expect(analyzePublicUsername("lichess", "")).rejects.toThrow(
      "Username must not be empty.",
    );
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
  });

  it("analyzes chess.com account and returns blindspot", async () => {
    vi.spyOn(chesscom.chessComAdapter, "fetchProfile").mockResolvedValue({
      platform: "chesscom",
      externalUsername: "chessmaster",
      ratings: {
        blitz: { rating: 1100, games: 50 },
      },
      totalGames: 50,
      capturedAt: Date.now(),
      raw: {},
    });
    vi.spyOn(chesscom.chessComAdapter, "fetchGames").mockResolvedValue([]);

    const res = await analyzePublicUsername("chesscom", "chessmaster");
    expect(res.username).toBe("chessmaster");
    expect(res.rating).toBe(1100);
    expect(res.ratingFormat).toBe("Blitz");
    expect(res.blindspot.title).toContain("Undefended Pieces");
  });
});
