// Lichess as an Auth.js OAuth2 provider (BUILD.md §6.1/§6.2). Lichess is a PUBLIC
// client: PKCE + state, NO client secret. Lichess does not require app
// registration — `client_id` is a self-chosen identifier shown on the consent
// screen — so login works with only LICHESS_CLIENT_ID (optional; a default is used)
// and the callback URL registered with Auth.js: /api/auth/callback/lichess.

import type { OAuthConfig } from "next-auth/providers";

export interface LichessProfile {
  id: string;
  username: string;
}

export function LichessProvider(): OAuthConfig<LichessProfile> {
  return {
    id: "lichess",
    name: "Lichess",
    type: "oauth",
    // `||` (not `??`) so an empty LICHESS_CLIENT_ID="" in .env still falls back to
    // the default — Lichess rejects an empty client_id ("choose any").
    clientId: process.env.LICHESS_CLIENT_ID?.trim() || "mainline",
    // Public client → no secret is ever sent.
    client: { token_endpoint_auth_method: "none" },
    checks: ["pkce", "state"],
    authorization: {
      url: "https://lichess.org/oauth",
      // No scopes needed to read the public account (id + username). M2 will request
      // read scopes (game/puzzle export) via config when import is built.
      params: { scope: "" },
    },
    token: "https://lichess.org/api/token",
    userinfo: "https://lichess.org/api/account",
    profile(profile) {
      // Lichess users may not expose an email; our schema allows a null email.
      return {
        id: profile.id,
        name: profile.username,
        email: null,
        image: null,
      };
    },
  };
}
