import { afterEach, describe, expect, it, vi } from "vitest";

import { lichessAdapter } from "@/integrations/lichess/adapter";

function json(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), { status });
}

afterEach(() => vi.unstubAllGlobals());

describe("lichessAdapter (M1: Lichess connection, §6.2)", () => {
  it("is a login provider", () => {
    expect(lichessAdapter.isLoginProvider).toBe(true);
  });

  it("maps a public username profile without requiring OAuth", async () => {
    const fetchMock = vi.fn().mockResolvedValueOnce(
      json(200, {
        id: "thibault",
        username: "thibault",
        perfs: { blitz: { rating: 1500, rd: 50, games: 200 } },
        count: { all: 1234 },
      }),
    );
    vi.stubGlobal("fetch", fetchMock);

    const profile = await lichessAdapter.fetchProfile({
      platform: "lichess",
      externalUsername: "thibault",
    });

    expect(profile.externalUsername).toBe("thibault");
    expect(profile.ratings.blitz?.rating).toBe(1500);
    expect(profile.totalGames).toBe(1234);

    const init = (fetchMock.mock.calls[0]?.[1] ?? {}) as RequestInit;
    const headers = (init.headers ?? {}) as Record<string, string>;
    expect(headers.Authorization).toBeUndefined();
    expect(headers["User-Agent"]).toBeTruthy();
    expect(fetchMock.mock.calls[0]?.[0]).toContain("/api/user/thibault");
  });

  it("maps a missing public username to not_found", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValueOnce(json(404, {})));
    await expect(
      lichessAdapter.fetchProfile({
        platform: "lichess",
        externalUsername: "missing-user",
      }),
    ).rejects.toMatchObject({ code: "not_found" });
  });

  it("imports games from the NDJSON export, sending the bearer token (M2)", async () => {
    const ndjson = [
      JSON.stringify({
        id: "abc123",
        createdAt: 1_700_000_000_000,
        winner: "white",
        clock: { initial: 600, increment: 5 },
        opening: { eco: "B01", name: "Scandinavian" },
        players: {
          white: { user: { name: "Thibault" }, rating: 1500 },
          black: { user: { name: "rival" }, rating: 1480 },
        },
        pgn: '[Event "x"]',
      }),
      "",
    ].join("\n");
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(new Response(ndjson, { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);

    const games = await lichessAdapter.fetchGames({
      platform: "lichess",
      externalUsername: "thibault",
      accessToken: "tok-123",
    });
    expect(games).toHaveLength(1);
    expect(games[0]).toMatchObject({
      dedupeKey: "lichess:abc123",
      color: "w",
      result: "win",
      eco: "B01",
      opening: "Scandinavian",
      userRatingAtGame: 1500,
      opponentRating: 1480,
    });

    const init = (fetchMock.mock.calls[0]?.[1] ?? {}) as RequestInit;
    const headers = (init.headers ?? {}) as Record<string, string>;
    expect(headers.Authorization).toBe("Bearer tok-123");
  });

  it("imports public games without a token", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(new Response("", { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);
    await expect(
      lichessAdapter.fetchGames({ platform: "lichess", externalUsername: "x" }),
    ).resolves.toEqual([]);
    const init = (fetchMock.mock.calls[0]?.[1] ?? {}) as RequestInit;
    const headers = (init.headers ?? {}) as Record<string, string>;
    expect(headers.Authorization).toBeUndefined();
  });
});
