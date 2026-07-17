// Typed query helpers for client-computed game analysis (BUILD.md §4: db/ holds query
// helpers, NO business logic). M5 persists RAW features only (L1) — these helpers just
// read/write the AnalysisResult rows; nothing here interprets them.

import type { ImportedGame, Prisma, PrismaClient } from "@prisma/client";

import type { RawGameFeatures } from "@/lib/raw-features";

type Db = Pick<PrismaClient, "importedGame" | "analysisResult">;

/** Most-recent games for this user that have no AnalysisResult yet (the work queue). */
export async function gamesNeedingAnalysis(
  db: Db,
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
 *  with no AnalysisResult yet — i.e. "analyse my last N games" rather than "analyse my next N
 *  unanalysed games". */
export async function gamesNeedingAnalysisInWindow(
  db: Db,
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

/** True iff the game exists and belongs to this user (authorisation for `save`). */
export async function userOwnsGame(
  db: Db,
  userId: string,
  gameId: string,
): Promise<boolean> {
  const row = await db.importedGame.findFirst({
    where: { id: gameId, userId },
    select: { id: true },
  });
  return row !== null;
}

/** Upsert one game's raw analysis (idempotent on gameId — re-running analysis overwrites). */
export async function saveAnalysisResult(
  db: Db,
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
  db: Db,
  userId: string,
): Promise<{ analysed: number; total: number }> {
  const [analysed, total] = await Promise.all([
    db.analysisResult.count({ where: { game: { userId } } }),
    db.importedGame.count({ where: { userId } }),
  ]);
  return { analysed, total };
}
