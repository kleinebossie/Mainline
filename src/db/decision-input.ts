// Typed query helpers for the P4 decision-state tables (BUILD.md §4: db/ holds query
// helpers, NO business logic). These cover SkillStateSnapshot (immutable append-only
// history), TrainingPreferenceState (the derived fit-preferences rollup P4 ships empty and
// P8 writes), and the ActivityEvent-derived recency/adherence roll-ups. The graded
// DECISIONS live upstream; this module only reads/writes state.

import { Prisma, type PrismaClient } from "@prisma/client";

import {
  EMPTY_TRAINING_PREFERENCES,
  trainingPreferencesSchema,
  type ActivityRecency,
  type SkillStateSnapshotValue,
  type TrainingPreferenceStateSnapshot,
} from "@/lib/decision-input";

const DEFAULT_RECENCY_WINDOW_DAYS = 28;
const DAY_MS = 86_400_000;
const DEFAULT_SNAPSHOT_HISTORY_LIMIT = 500;

// --- SkillStateSnapshot (append-only history) --------------------------------

export interface SkillStateSnapshotInput {
  userId: string;
  dimension: string;
  estimate: number;
  uncertainty: number;
  sampleSize: number;
  methodologyVersion: string;
  runAt: Date;
}

/** Append one immutable SkillStateSnapshot row per dimension after an adaptation run.
 *  Append-only: never updates or deletes; the User cascade is the sole removal path. */
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

/** Recent immutable skill-state history (oldest→newest) for the decision-state assembler.
 *  Capped to keep the snapshot bounded; the full audit history remains queryable. */
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

// --- TrainingPreferenceState (derived fit preferences) ------------------------

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

/** The user's training-preference rollup, decoded, or the empty default when no row exists
 *  yet (P4 — P8 is the first writer). Never a skill estimate (roadmap §1). */
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
      // 0 = "no row exists yet" — a stable sentinel so two identically-empty states
      // produce an identical snapshot (L2 reproducibility). The clock does NOT enter here.
      updatedAt: 0,
    };
  }
  return decodeTrainingPreferenceState(row);
}

/** Ensure the user has a training-preference row. Idempotent — used by P4's reset surface
 *  and by P8's writer. No graded decision here; the rolled-up preferences are pure data. */
export async function upsertTrainingPreferenceState(
  db: Pick<PrismaClient, "trainingPreferenceState">,
  input: {
    userId: string;
    preferences: Prisma.InputJsonValue;
    userOverride?: Prisma.InputJsonValue | null;
    resetAt?: Date | null;
  },
) {
  // Prisma represents SQL NULL on a nullable JSON column as `Prisma.DbNull` (not the
  // literal `null`), exactly like `ifThenPlan` in src/server/constraints.ts. We use it
  // when the caller wants a true NULL (no override / no reset stamp).
  const userOverride =
    input.userOverride === null || input.userOverride === undefined
      ? Prisma.DbNull
      : (input.userOverride as Prisma.InputJsonValue);
  const resetAt =
    input.resetAt === null || input.resetAt === undefined
      ? null
      : input.resetAt;
  await db.trainingPreferenceState.upsert({
    where: { userId: input.userId },
    create: {
      userId: input.userId,
      preferences: input.preferences,
      userOverride,
      resetAt,
    },
    update: {
      preferences: input.preferences,
      ...(input.userOverride !== undefined ? { userOverride } : {}),
      ...(input.resetAt !== undefined ? { resetAt } : {}),
    },
  });
}

// --- Activity recency + adherence roll-ups (derived from immutable events) ----

/** The counts of distinct UTC days, completions, skips, and total durations per activity
 *  type over the trailing window, derived from immutable ActivityEvents. Generic
 *  aggregation; no graded decision. */
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
