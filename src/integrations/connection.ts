// Pure helpers for turning a platform link into the persisted PlatformConnection
// row (BUILD.md §5.2). The key invariant (§6.3): only login providers (Lichess)
// carry OAuth tokens — Chess.com connections are ALWAYS tokenless, even if a caller
// mistakenly passes tokens. This is unit-tested ("token storage shape", M1 DoD).

import type { Platform } from "@/integrations/adapter";
import { getAdapter } from "@/integrations/registry";

export function platformIsLoginProvider(platform: Platform): boolean {
  return getAdapter(platform).isLoginProvider;
}

export interface ConnectionTokens {
  accessToken?: string | null;
  refreshToken?: string | null;
  scopes?: string | null;
}

export interface PlatformConnectionData {
  platform: Platform;
  externalUsername: string;
  accessToken: string | null;
  refreshToken: string | null;
  scopes: string | null;
  status: "active";
}

export function buildPlatformConnectionData(args: {
  platform: Platform;
  externalUsername: string;
  tokens?: ConnectionTokens;
}): PlatformConnectionData {
  const allowsTokens = platformIsLoginProvider(args.platform);
  return {
    platform: args.platform,
    externalUsername: args.externalUsername,
    accessToken: allowsTokens ? (args.tokens?.accessToken ?? null) : null,
    refreshToken: allowsTokens ? (args.tokens?.refreshToken ?? null) : null,
    scopes: allowsTokens ? (args.tokens?.scopes ?? null) : null,
    status: "active",
  };
}
