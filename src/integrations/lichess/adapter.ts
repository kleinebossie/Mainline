// Lichess platform adapter (BUILD.md §6.2). Public profiles and games work from a
// username-only connection. OAuth login connections may also carry a token, which
// enables private account endpoints such as puzzle activity. Emits RAW data only.

import {
  DEFAULT_GAME_IMPORT_LIMIT,
  PlatformError,
  type ImportedGameInput,
  type PlatformAdapter,
  type PlatformConnectionRef,
  type ProfileSnapshotInput,
  type PuzzleActivityInput,
  type RatingEntry,
} from "@/integrations/adapter";
import { politeFetch } from "@/integrations/http";
import { parseLichessNdjson } from "@/integrations/lichess/parse";

const USER_URL = "https://lichess.org/api/user";
const TOKEN_URL = "https://lichess.org/api/token";
const GAMES_URL = "https://lichess.org/api/games/user";
const PUZZLE_ACTIVITY_URL = "https://lichess.org/api/puzzle/activity";

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
    const headers: Record<string, string> = { Accept: "application/json" };
    if (conn.accessToken) headers.Authorization = `Bearer ${conn.accessToken}`;
    const res = await politeFetch(
      "lichess",
      `${USER_URL}/${encodeURIComponent(conn.externalUsername)}`,
      { headers },
      undefined,
      conn.beforeRequest,
    );
    if (res.status === 404) {
      throw new PlatformError(
        "not_found",
        "lichess",
        `No Lichess player "${conn.externalUsername}"`,
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

  // Game export (NDJSON). We request evals/clocks/opening so the analysis module
  // (M5) has rich raw features; paginate by `since`/`max`; idempotent downstream via
  // dedupeKey. PGN is embedded in each JSON line (`pgnInJson=true`).
  async fetchGames(
    conn: PlatformConnectionRef,
    since?: number,
    max: number = DEFAULT_GAME_IMPORT_LIMIT,
  ): Promise<ImportedGameInput[]> {
    const params = new URLSearchParams({
      max: String(max),
      pgnInJson: "true",
      clocks: "true",
      evals: "true",
      opening: "true",
    });
    if (since) params.set("since", String(since));

    const headers: Record<string, string> = {
      Accept: "application/x-ndjson",
    };
    if (conn.accessToken) headers.Authorization = `Bearer ${conn.accessToken}`;
    const res = await politeFetch(
      "lichess",
      `${GAMES_URL}/${encodeURIComponent(conn.externalUsername)}?${params}`,
      { headers },
      undefined,
      conn.beforeRequest,
    );
    if (res.status === 401) {
      throw new PlatformError(
        "unauthorized",
        "lichess",
        "Lichess token rejected",
      );
    }
    if (!res.ok) {
      throw new PlatformError(
        "network",
        "lichess",
        `Lichess game export failed (${res.status})`,
      );
    }
    return parseLichessNdjson(await res.text(), conn.externalUsername);
  },

  // Solved/failed puzzle history → the redo-failed-puzzles flow (Seam 6). NDJSON,
  // one entry per puzzle attempt.
  async fetchPuzzleActivity(
    conn: PlatformConnectionRef,
    since?: number,
  ): Promise<PuzzleActivityInput[]> {
    if (!conn.accessToken) {
      throw new PlatformError(
        "unauthorized",
        "lichess",
        "Missing Lichess access token",
      );
    }
    const params = new URLSearchParams();
    if (since) params.set("since", String(since));
    const qs = params.toString();
    const res = await politeFetch(
      "lichess",
      `${PUZZLE_ACTIVITY_URL}${qs ? `?${qs}` : ""}`,
      {
        headers: {
          Authorization: `Bearer ${conn.accessToken}`,
          Accept: "application/x-ndjson",
        },
      },
      undefined,
      conn.beforeRequest,
    );
    if (res.status === 401) {
      throw new PlatformError(
        "unauthorized",
        "lichess",
        "Lichess token rejected",
      );
    }
    if (!res.ok) {
      throw new PlatformError(
        "network",
        "lichess",
        `Lichess puzzle activity failed (${res.status})`,
      );
    }
    return (await res.text())
      .split("\n")
      .map((l) => l.trim())
      .filter(Boolean)
      .map((line) => {
        const e = JSON.parse(line) as {
          puzzle?: { id?: string };
          win?: boolean;
          date?: number;
        };
        return {
          puzzleId: e.puzzle?.id ?? "",
          win: Boolean(e.win),
          solvedAt: e.date ?? 0,
        };
      });
  },
};

/**
 * Best-effort token revocation when a user disconnects Lichess (§6.2 — respect the
 * platform; don't keep a live credential we no longer need). Failures are swallowed
 * by the caller; the local connection is removed regardless.
 */
export async function revokeLichessToken(
  accessToken: string,
  beforeRequest?: () => Promise<void>,
): Promise<void> {
  await politeFetch(
    "lichess",
    TOKEN_URL,
    {
      method: "DELETE",
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    },
    undefined,
    beforeRequest,
  );
}
