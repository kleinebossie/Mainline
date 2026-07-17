import { Prisma, type PrismaClient } from "@prisma/client";

import {
  finalizeManualPgn,
  ManualPgnFinalizeError,
  parseManualPgnBatch,
  type ManualPgnEntry,
  type ManualPgnMetadata,
  type ManualPgnResultHeader,
} from "@/integrations/manual-pgn";
import {
  MANUAL_PGN_MAX_GAMES_PER_USER,
  type ManualGameImportInput,
} from "@/lib/manual-import";

type Db = Pick<PrismaClient, "importedGame">;
const MANUAL_IMPORT_TRANSACTION_ATTEMPTS = 3;

interface ManualImportOptions {
  precheckDuplicates?: boolean;
}

export class ManualGameQuotaExceededError extends Error {
  constructor(readonly limit = MANUAL_PGN_MAX_GAMES_PER_USER) {
    super(`Manual game library limit of ${limit} reached`);
    this.name = "ManualGameQuotaExceededError";
  }
}

export class ManualImportContentionError extends Error {
  constructor(options?: ErrorOptions) {
    super("Manual import could not acquire a stable quota snapshot", options);
    this.name = "ManualImportContentionError";
  }
}

function isTransactionWriteConflict(error: unknown): boolean {
  return (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    error.code === "P2034"
  );
}

export interface ManualPgnPreviewValid {
  status: "valid";
  index: number;
  plyCount: number;
  metadata: ManualPgnMetadata;
}

export type ManualPgnPreviewEntry =
  | ManualPgnPreviewValid
  | Exclude<ManualPgnEntry, { status: "valid" }>;

export type ManualPgnImportItemResult =
  | { status: "imported"; index: number; gameId: string }
  | { status: "duplicate"; index: number }
  | { status: "needs_input"; index: number; message: string }
  | {
      status: "rejected" | "unsupported";
      index: number;
      message: string;
    };

export function previewManualPgn(pgnText: string) {
  const parsed = parseManualPgnBatch(pgnText);
  if (!parsed.ok) return parsed;
  return {
    ...parsed,
    entries: parsed.entries.map((entry): ManualPgnPreviewEntry => {
      if (entry.status !== "valid") return entry;
      return {
        status: "valid",
        index: entry.index,
        plyCount: entry.plyCount,
        metadata: entry.metadata,
      };
    }),
  };
}

function headerResultForUser(
  result: ManualGameImportInput["result"],
  color: "w" | "b",
): ManualPgnResultHeader | undefined {
  if (!result) return undefined;
  if (result === "draw") return "1/2-1/2";
  if (result === "win") return color === "w" ? "1-0" : "0-1";
  return color === "w" ? "0-1" : "1-0";
}

function userResultFromHeader(
  result: string | undefined,
  color: "w" | "b",
): "win" | "loss" | "draw" | undefined {
  if (result === "1/2-1/2") return "draw";
  if (result !== "1-0" && result !== "0-1") return undefined;
  const whiteWon = result === "1-0";
  return whiteWon === (color === "w") ? "win" : "loss";
}

function ratingFromHeader(value: string | undefined): number | undefined {
  if (!value || !/^\d{1,4}$/.test(value)) return undefined;
  const rating = Number(value);
  return Number.isSafeInteger(rating) ? rating : undefined;
}

function playedAtFromMetadata(metadata: ManualPgnMetadata): Date | null {
  const raw = metadata.date ?? metadata.utcDate;
  const match = raw ? /^(\d{4})\.(\d{2})\.(\d{2})$/.exec(raw) : null;
  if (!match) return null;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const playedAt = new Date(Date.UTC(year, month - 1, day, 12));
  if (
    playedAt.getUTCFullYear() !== year ||
    playedAt.getUTCMonth() !== month - 1 ||
    playedAt.getUTCDate() !== day
  ) {
    return null;
  }
  return playedAt;
}

function orientedRatings(
  metadata: ManualPgnMetadata,
  color: "w" | "b",
): { userRatingAtGame?: number; opponentRating?: number } {
  const white = ratingFromHeader(metadata.whiteElo);
  const black = ratingFromHeader(metadata.blackElo);
  return color === "w"
    ? { userRatingAtGame: white, opponentRating: black }
    : { userRatingAtGame: black, opponentRating: white };
}

function isUniqueConflict(error: unknown): boolean {
  return (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    error.code === "P2002"
  );
}

