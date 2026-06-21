// Typed query helpers for the tracker + adaptation loop (BUILD.md §4: db/ holds query
// helpers, NO business logic). The graded DECISIONS happen upstream in the pure adaptation
// core (engine/adaptation.ts) + the methodology provider; this module only appends the
// immutable log and reads/writes state. Self-contained input/output types (no engine
// import) keep the boundary clean, exactly as db/program.ts does. Each helper requires only
// the model(s) it touches, so callers (and the transaction client) pass a narrow client.

import type { Prisma, PrismaClient } from "@prisma/client";

// --- Append-only tracker log (§5.5 — never updated or deleted) ----------------

export interface ActivityEventInput {
  userId: string;
  programItemId: string | null;
  type: string;
  occurredAt: Date;
  payload: Prisma.InputJsonValue;
  source: string;
}

/** Append one immutable ActivityEvent. The tracker only ever creates rows (§7.3). */
export async function appendActivityEvent(
  db: Pick<PrismaClient, "activityEvent">,
  input: ActivityEventInput,
): Promise<string> {
  const row = await db.activityEvent.create({
    data: {
      userId: input.userId,
      programItemId: input.programItemId,
      type: input.type,
      occurredAt: input.occurredAt,
      payload: input.payload,
      source: input.source,
    },
    select: { id: true },
  });
  return row.id;
}

// --- SkillState (per dimension) ----------------------------------------------

export async function findSkillStates(
  db: Pick<PrismaClient, "skillState">,
  userId: string,
) {
  return db.skillState.findMany({
    where: { userId },
    select: {
      dimension: true,
      estimate: true,
      uncertainty: true,
      sampleSize: true,
    },
    orderBy: { dimension: "asc" },
  });
}

export interface SkillStateUpsert {
  userId: string;
  dimension: string;
  estimate: number;
  uncertainty: number;
  sampleSize: number;
}

export async function upsertSkillState(
  db: Pick<PrismaClient, "skillState">,
  input: SkillStateUpsert,
) {
  const { userId, dimension, ...rest } = input;
  await db.skillState.upsert({
    where: { userId_dimension: { userId, dimension } },
    create: { userId, dimension, ...rest },
    update: rest,
  });
}

// --- ScheduleState (FSRS) -----------------------------------------------------

export interface ScheduleKey {
  itemType: string;
  itemRef: string;
}

/** The rows for specific (itemType, itemRef) keys (for re-stepping their FSRS state). */
export async function findScheduleStates(
  db: Pick<PrismaClient, "scheduleState">,
  userId: string,
  keys: readonly ScheduleKey[],
) {
  if (keys.length === 0) return [];
  return db.scheduleState.findMany({
    where: {
      userId,
      OR: keys.map((k) => ({ itemType: k.itemType, itemRef: k.itemRef })),
    },
    select: {
      itemRef: true,
      itemType: true,
      fsrsState: true,
      due: true,
      lastGrade: true,
      source: true,
    },
  });
}

/** Items whose review is due at/before `asOf` ("what's due today") — ordered by due. */
export async function findDueScheduleStates(
  db: Pick<PrismaClient, "scheduleState">,
  userId: string,
  asOf: Date,
) {
  return db.scheduleState.findMany({
    where: { userId, due: { lte: asOf } },
    select: { itemRef: true, itemType: true, due: true },
    orderBy: { due: "asc" },
  });
}

export async function countDueScheduleStates(
  db: Pick<PrismaClient, "scheduleState">,
  userId: string,
  asOf: Date,
) {
  return db.scheduleState.count({ where: { userId, due: { lte: asOf } } });
}

export interface ScheduleStateUpsert {
  userId: string;
  itemRef: string;
  itemType: string;
  fsrsState: Prisma.InputJsonValue;
  due: Date;
  lastGrade: number;
  source: string;
}

export async function upsertScheduleState(
  db: Pick<PrismaClient, "scheduleState">,
  input: ScheduleStateUpsert,
) {
  const { userId, itemRef, itemType, ...rest } = input;
  await db.scheduleState.upsert({
    where: { userId_itemType_itemRef: { userId, itemType, itemRef } },
    create: { userId, itemRef, itemType, ...rest },
    update: rest,
  });
}

// --- AdaptationLog ------------------------------------------------------------

export interface AdaptationLogInput {
  userId: string;
  runAt: Date;
  trigger: string;
  inputsSnapshot: Prisma.InputJsonValue;
  decisions: Prisma.InputJsonValue;
  methodologyVersion: string;
}

export async function createAdaptationLog(
  db: Pick<PrismaClient, "adaptationLog">,
  input: AdaptationLogInput,
) {
  await db.adaptationLog.create({ data: input });
}

// --- Reads for regeneration (glicko history, recent outcomes) -----------------

/** Rating snapshots oldest→newest (the Glicko-2 history for plateau/progress). */
export async function findRatingSnapshots(
  db: Pick<PrismaClient, "chessProfileSnapshot">,
  userId: string,
) {
  return db.chessProfileSnapshot.findMany({
    where: { userId },
    select: { capturedAt: true, ratings: true },
    orderBy: { capturedAt: "asc" },
  });
}

/** Recent puzzle-attempt outcomes with their item's params (for the success servo). */
export async function findRecentPuzzleAttempts(
  db: Pick<PrismaClient, "activityEvent">,
  userId: string,
  limit: number,
) {
  return db.activityEvent.findMany({
    where: { userId, type: "puzzle_attempt" },
    select: { payload: true, programItem: { select: { params: true } } },
    orderBy: { occurredAt: "desc" },
    take: limit,
  });
}
