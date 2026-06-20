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

  it("maps perfs/counts and sends the bearer token + User-Agent", async () => {
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
      accessToken: "tok-123",
    });

    expect(profile.externalUsername).toBe("thibault");
    expect(profile.ratings.blitz?.rating).toBe(1500);
    expect(profile.totalGames).toBe(1234);

    const init = (fetchMock.mock.calls[0]?.[1] ?? {}) as RequestInit;
    const headers = (init.headers ?? {}) as Record<string, string>;
    expect(headers.Authorization).toBe("Bearer tok-123");
    expect(headers["User-Agent"]).toBeTruthy();
  });

  it("throws unauthorized when no access token is present", async () => {
    await expect(
      lichessAdapter.fetchProfile({
        platform: "lichess",
        externalUsername: "thibault",
      }),
    ).rejects.toMatchObject({ code: "unauthorized" });
  });

  it("maps a 401 to a typed unauthorized error", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValueOnce(json(401, {})));
    await expect(
      lichessAdapter.fetchProfile({
        platform: "lichess",
        externalUsername: "thibault",
        accessToken: "expired",
      }),
    ).rejects.toMatchObject({ code: "unauthorized" });
  });

  it("does not implement game import in M1", async () => {
    await expect(
      lichessAdapter.fetchGames({
        platform: "lichess",
        externalUsername: "x",
        accessToken: "t",
      }),
    ).rejects.toMatchObject({ code: "not_implemented" });
  });
});
