// Persistence helpers only. Graded decisions belong upstream.

import type { PrismaClient } from "@prisma/client";

import {
  EMPTY_TRAINING_PREFERENCES,
  trainingPreferencesSchema,
  type ActivityRecency,
  type SkillStateSnapshotValue,
  type TrainingPreferenceStateSnapshot,
} from "@/lib/decision-input";
import { DAY_MS } from "@/lib/clock";

const DEFAULT_RECENCY_WINDOW_DAYS = 28;
const DEFAULT_SNAPSHOT_HISTORY_LIMIT = 500;

export interface SkillStateSnapshotInput {
  userId: string;
  dimension: string;
  estimate: number;
  uncertainty: number;
  sampleSize: number;
  methodologyVersion: string;
  runAt: Date;
}

/** Append-only except for the User cascade. */
export async function appendSkillStateSnapshots(
  db: Pick<PrismaClient, "skillStateSnapshot">,
  inputs: readonly SkillStateSnapshotInput[],
): Promise<number> {
  if (inputs.length === 0) return 0;
  await db.skillStateSnapshot.createMany({
    data: inputs.map((i) => ({
      userId: i.userId,
      dimension: i.dimension,
      estimate: i.estimate,
      uncertainty: i.uncertainty,
      sampleSize: i.sampleSize,
      methodologyVersion: i.methodologyVersion,
      runAt: i.runAt,
    })),
  });
  return inputs.length;
}

/** Bounded history returned oldest to newest. */
export async function findRecentSkillStateSnapshots(
  db: Pick<PrismaClient, "skillStateSnapshot">,
  userId: string,
  limit: number = DEFAULT_SNAPSHOT_HISTORY_LIMIT,
): Promise<SkillStateSnapshotValue[]> {
  const rows = await db.skillStateSnapshot.findMany({
    where: { userId },
    orderBy: [{ runAt: "desc" }, { capturedAt: "desc" }, { id: "desc" }],
    take: limit,
    select: {
      id: true,
      dimension: true,
      estimate: true,
      uncertainty: true,
      sampleSize: true,
      methodologyVersion: true,
      runAt: true,
      capturedAt: true,
    },
  });
  return rows.reverse().map((r) => ({
    dimension: r.dimension,
    estimate: r.estimate,
    uncertainty: r.uncertainty,
    sampleSize: r.sampleSize,
    methodologyVersion: r.methodologyVersion,
    runAt: r.runAt.getTime(),
    capturedAt: r.capturedAt.getTime(),
  }));
}

function decodeTrainingPreferenceState(row: {
  preferences: unknown;
  userOverride: unknown;
  resetAt: Date | null;
  updatedAt: Date;
}): TrainingPreferenceStateSnapshot {
  const parsed = trainingPreferencesSchema.safeParse(row.userOverride);
  const userOverride = parsed.success ? parsed.data : null;
  const prefParsed = trainingPreferencesSchema.safeParse(row.preferences);
  const preferences = prefParsed.success
    ? prefParsed.data
    : EMPTY_TRAINING_PREFERENCES;
  return {
    preferences,
    userOverride,
    resetAt: row.resetAt?.getTime() ?? null,
    updatedAt: row.updatedAt.getTime(),
  };
}

export async function findTrainingPreferenceState(
  db: Pick<PrismaClient, "trainingPreferenceState">,
  userId: string,
): Promise<TrainingPreferenceStateSnapshot> {
  const row = await db.trainingPreferenceState.findUnique({
    where: { userId },
    select: {
      preferences: true,
      userOverride: true,
      resetAt: true,
      updatedAt: true,
    },
  });
  if (!row) {
    return {
      preferences: EMPTY_TRAINING_PREFERENCES,
      userOverride: null,
      resetAt: null,
      // Stable sentinel keeps identical empty states reproducible.
      updatedAt: 0,
    };
  }
  return decodeTrainingPreferenceState(row);
}

export async function findActivityRecency(
  db: Pick<PrismaClient, "activityEvent">,
  userId: string,
  asOfEpochMs: number,
  windowDays: number = DEFAULT_RECENCY_WINDOW_DAYS,
): Promise<ActivityRecency> {
  const windowStart = new Date(asOfEpochMs - windowDays * DAY_MS);
  const rows = await db.activityEvent.findMany({
    where: {
      userId,
      occurredAt: { gte: windowStart, lte: new Date(asOfEpochMs) },
    },
    select: {
      type: true,
      occurredAt: true,
      payload: true,
      programItem: { select: { activityType: true } },
    },
    orderBy: [{ occurredAt: "asc" }, { id: "asc" }],
  });
  const lastEventAtByType: Record<string, number> = {};
  const completionsByType: Record<string, number> = {};
  const skipsByType: Record<string, number> = {};
  const durationMinutesByType: Record<string, number> = {};
  const activeDays = new Set<string>();
  for (const r of rows) {
    const t = r.programItem?.activityType ?? r.type;
    const at = r.occurredAt.getTime();
    lastEventAtByType[t] = at;
    activeDays.add(new Date(at).toISOString().slice(0, 10));
    if (r.type === "skip") {
      skipsByType[t] = (skipsByType[t] ?? 0) + 1;
    } else if (r.type === "skip_undone") {
      skipsByType[t] = Math.max(0, (skipsByType[t] ?? 0) - 1);
    } else {
      completionsByType[t] = (completionsByType[t] ?? 0) + 1;
    }
    const payload = (r.payload ?? {}) as {
      durationMin?: unknown;
      solveTimeMs?: unknown;
    };
    const durationMin = payload.durationMin;
    const solveTimeMs = payload.solveTimeMs;
    let minutes = 0;
    if (
      typeof durationMin === "number" &&
      Number.isFinite(durationMin) &&
      durationMin > 0
    ) {
      minutes += durationMin;
    }
    if (
      typeof solveTimeMs === "number" &&
      Number.isFinite(solveTimeMs) &&
      solveTimeMs > 0
    ) {
      minutes += solveTimeMs / 60_000;
    }
    if (minutes > 0) {
      durationMinutesByType[t] = (durationMinutesByType[t] ?? 0) + minutes;
    }
  }
  return {
    lastEventAtByType,
    completionsByType,
    skipsByType,
    durationMinutesByType,
    activeDays: activeDays.size,
    totalEvents: rows.length,
  };
}
