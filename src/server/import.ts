// Import orchestration (BUILD.md M2, §5.2/§5.7). Reads a user's platform
// connections (WITH tokens — unlike the connections router, which strips them),
// captures a ChessProfileSnapshot, and imports games idempotently. This is Engine-
// side plumbing: it persists RAW data only and makes no chess/learning decision
// (L1). It is invoked by the cron route and the `import.sync` tRPC mutation.

import type { Platform, PlatformConnectionRef } from "@/integrations/adapter";
import { PlatformError } from "@/integrations/adapter";
import { dedupeImportedGames } from "@/integrations/dedupe";
import { getAdapter } from "@/integrations/registry";
import type { Prisma, PrismaClient } from "@prisma/client";
import {
  ApiCallBudgetExceededError,
  assertApiCallBudget,
} from "@/server/api-budget";
import { runJob } from "@/server/jobs";
import { captureOperationalEvent } from "@/server/observability";
import { systemClock, type Clock } from "@/lib/clock";

type Db = PrismaClient;

export interface ConnectionImportResult {
  platform: Platform;
  snapshotCaptured: boolean;
  fetched: number; // games returned by the adapter (post in-batch dedupe)
  imported: number; // genuinely new rows written (skipDuplicates → idempotent)
}

/**
 * Claim a `JobRun` key, run `fn`, and record success/error. Completed and live keys
 * skip; failed or stale keys are reclaimed by the shared retryable job runner.
 * Returns `undefined` when skipped.
 */
export async function withJobRun<T>(
  db: Db,
  kind: string,
  key: string,
  fn: () => Promise<T>,
  clock: Clock = systemClock,
): Promise<T | undefined> {
  const result = await runJob(db, { kind, key, run: fn, clock });
  return result.state === "completed" ? result.value : undefined;
}

interface ConnectionRow {
  id: string;
  userId: string;
  platform: string;
  externalUsername: string;
  accessToken: string | null;
  lastSyncedAt: Date | null;
}

/** Capture a snapshot + import games for one connection. */
export async function importConnection(
  db: Db,
  conn: ConnectionRow,
): Promise<ConnectionImportResult> {
  const platform = conn.platform as Platform;
  const adapter = getAdapter(platform);
  const ref: PlatformConnectionRef = {
    platform,
    externalUsername: conn.externalUsername,
    accessToken: conn.accessToken,
    beforeRequest: () =>
      assertApiCallBudget(db, conn.userId, platform, new Date()),
  };

  // 1) Point-in-time ratings (Measurement seam time series).
  const snapshot = await adapter.fetchProfile(ref);
  await db.chessProfileSnapshot.create({
    data: {
      userId: conn.userId,
      platform,
      capturedAt: new Date(snapshot.capturedAt),
      ratings: snapshot.ratings as Prisma.InputJsonValue,
      totalGames: snapshot.totalGames,
      raw: snapshot.raw as Prisma.InputJsonValue,
    },
  });

  // 2) Games — incremental from lastSyncedAt; idempotent via (userId, dedupeKey).
  const since = conn.lastSyncedAt ? conn.lastSyncedAt.getTime() : undefined;
  const games = dedupeImportedGames(await adapter.fetchGames(ref, since));
  const created = await db.importedGame.createMany({
    data: games.map((g) => ({
      userId: conn.userId,
      platform: g.platform,
      externalGameId: g.externalGameId,
      dedupeKey: g.dedupeKey,
      pgn: g.pgn,
      playedAt: new Date(g.playedAt),
      timeControl: g.timeControl,
      color: g.color,
      result: g.result,
      userRatingAtGame: g.userRatingAtGame,
      opponentRating: g.opponentRating,
      eco: g.eco,
      opening: g.opening,
      source: g.source,
    })),
    skipDuplicates: true, // re-import = no dupes (M2 DoD)
  });

  await db.platformConnection.update({
    where: { id: conn.id },
    data: { lastSyncedAt: new Date(), status: "active" },
  });

  return {
    platform,
    snapshotCaptured: true,
    fetched: games.length,
    imported: created.count,
  };
}

export interface UserImportSummary {
  results: ConnectionImportResult[];
  errors: { platform: Platform; code: string; message: string }[];
}

/**
 * Import every active connection for a user. Each connection runs under its own
 * `JobRun` so a 429/403 on one platform is recorded and does not abort the other.
 * `jobKeyPrefix` lets callers scope idempotency. Cron uses a daily queue key and
 * manual imports reuse a key for the active API budget window.
 */
export async function runImportForUser(
  db: Db,
  userId: string,
  jobKeyPrefix: string,
): Promise<UserImportSummary> {
  const connections = await db.platformConnection.findMany({
    where: { userId, status: { not: "revoked" } },
  });

  const results: ConnectionImportResult[] = [];
  const errors: UserImportSummary["errors"] = [];

  for (const conn of connections) {
    const key = `${jobKeyPrefix}:${conn.id}`;
    try {
      const r = await withJobRun(db, "import_sync", key, () =>
        importConnection(db, conn),
      );
      if (r) results.push(r);
      if (r) {
        captureOperationalEvent({
          operation: "import",
          status: "success",
          platform: r.platform,
          count: r.imported,
        });
      }
    } catch (err) {
      const platform = conn.platform as Platform;
      // Surface 429/403/etc. as data; mark the connection so the UI can show it.
      await db.platformConnection
        .update({ where: { id: conn.id }, data: { status: "error" } })
        .catch(() => undefined);
      errors.push({
        platform,
        code:
          err instanceof PlatformError
            ? err.code
            : err instanceof ApiCallBudgetExceededError
              ? "rate_limited"
              : "network",
        message: "The platform import failed and can be retried safely.",
      });
      captureOperationalEvent({
        operation: "import",
        status: err instanceof ApiCallBudgetExceededError ? "blocked" : "error",
        platform,
      });
    }
  }

  return { results, errors };
}
