// The one interface every chess platform sits behind (BUILD.md §6), so adding or
// swapping a platform is a clean change. This is Engine-side code: it returns RAW
// data only (ratings, games) — no interpretation, no chess/learning constants (L1).

import type { EpochMs } from "@/lib/clock";

export type Platform = "lichess" | "chesscom";

/**
 * Minimal structural view of a PlatformConnection that an adapter needs. Kept
 * decoupled from the Prisma row so adapters stay pure and unit-testable.
 */
export interface PlatformConnectionRef {
  platform: Platform;
  externalUsername: string;
  accessToken?: string | null; // Lichess only; Chess.com is tokenless (§6.3)
  /** Server-supplied per-user budget check, called immediately before each request. */
  beforeRequest?: () => Promise<void>;
}

export interface RatingEntry {
  rating?: number;
  rd?: number;
  games?: number;
}

/** Point-in-time ratings + counts → ChessProfileSnapshot (§5.2). Raw only (L1). */
export interface ProfileSnapshotInput {
  platform: Platform;
  externalUsername: string;
  ratings: Record<string, RatingEntry>; // keyed by format: bullet/blitz/rapid/classical/puzzle…
  totalGames: number;
  capturedAt: EpochMs;
  raw: unknown;
}

/** One game to import (§5.2). The shape is finalised in M2; declared here for the contract. */
export interface ImportedGameInput {
  platform: Platform;
  externalGameId: string;
  dedupeKey: string; // idempotent import key, e.g. `${platform}:${externalGameId}`
  pgn: string;
  playedAt: EpochMs;
  timeControl?: string;
  color?: "w" | "b";
  result?: "win" | "loss" | "draw";
  userRatingAtGame?: number;
  opponentRating?: number;
  eco?: string;
  opening?: string;
  source: Platform;
}

/** Lichess puzzle activity (§6.2) — enables the redo-failed-puzzles flow (Seam 6). */
export interface PuzzleActivityInput {
  puzzleId: string;
  win: boolean;
  solvedAt: EpochMs;
}

export interface PlatformAdapter {
  platform: Platform;
  /** Lichess is an OAuth login provider (tokens stored); Chess.com is not (§6.1). */
  isLoginProvider: boolean;
  fetchProfile(conn: PlatformConnectionRef): Promise<ProfileSnapshotInput>;
  fetchGames(
    conn: PlatformConnectionRef,
    since?: EpochMs,
    max?: number,
  ): Promise<ImportedGameInput[]>;
  // Lichess only (others throw not_implemented / are absent):
  fetchPuzzleActivity?(
    conn: PlatformConnectionRef,
    since?: EpochMs,
  ): Promise<PuzzleActivityInput[]>;
}

export type PlatformErrorCode =
  | "not_found" // no such user/resource (e.g. Chess.com 404)
  | "unauthorized" // missing/expired token (401)
  | "forbidden" // e.g. Chess.com 403 (missing User-Agent)
  | "rate_limited" // 429 — back off (§6.2/§6.3)
  | "network" // anything else / transport failure
  | "not_implemented"; // arrives in a later milestone

/** A typed error so callers (tRPC routers, import jobs) can map causes to UX. */
export class PlatformError extends Error {
  constructor(
    readonly code: PlatformErrorCode,
    readonly platform: Platform,
    message: string,
  ) {
    super(message);
    this.name = "PlatformError";
  }
}
