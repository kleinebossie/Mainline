import { describe, expect, it } from "vitest";

import { buildPlatformConnectionData } from "@/integrations/connection";

// M1 DoD: "token storage shape". The §6.3 invariant must hold structurally —
// Lichess (login provider) keeps OAuth tokens; Chess.com is always tokenless,
// even if a caller mistakenly passes tokens.
describe("buildPlatformConnectionData (token storage shape, §6.3)", () => {
  it("Lichess keeps its OAuth tokens", () => {
    const data = buildPlatformConnectionData({
      platform: "lichess",
      externalUsername: "thibault",
      tokens: {
        accessToken: "a",
        refreshToken: "r",
        scopes: "preference:read",
      },
    });
    expect(data).toMatchObject({
      platform: "lichess",
      externalUsername: "thibault",
      accessToken: "a",
      refreshToken: "r",
      scopes: "preference:read",
      status: "active",
    });
  });

  it("Lichess tolerates missing tokens (nulls, never undefined)", () => {
    const data = buildPlatformConnectionData({
      platform: "lichess",
      externalUsername: "thibault",
    });
    expect(data.accessToken).toBeNull();
    expect(data.refreshToken).toBeNull();
    expect(data.scopes).toBeNull();
  });

  it("Chess.com is ALWAYS tokenless, even if tokens are passed", () => {
    const data = buildPlatformConnectionData({
      platform: "chesscom",
      externalUsername: "hikaru",
      tokens: { accessToken: "a", refreshToken: "r", scopes: "s" },
    });
    expect(data.accessToken).toBeNull();
    expect(data.refreshToken).toBeNull();
    expect(data.scopes).toBeNull();
    expect(data.externalUsername).toBe("hikaru");
  });
});
