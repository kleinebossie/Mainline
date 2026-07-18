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
import {
  assertActiveJobClaim,
  runJob,
  type JobClaim,
  type JobOwner,
} from "@/server/jobs";
import { captureOperationalEvent } from "@/server/observability";
import { systemClock, type Clock } from "@/lib/clock";
import { lockUserProgramMutation } from "@/db/user-mutation-lock";

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
  fn: (claim: JobClaim) => Promise<T>,
  clock: Clock = systemClock,
  owner?: JobOwner,
): Promise<T | undefined> {
  const result = await runJob(db, { kind, key, run: fn, clock, owner });
  return result.state === "completed" ? result.value : undefined;
}

interface ConnectionRow {
  id: string;
  userId: string;
  platform: string;
  externalUsername: string;
  accessToken: string | null;
  lastSyncedAt: Date | null;
  updatedAt?: Date;
}

type VersionedConnectionRow = ConnectionRow & { updatedAt: Date };

/** Mark a failed import only while its claim and source connection version still own the write. */
export async function markConnectionImportError(
  db: Db,
  conn: VersionedConnectionRow,
  claim: JobClaim,
  clock: Clock = systemClock,
): Promise<boolean> {
  return db.$transaction(async (tx) => {
    await lockUserProgramMutation(tx, conn.userId);
    await assertActiveJobClaim(tx, claim);
    const updated = await tx.platformConnection.updateMany({
      where: {
        id: conn.id,
        userId: conn.userId,
        updatedAt: conn.updatedAt,
      },
      data: {
        status: "error",
        updatedAt: new Date(
          Math.max(clock.now(), conn.updatedAt.getTime() + 1),
        ),
      },
    });
    return updated.count === 1;
  });
}

type ClaimedConnectionImporter = (
  db: Db,
  conn: VersionedConnectionRow,
  clock: Clock,
  claim: JobClaim,
) => Promise<ConnectionImportResult>;

/** Reload the owned connection after claim acquisition, then run one fenced import. */
export async function importClaimedConnection(
  db: Db,
  userId: string,
  connectionId: string,
  claim: JobClaim,
  clock: Clock = systemClock,
  importer: ClaimedConnectionImporter = importConnection,
): Promise<ConnectionImportResult | null> {
  const conn = await db.$transaction(async (tx) => {
    await lockUserProgramMutation(tx, userId);
    await assertActiveJobClaim(tx, claim);
    const [user, current] = await Promise.all([
      tx.user.findFirst({
        where: { id: userId, deletedAt: null },
        select: { id: true },
      }),
      tx.platformConnection.findFirst({
        where: { id: connectionId, userId },
      }),
    ]);
    if (user && current) return current;
    await tx.jobRun.deleteMany({
      where: { key: claim.key, attempt: claim.attempt, status: "running" },
    });
    return null;
  });
  if (!conn) return null;

  try {
    return await importer(db, conn, clock, claim);
  } catch (error) {
    await markConnectionImportError(db, conn, claim, clock);
    throw error;
  }
}

/** Capture a snapshot + import games for one connection. */
export async function importConnection(
  db: Db,
  conn: ConnectionRow,
  clock: Clock = systemClock,
  claim?: JobClaim,
): Promise<ConnectionImportResult> {
  // Advance the incremental cursor only to the point before any remote reads.
  // A game that becomes visible while this import is running must remain eligible
  // for the next import. Downstream dedupe makes the intentional overlap safe.
  const syncStartedAt = new Date(clock.now());
  const platform = conn.platform as Platform;
  const adapter = getAdapter(platform);
  const ref: PlatformConnectionRef = {
    platform,
    externalUsername: conn.externalUsername,
    accessToken: conn.accessToken,
    beforeRequest: () =>
      assertApiCallBudget(db, conn.userId, platform, new Date(clock.now())),
  };

  // Fetch remote data before opening a database transaction. The transaction below
  // fences local effects against a reclaimed attempt or a concurrent manual import.
  const snapshot = await adapter.fetchProfile(ref);
  const since = conn.lastSyncedAt ? conn.lastSyncedAt.getTime() : undefined;
  const games = dedupeImportedGames(await adapter.fetchGames(ref, since));
  return db.$transaction(async (tx) => {
    await lockUserProgramMutation(tx, conn.userId);
    if (claim) await assertActiveJobClaim(tx, claim);
    const current = await tx.platformConnection.findUnique({
      where: { id: conn.id },
      select: { userId: true, lastSyncedAt: true, updatedAt: true },
    });
    const expectedWatermark = conn.lastSyncedAt?.getTime() ?? null;
    const currentWatermark = current?.lastSyncedAt?.getTime() ?? null;
    const expectedVersion = conn.updatedAt?.getTime();
    if (
      !current ||
      current.userId !== conn.userId ||
      currentWatermark !== expectedWatermark ||
      (expectedVersion !== undefined &&
        current.updatedAt.getTime() !== expectedVersion)
    ) {
      return {
        platform,
        snapshotCaptured: false,
        fetched: games.length,
        imported: 0,
      };
    }

    // Point-in-time ratings (Measurement seam time series).
    await tx.chessProfileSnapshot.create({
      data: {
        userId: conn.userId,
        platform,
        capturedAt: new Date(snapshot.capturedAt),
        ratings: snapshot.ratings as Prisma.InputJsonValue,
        totalGames: snapshot.totalGames,
        raw: snapshot.raw as Prisma.InputJsonValue,
      },
    });

    // Games are incremental from lastSyncedAt and idempotent by (userId, dedupeKey).
    const created = await tx.importedGame.createMany({
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
      skipDuplicates: true,
    });

    await tx.platformConnection.update({
      where: { id: conn.id },
      data: {
        lastSyncedAt: syncStartedAt,
        status: "active",
        updatedAt: new Date(
          Math.max(clock.now(), current.updatedAt.getTime() + 1),
        ),
      },
    });

    return {
      platform,
      snapshotCaptured: true,
      fetched: games.length,
      imported: created.count,
    };
  });
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
  clock: Clock = systemClock,
): Promise<UserImportSummary> {
  const connections = await db.platformConnection.findMany({
    where: { userId, status: { not: "revoked" } },
  });

  const results: ConnectionImportResult[] = [];
  const errors: UserImportSummary["errors"] = [];

  for (const conn of connections) {
    const key = `${jobKeyPrefix}:${conn.id}`;
    try {
      const r = await withJobRun(
        db,
        "import_sync",
        key,
        (claim) => importClaimedConnection(db, userId, conn.id, claim, clock),
        clock,
        { userId, connectionId: conn.id },
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
      // Surface 429/403/etc. as safe data. The claim-fenced body owns any
      // connection status change, so an older caller cannot overwrite success.
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
