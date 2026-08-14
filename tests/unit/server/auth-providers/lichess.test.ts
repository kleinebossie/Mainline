import { afterEach, describe, expect, it } from "vitest";

import { LichessProvider } from "@/server/auth-providers/lichess";

describe("LichessProvider", () => {
  const originalEnv = process.env.LICHESS_CLIENT_ID;

  afterEach(() => {
    process.env.LICHESS_CLIENT_ID = originalEnv;
  });

  it("configures public OAuth2 client with PKCE and state checks", () => {
    delete process.env.LICHESS_CLIENT_ID;
    const config = LichessProvider();

    expect(config.id).toBe("lichess");
    expect(config.name).toBe("Lichess");
    expect(config.type).toBe("oauth");
    expect(config.clientId).toBe("mainline");
    expect(config.client).toEqual({ token_endpoint_auth_method: "none" });
    expect(config.checks).toEqual(["pkce", "state"]);
    expect(config.authorization).toEqual({
      url: "https://lichess.org/oauth",
      params: { scope: "" },
    });
    expect(config.token).toBe("https://lichess.org/api/token");
    expect(config.userinfo).toBe("https://lichess.org/api/account");
  });

  it("uses LICHESS_CLIENT_ID environment variable when configured", () => {
    process.env.LICHESS_CLIENT_ID = "custom-client-id";
    const config = LichessProvider();
    expect(config.clientId).toBe("custom-client-id");
  });

  it("maps user profile without email or image", () => {
    const config = LichessProvider();
    if (typeof config.profile !== "function") {
      throw new Error("profile mapper should be a function");
    }

    const mapped = config.profile(
      { id: "lichess_user_123", username: "grandmaster_joe" },
      {} as never,
    );
    expect(mapped).toEqual({
      id: "lichess_user_123",
      name: "grandmaster_joe",
      email: null,
      image: null,
    });
  });
});
