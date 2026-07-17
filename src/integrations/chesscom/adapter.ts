// Chess.com platform adapter (BUILD.md §6.3). NOT a login provider — read-only
// PubAPI by username, no auth, no tokens ever. A descriptive User-Agent is
// mandatory (Chess.com returns 403 without one). Emits RAW data only (L1). M1
// implements profile read (which doubles as username validation); game import
// lands in M2.

import {
  DEFAULT_GAME_IMPORT_LIMIT,
  PlatformError,
  type ImportedGameInput,
  type PlatformAdapter,
  type PlatformConnectionRef,
  type ProfileSnapshotInput,
  type RatingEntry,
} from "@/integrations/adapter";
import {
  parseChessComGame,
  type ChessComGame,
} from "@/integrations/chesscom/parse";
import { politeFetch } from "@/integrations/http";
import { PLATFORM_USER_AGENT } from "@/integrations/user-agent";

const PUB_BASE = "https://api.chess.com/pub/player";

// Infra bounds (not methodology): cap a single import so a deep history does not
// blow the free-tier budget; the rest backfills incrementally later (§6.5).
const MAX_ARCHIVES_PER_IMPORT = 3; // newest months first

// Subset of the Chess.com /stats response we read (raw, no interpretation).
interface ChessComFormatStats {
  last?: { rating?: number; rd?: number };
  record?: { win?: number; loss?: number; draw?: number };
}
interface ChessComStats {
  chess_bullet?: ChessComFormatStats;
  chess_blitz?: ChessComFormatStats;
  chess_rapid?: ChessComFormatStats;
  chess_daily?: ChessComFormatStats;
}

const STAT_FORMATS: ReadonlyArray<[keyof ChessComStats, string]> = [
  ["chess_bullet", "bullet"],
  ["chess_blitz", "blitz"],
  ["chess_rapid", "rapid"],
  ["chess_daily", "daily"],
];

function mapStats(stats: ChessComStats): {
  ratings: Record<string, RatingEntry>;
  totalGames: number;
} {
  const ratings: Record<string, RatingEntry> = {};
  let totalGames = 0;
  for (const [key, format] of STAT_FORMATS) {
    const fmt = stats[key];
    if (!fmt) continue;
    const games =
      (fmt.record?.win ?? 0) +
      (fmt.record?.loss ?? 0) +
      (fmt.record?.draw ?? 0);
    ratings[format] = { rating: fmt.last?.rating, rd: fmt.last?.rd, games };
    totalGames += games;
  }
  return { ratings, totalGames };
}

export const chessComAdapter: PlatformAdapter = {
  platform: "chesscom",
  isLoginProvider: false,

  async fetchProfile(
    conn: PlatformConnectionRef,
  ): Promise<ProfileSnapshotInput> {
    const username = conn.externalUsername.trim().toLowerCase();
    if (!username) {
      throw new PlatformError(
        "not_found",
        "chesscom",
        "Empty Chess.com username",
      );
    }
    const headers = {
      "User-Agent": PLATFORM_USER_AGENT, // required — Chess.com 403s without it
      Accept: "application/json",
    };

    const profileRes = await politeFetch(
      "chesscom",
      `${PUB_BASE}/${encodeURIComponent(username)}`,
      { headers },
      undefined,
      conn.beforeRequest,
    );
    if (profileRes.status === 404) {
      throw new PlatformError(
        "not_found",
        "chesscom",
        `No Chess.com player "${username}"`,
      );
    }
    if (profileRes.status === 403) {
      throw new PlatformError(
        "forbidden",
        "chesscom",
        "Chess.com rejected the request (descriptive User-Agent required)",
      );
    }
    if (profileRes.status === 429) {
      throw new PlatformError(
        "rate_limited",
        "chesscom",
        "Chess.com rate limit hit",
      );
    }
    if (!profileRes.ok) {
      throw new PlatformError(
        "network",
        "chesscom",
        `Chess.com profile fetch failed (${profileRes.status})`,
      );
    }
    const profile = (await profileRes.json()) as { username?: string };

    // Ratings are best-effort: a valid player with no rated games still validates.
    let ratings: Record<string, RatingEntry> = {};
    let totalGames = 0;
    const statsRes = await politeFetch(
      "chesscom",
      `${PUB_BASE}/${encodeURIComponent(username)}/stats`,
      { headers },
      undefined,
      conn.beforeRequest,
    );
    if (statsRes.ok) {
      ({ ratings, totalGames } = mapStats(
        (await statsRes.json()) as ChessComStats,
      ));
    }

    return {
      platform: "chesscom",
      externalUsername: profile.username ?? username,
      ratings,
      totalGames,
      capturedAt: Date.now(), // I/O timestamp, not a decision — integrations is not L2-guarded
      raw: profile,
    };
  },

  // Monthly archives → games. List the archive URLs (immutable once a month
  // closes, so safe to cache), fetch the newest few months serially, parse, then
  // filter by `since` and cap at `max`. Idempotent downstream via dedupeKey.
  async fetchGames(
    conn: PlatformConnectionRef,
    since?: number,
    max: number = DEFAULT_GAME_IMPORT_LIMIT,
  ): Promise<ImportedGameInput[]> {
    const username = conn.externalUsername.trim().toLowerCase();
    const headers = {
      "User-Agent": PLATFORM_USER_AGENT,
      Accept: "application/json",
    };

    const listRes = await politeFetch(
      "chesscom",
      `${PUB_BASE}/${encodeURIComponent(username)}/games/archives`,
      { headers },
      undefined,
      conn.beforeRequest,
    );
    if (listRes.status === 404) {
      throw new PlatformError(
        "not_found",
        "chesscom",
        `No Chess.com player "${username}"`,
      );
    }
    if (listRes.status === 403) {
      throw new PlatformError(
        "forbidden",
        "chesscom",
        "Chess.com rejected the request (descriptive User-Agent required)",
      );
    }
    if (!listRes.ok) {
      throw new PlatformError(
        "network",
        "chesscom",
        `Chess.com archive list failed (${listRes.status})`,
      );
    }
    const { archives = [] } = (await listRes.json()) as { archives?: string[] };

    const out: ImportedGameInput[] = [];
    // Newest months first; stop once we have enough.
    for (const url of archives.slice(-MAX_ARCHIVES_PER_IMPORT).reverse()) {
      const monthRes = await politeFetch(
        "chesscom",
        url,
        { headers },
        undefined,
        conn.beforeRequest,
      );
      if (!monthRes.ok) continue; // skip a bad month rather than fail the whole import
      const { games = [] } = (await monthRes.json()) as {
        games?: ChessComGame[];
      };
      for (const g of games) {
        const parsed = parseChessComGame(g, username);
        if (!parsed) continue;
        if (since && parsed.playedAt < since) continue;
        out.push(parsed);
      }
      if (out.length >= max) break;
    }
    return out.slice(0, max);
  },
};
