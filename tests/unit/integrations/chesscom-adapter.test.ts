import { afterEach, describe, expect, it, vi } from "vitest";

import { PlatformError } from "@/integrations/adapter";
import { chessComAdapter } from "@/integrations/chesscom/adapter";

function json(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), { status });
}

afterEach(() => vi.unstubAllGlobals());

describe("chessComAdapter (M1: Chess.com username link, §6.3)", () => {
  it("is not a login provider", () => {
    expect(chessComAdapter.isLoginProvider).toBe(false);
  });

  it("validates a real username and maps raw ratings", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(json(200, { username: "hikaru" }))
      .mockResolvedValueOnce(
        json(200, {
          chess_blitz: {
            last: { rating: 3200, rd: 40 },
            record: { win: 100, loss: 10, draw: 5 },
          },
          chess_rapid: {
            last: { rating: 2900 },
            record: { win: 20, loss: 5, draw: 0 },
          },
        }),
      );
    vi.stubGlobal("fetch", fetchMock);

    // Mixed-case input is normalised to lower-case for the PubAPI.
    const profile = await chessComAdapter.fetchProfile({
      platform: "chesscom",
      externalUsername: "Hikaru",
    });

    expect(profile.platform).toBe("chesscom");
    expect(profile.externalUsername).toBe("hikaru");
    expect(profile.ratings.blitz?.rating).toBe(3200);
    expect(profile.ratings.rapid?.rating).toBe(2900);
    expect(profile.totalGames).toBe(140); // 115 blitz + 25 rapid
    // Chess.com 403s without a descriptive User-Agent (§6.3).
    const firstCall = fetchMock.mock.calls[0];
    expect(firstCall?.[0]).toContain("api.chess.com/pub/player/hikaru");
    const headers = (firstCall?.[1]?.headers ?? {}) as Record<string, string>;
    expect(headers["User-Agent"]).toBeTruthy();
  });

  it("throws not_found for a missing player (404)", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValueOnce(json(404, {})));
    await expect(
      chessComAdapter.fetchProfile({
        platform: "chesscom",
        externalUsername: "definitely-not-a-real-user-xyz",
      }),
    ).rejects.toMatchObject({ code: "not_found" });
  });

  it("surfaces a forbidden (403) as a typed PlatformError", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValueOnce(json(403, {})));
    const err = await chessComAdapter
      .fetchProfile({ platform: "chesscom", externalUsername: "x" })
      .catch((e) => e);
    expect(err).toBeInstanceOf(PlatformError);
    expect(err.code).toBe("forbidden");
  });

  it("still validates a player with no rated stats (stats fetch non-ok)", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(json(200, { username: "newbie" }))
      .mockResolvedValueOnce(json(404, {}));
    vi.stubGlobal("fetch", fetchMock);
    const profile = await chessComAdapter.fetchProfile({
      platform: "chesscom",
      externalUsername: "newbie",
    });
    expect(profile.externalUsername).toBe("newbie");
    expect(profile.totalGames).toBe(0);
    expect(Object.keys(profile.ratings)).toHaveLength(0);
  });

  it("does not implement game import in M1", async () => {
    await expect(
      chessComAdapter.fetchGames({
        platform: "chesscom",
        externalUsername: "x",
      }),
    ).rejects.toMatchObject({ code: "not_implemented" });
  });
});
