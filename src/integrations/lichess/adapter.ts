// Lichess platform adapter (BUILD.md §6.2). Login provider → carries OAuth2 PKCE
// tokens. Emits RAW data only (L1). M1 implements profile read + token revoke;
// game/puzzle import lands in M2.

import {
  PlatformError,
  type ImportedGameInput,
  type PlatformAdapter,
  type PlatformConnectionRef,
  type ProfileSnapshotInput,
  type RatingEntry,
} from "@/integrations/adapter";
import { PLATFORM_USER_AGENT } from "@/integrations/user-agent";

const ACCOUNT_URL = "https://lichess.org/api/account";
const TOKEN_URL = "https://lichess.org/api/token";

interface LichessPerf {
  rating?: number;
  rd?: number;
  games?: number;
}
interface LichessAccount {
  id: string;
  username: string;
  perfs?: Record<string, LichessPerf>;
  count?: { all?: number };
}

export const lichessAdapter: PlatformAdapter = {
  platform: "lichess",
  isLoginProvider: true,

  async fetchProfile(
    conn: PlatformConnectionRef,
  ): Promise<ProfileSnapshotInput> {
    if (!conn.accessToken) {
      throw new PlatformError(
        "unauthorized",
        "lichess",
        "Missing Lichess access token",
      );
    }
    const res = await fetch(ACCOUNT_URL, {
      headers: {
        Authorization: `Bearer ${conn.accessToken}`,
        "User-Agent": PLATFORM_USER_AGENT,
        Accept: "application/json",
      },
    });
    if (res.status === 401) {
      throw new PlatformError(
        "unauthorized",
        "lichess",
        "Lichess token rejected",
      );
    }
    if (res.status === 429) {
      throw new PlatformError(
        "rate_limited",
        "lichess",
        "Lichess rate limit hit",
      );
    }
    if (!res.ok) {
      throw new PlatformError(
        "network",
        "lichess",
        `Lichess account fetch failed (${res.status})`,
      );
    }
    const account = (await res.json()) as LichessAccount;
    const ratings: Record<string, RatingEntry> = {};
    for (const [format, perf] of Object.entries(account.perfs ?? {})) {
      ratings[format] = {
        rating: perf.rating,
        rd: perf.rd,
        games: perf.games,
      };
    }
    return {
      platform: "lichess",
      externalUsername: account.username,
      ratings,
      totalGames: account.count?.all ?? 0,
      capturedAt: Date.now(), // I/O timestamp, not a decision — integrations is not L2-guarded
      raw: account,
    };
  },

  async fetchGames(): Promise<ImportedGameInput[]> {
    throw new PlatformError(
      "not_implemented",
      "lichess",
      "Lichess game import arrives in M2",
    );
  },

  async fetchPuzzleActivity() {
    throw new PlatformError(
      "not_implemented",
      "lichess",
      "Lichess puzzle activity arrives in M2",
    );
  },
};

/**
 * Best-effort token revocation when a user disconnects Lichess (§6.2 — respect the
 * platform; don't keep a live credential we no longer need). Failures are swallowed
 * by the caller; the local connection is removed regardless.
 */
export async function revokeLichessToken(accessToken: string): Promise<void> {
  await fetch(TOKEN_URL, {
    method: "DELETE",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "User-Agent": PLATFORM_USER_AGENT,
    },
  });
}
