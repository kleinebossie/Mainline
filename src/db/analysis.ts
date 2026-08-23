// Typed query helpers for client-computed game analysis (BUILD.md §4: db/ holds query
// helpers, NO business logic). M5 persists RAW features only (L1): these helpers just
// read/write the AnalysisResult rows. Nothing here interprets them.

import type { ImportedGame, Prisma, PrismaClient } from "@prisma/client";

import type { RawGameFeatures } from "@/lib/raw-features";
import { GAME_ANALYSED_ACTIVITY_EVENT_TYPE } from "@/lib/tracker";

export type Db = Pick<
  PrismaClient,
  "importedGame" | "analysisResult" | "activityEvent"
>;

/** Most-recent games for this user that have no AnalysisResult yet (the work queue). */
export async function gamesNeedingAnalysis(
  db: Pick<PrismaClient, "importedGame">,
  userId: string,
  limit: number,
  platform?: string,
): Promise<ImportedGame[]> {
  return db.importedGame.findMany({
    where: {
      userId,
      analysis: { is: null },
      ...(platform ? { platform } : {}),
    },
    orderBy: [
      { playedAt: { sort: "desc", nulls: "last" } },
      { importedAt: "desc" },
    ],
    take: Math.max(0, limit),
  });
}

/** The `windowSize` most recent games for this user (+ platform), filtered down to the ones
 *  with no AnalysisResult yet. */
export async function gamesNeedingAnalysisInWindow(
  db: Pick<PrismaClient, "importedGame">,
  userId: string,
  windowSize: number,
  platform?: string,
): Promise<ImportedGame[]> {
  const recent = await db.importedGame.findMany({
    where: { userId, ...(platform ? { platform } : {}) },
    orderBy: [
      { playedAt: { sort: "desc", nulls: "last" } },
      { importedAt: "desc" },
    ],
    take: Math.max(0, windowSize),
    include: { analysis: { select: { id: true } } },
  });
  return recent.filter((g) => g.analysis === null);
}

/** All game IDs that this user has reviewed through a `game_analysed` activity event. */
export async function reviewedGameIds(
  db: Pick<PrismaClient, "activityEvent">,
  userId: string,
): Promise<Set<string>> {
  const events = await db.activityEvent.findMany({
    where: {
      userId,
      type: GAME_ANALYSED_ACTIVITY_EVENT_TYPE,
    },
    select: { payload: true },
  });
  const ids = new Set<string>();
  for (const event of events) {
    if (
      event.payload &&
      typeof event.payload === "object" &&
      "gameId" in event.payload
    ) {
      const gameId = (event.payload as { gameId?: unknown }).gameId;
      if (typeof gameId === "string" && gameId.length > 0) {
        ids.add(gameId);
      }
    }
  }
  return ids;
}

/** Games that have an AnalysisResult (scanned) but no review event yet. */
export async function unreviewedGames(
  db: Pick<PrismaClient, "importedGame" | "activityEvent">,
  userId: string,
  limit: number,
): Promise<ImportedGame[]> {
  const reviewed = await reviewedGameIds(db, userId);
  const reviewedList = Array.from(reviewed);
  return db.importedGame.findMany({
    where: {
      userId,
      analysis: { isNot: null },
      ...(reviewedList.length > 0 ? { id: { notIn: reviewedList } } : {}),
    },
    orderBy: [
      { playedAt: { sort: "desc", nulls: "last" } },
      { importedAt: "desc" },
    ],
    take: Math.max(0, limit),
  });
}

/** True iff the game exists and belongs to this user (authorisation for `save`). */
export async function userOwnsGame(
  db: Pick<PrismaClient, "importedGame">,
  userId: string,
  gameId: string,
): Promise<boolean> {
  const row = await db.importedGame.findFirst({
    where: { id: gameId, userId },
    select: { id: true },
  });
  return row !== null;
}

/** Upsert one game's raw analysis (idempotent on gameId: re-running analysis overwrites). */
export async function saveAnalysisResult(
  db: Pick<PrismaClient, "analysisResult">,
  input: {
    gameId: string;
    engineVersion: string;
    depth: number;
    rawFeatures: RawGameFeatures;
  },
): Promise<void> {
  const rawFeatures = input.rawFeatures as unknown as Prisma.InputJsonValue;
  await db.analysisResult.upsert({
    where: { gameId: input.gameId },
    create: {
      gameId: input.gameId,
      engineVersion: input.engineVersion,
      depth: input.depth,
      rawFeatures,
    },
    update: {
      engineVersion: input.engineVersion,
      depth: input.depth,
      rawFeatures,
      analyzedAt: new Date(),
    },
  });
}

/** Count of analysed vs total games for this user (dashboard progress). */
export async function analysisCounts(
  db: Pick<PrismaClient, "analysisResult" | "importedGame">,
  userId: string,
): Promise<{ analysed: number; total: number }> {
  const [analysed, total] = await Promise.all([
    db.analysisResult.count({ where: { game: { userId } } }),
    db.importedGame.count({ where: { userId } }),
  ]);
  return { analysed, total };
}