/** Persist independently valid games without creating platform identity or rating rows. */
export async function importManualPgnBatch(
  db: Db,
  userId: string,
  pgnText: string,
  gameInputs: readonly ManualGameImportInput[],
  options: ManualImportOptions = {},
) {
  const parsed = parseManualPgnBatch(pgnText);
  if (!parsed.ok) {
    return { ...parsed, imported: 0, duplicates: 0, entries: [] };
  }

  const inputs = new Map(gameInputs.map((input) => [input.index, input]));
  const entries: ManualPgnImportItemResult[] = [];

  for (const entry of parsed.entries) {
    if (entry.status !== "valid") {
      entries.push({
        status: entry.status,
        index: entry.index,
        message: entry.message,
      });
      continue;
    }

    const input = inputs.get(entry.index);
    if (!input?.color) {
      entries.push({
        status: "needs_input",
        index: entry.index,
        message: "Choose whether you played White or Black before importing.",
      });
      continue;
    }

    const whiteRating =
      input.userRating === undefined && input.opponentRating === undefined
        ? undefined
        : input.color === "w"
          ? input.userRating
          : input.opponentRating;
    const blackRating =
      input.userRating === undefined && input.opponentRating === undefined
        ? undefined
        : input.color === "b"
          ? input.userRating
          : input.opponentRating;

    try {
      const finalized = finalizeManualPgn(entry.canonicalPgn, {
        event: input.event,
        playedDate: input.playedDate,
        timeControl: input.timeControl,
        resultHeader: headerResultForUser(input.result, input.color),
        whiteRating,
        blackRating,
      });
      const dedupeKey = `manual:${finalized.contentHash}`;
      if (options.precheckDuplicates) {
        const existing = await db.importedGame.findUnique({
          where: { userId_dedupeKey: { userId, dedupeKey } },
          select: { id: true },
        });
        if (existing) {
          entries.push({ status: "duplicate", index: entry.index });
          continue;
        }
      }
      const ratings = orientedRatings(finalized.metadata, input.color);
      const created = await db.importedGame.create({
        data: {
          userId,
          platform: "manual",
          externalGameId: finalized.contentHash,
          dedupeKey,
          pgn: finalized.canonicalPgn,
          playedAt: playedAtFromMetadata(finalized.metadata),
          timeControl: finalized.metadata.timeControl,
          color: input.color,
          result:
            input.result ??
            userResultFromHeader(finalized.metadata.result, input.color),
          userRatingAtGame: ratings.userRatingAtGame,
          opponentRating: ratings.opponentRating,
          eco: finalized.metadata.eco,
          opening: finalized.metadata.opening,
          source: "manual",
        },
        select: { id: true },
      });
      entries.push({
        status: "imported",
        index: entry.index,
        gameId: created.id,
      });
    } catch (error) {
      if (isUniqueConflict(error)) {
        entries.push({ status: "duplicate", index: entry.index });
        continue;
      }
      if (error instanceof ManualPgnFinalizeError) {
        entries.push({
          status: "rejected",
          index: entry.index,
          message: error.message,
        });
        continue;
      }
      throw error;
    }
  }

  return {
    ok: true as const,
    totalBytes: parsed.totalBytes,
    imported: entries.filter((entry) => entry.status === "imported").length,
    duplicates: entries.filter((entry) => entry.status === "duplicate").length,
    entries,
  };
}

/**
 * Enforce the per-user storage quota in a serializable transaction. Locking the
 * owning User row makes same-user batches wait before counting, so they cannot
 * reserve the same remaining capacity. Duplicate prechecks avoid recoverable unique
 * conflicts from aborting the PostgreSQL transaction.
 */
export async function importManualPgnBatchWithinQuota(
  db: PrismaClient,
  userId: string,
  pgnText: string,
  gameInputs: readonly ManualGameImportInput[],
) {
  let lastConflict: unknown;

  for (
    let attempt = 0;
    attempt < MANUAL_IMPORT_TRANSACTION_ATTEMPTS;
    attempt += 1
  ) {
    try {
      return await db.$transaction(
        async (tx) => {
          await tx.$queryRaw`SELECT "id" FROM "User" WHERE "id" = ${userId} FOR UPDATE`;
          const storedGames = await tx.importedGame.count({
            where: { userId, source: "manual" },
          });
          const requestedGames = gameInputs.filter(
            (input) => input.color !== undefined,
          ).length;
          if (
            requestedGames >
            Math.max(0, MANUAL_PGN_MAX_GAMES_PER_USER - storedGames)
          ) {
            throw new ManualGameQuotaExceededError();
          }
          return importManualPgnBatch(tx, userId, pgnText, gameInputs, {
            precheckDuplicates: true,
          });
        },
        { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
      );
    } catch (error) {
      if (!isTransactionWriteConflict(error)) throw error;
      lastConflict = error;
    }
  }

  throw new ManualImportContentionError({ cause: lastConflict });
}
