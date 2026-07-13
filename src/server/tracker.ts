// Persists immutable outcomes and adaptation results. Engine and methodology own decisions.
// Adaptation uses an injected clock for reproducibility.

import type { Prisma, PrismaClient } from "@prisma/client";

import {
  loadMethodology,
  type FsrsGrade,
  type RatingPoint,
  type Track,
} from "@/methodology";
import {
  runAdaptation,
  type AdaptationEvent,
  type RunAdaptationResult,
  type ScheduleStateValue,
  type SkillStateValue,
} from "@/engine/adaptation";
import {
  recordEngagementForCompletion,
  type RewardEventView,
} from "@/server/engagement";
import { systemClock, type Clock } from "@/lib/clock";
import {
  fsrsStateSchema,
  logOutcomeInputSchema,
  type LogOutcomeInput,
} from "@/lib/tracker";
import {
  appendActivityEvent,
  countDueScheduleStates,
  createAdaptationLog,
  findRatingSnapshots,
  findScheduleStates,
  findSkillStates,
  upsertScheduleState,
  upsertSkillState,
} from "@/db/tracker";
import {
  appendSkillStateSnapshots,
  type SkillStateSnapshotInput,
} from "@/db/decision-input";
import { captureOperationalEvent } from "@/server/observability";
import { lockUserProgramMutation } from "@/db/user-mutation-lock";

type Db = Pick<
  PrismaClient,
  | "activityEvent"
  | "skillState"
  | "skillStateSnapshot"
  | "scheduleState"
  | "adaptationLog"
  | "chessProfileSnapshot"
  | "programItem"
  | "rewardEvent"
  | "notificationPref"
  | "$transaction"
>;

function ratingPointFromSnapshot(
  ratings: unknown,
  at: number,
): RatingPoint | null {
  if (!ratings || typeof ratings !== "object") return null;
  const r = ratings as Record<string, unknown>;
  for (const fmt of ["puzzle", "rapid", "blitz", "classical"]) {
    const f = r[fmt];
    if (f && typeof f === "object") {
      const rec = f as Record<string, unknown>;
      const rating = rec.rating;
      const rd = rec.rd;
      if (
        typeof rating === "number" &&
        Number.isFinite(rating) &&
        typeof rd === "number" &&
        Number.isFinite(rd)
      ) {
        return { at, rating: Math.round(rating), rd: Math.round(rd) };
      }
    }
  }
  return null;
}

/** Rating history returned oldest to newest. */
async function loadGlickoHistory(
  db: Db,
  userId: string,
): Promise<RatingPoint[]> {
  const snaps = await findRatingSnapshots(db, userId);
  const out: RatingPoint[] = [];
  for (const s of snaps) {
    const p = ratingPointFromSnapshot(s.ratings, s.capturedAt.getTime());
    if (p) out.push(p);
  }
  return out;
}

function toScheduleStateValues(
  rows: {
    itemRef: string;
    itemType: string;
    fsrsState: unknown;
    lastGrade: number | null;
    source: string;
  }[],
): ScheduleStateValue[] {
  const out: ScheduleStateValue[] = [];
  for (const row of rows) {
    const parsed = fsrsStateSchema.safeParse(row.fsrsState);
    if (!parsed.success) continue;
    out.push({
      itemRef: row.itemRef,
      itemType: row.itemType,
      fsrs: parsed.data,
      lastGrade: (row.lastGrade ?? 3) as FsrsGrade,
      source: row.source,
    });
  }
  return out;
}

async function persistAdaptation(
  db: Db,
  userId: string,
  result: RunAdaptationResult,
  inputsSnapshot: Prisma.InputJsonValue,
  methodologyVersion: string,
): Promise<void> {
  await db.$transaction(async (tx) => {
    const runAtDate = new Date(result.adaptationLog.runAt);
    const snapshotInputs: SkillStateSnapshotInput[] = [];
    for (const s of result.skillStateUpdates) {
      await upsertSkillState(tx, {
        userId,
        dimension: s.dimension,
        estimate: s.estimate,
        uncertainty: s.uncertainty,
        sampleSize: s.sampleSize,
      });
      // Keep both the latest view and immutable history.
      snapshotInputs.push({
        userId,
        dimension: s.dimension,
        estimate: s.estimate,
        uncertainty: s.uncertainty,
        sampleSize: s.sampleSize,
        methodologyVersion,
        runAt: runAtDate,
      });
    }
    if (snapshotInputs.length > 0) {
      await appendSkillStateSnapshots(tx, snapshotInputs);
    }
    for (const s of result.scheduleUpdates) {
      await upsertScheduleState(tx, {
        userId,
        itemRef: s.itemRef,
        itemType: s.itemType,
        fsrsState: s.fsrs as unknown as Prisma.InputJsonValue,
        due: new Date(s.fsrs.due),
        lastGrade: s.lastGrade,
        source: s.source,
      });
    }
    await createAdaptationLog(tx, {
      userId,
      runAt: runAtDate,
      trigger: result.adaptationLog.trigger,
      inputsSnapshot,
      decisions: result.adaptationLog
        .decisions as unknown as Prisma.InputJsonValue,
      methodologyVersion,
    });
  });
}

export interface LogOutcomeResult {
  scheduledReviews: number;
  decisions: number;
  dueReviews: number;
  rewardEvents: RewardEventView[];
}

export async function logOutcome(
  db: Db,
  userId: string,
  rawInput: LogOutcomeInput,
  clock: Clock = systemClock,
): Promise<LogOutcomeResult> {
  const input = logOutcomeInputSchema.parse(rawInput);
  const cfg = loadMethodology();
  const now = clock.now();
  const occurredAt = new Date(now);

  const payloadObj: Record<string, unknown> = {};
  if (input.correct !== undefined) payloadObj.correct = input.correct;
  if (input.solveTimeMs !== undefined)
    payloadObj.solveTimeMs = input.solveTimeMs;
  if (input.durationMin !== undefined)
    payloadObj.durationMin = input.durationMin;
  if (input.externalRef !== undefined)
    payloadObj.externalRef = input.externalRef;
  if (input.puzzleId !== undefined) payloadObj.puzzleId = input.puzzleId;
  if (input.practiceItemId !== undefined)
    payloadObj.practiceItemId = input.practiceItemId;
  if (input.resourceRefId !== undefined)
    payloadObj.resourceRefId = input.resourceRefId;
  if (input.position !== undefined) payloadObj.position = input.position;
  if (input.selfReport !== undefined) payloadObj.selfReport = input.selfReport;
  // Resolve, append, and mark the item while holding the same per-user lock used by
  // program replacement. A stale client cannot start a superseded Program.
  const eventContext = await db.$transaction(async (tx) => {
    await lockUserProgramMutation(tx, userId);
    let dimensions: string[] = [];
    let track: Track | null = null;
    let itemRef: string | null = null;
    let itemType: string | null = null;
    if (input.programItemId) {
      const item = await tx.programItem.findFirst({
        where: {
          id: input.programItemId,
          program: { userId, status: "active" },
        },
        select: { dimensionsTargeted: true, params: true, activityType: true },
      });
      if (!item) throw new Error("Program item not found or no longer active");
      dimensions = item.dimensionsTargeted;
      const p = (item.params ?? {}) as { track?: unknown; theme?: unknown };
      track =
        p.track === "pattern" || p.track === "calculation" ? p.track : null;
      const theme = typeof p.theme === "string" ? p.theme : null;
      if (input.type === "puzzle_attempt") {
        if (input.puzzleId) {
          itemRef = input.puzzleId;
          itemType = "puzzle";
        } else if (theme) {
          itemRef = theme;
          itemType = "puzzle_theme";
        }
      } else if (input.type === "drill_done" && input.practiceItemId) {
        itemRef = input.practiceItemId;
        itemType =
          item.activityType === "endgame_drill" ? "endgame" : "blunder_drill";
      }
    }
    if (input.type === "book_session" && dimensions.length === 0) {
      const bookDef = cfg.activities.find((a) => a.activityType === "book");
      if (bookDef) dimensions = [...bookDef.dimensions];
    }
    await appendActivityEvent(tx, {
      userId,
      programItemId: input.programItemId ?? null,
      type: input.type,
      occurredAt,
      payload: payloadObj as Prisma.InputJsonValue,
      source: "user",
    });
    if (input.programItemId) {
      await tx.programItem.update({
        where: { id: input.programItemId },
        data: { status: input.type === "skip" ? "skipped" : "done" },
      });
    }
    return { dimensions, track, itemRef, itemType };
  });
  const { dimensions, track, itemRef, itemType } = eventContext;

  const event: AdaptationEvent = {
    occurredAt: now,
    itemRef,
    itemType,
    correct: input.correct ?? null,
    solveTimeMs: input.solveTimeMs ?? null,
    bandMedianMs: null, // No band-median solve-time data is available.
    dimensions,
  };
  const skillState: SkillStateValue[] = await findSkillStates(db, userId);
  const scheduleState =
    itemRef && itemType
      ? toScheduleStateValues(
          await findScheduleStates(db, userId, [{ itemType, itemRef }]),
        )
      : [];
  const glickoHistory = await loadGlickoHistory(db, userId);

  const result = runAdaptation({
    events: [event],
    skillState,
    scheduleState,
    glickoHistory,
    trigger: "new_events",
    clock,
    config: cfg,
  });

  const inputsSnapshot = {
    event: {
      type: input.type,
      itemRef: event.itemRef,
      itemType: event.itemType,
      correct: event.correct,
      dimensions: event.dimensions,
      track,
    },
  } as unknown as Prisma.InputJsonValue;
  await persistAdaptation(db, userId, result, inputsSnapshot, cfg.version);

  // A skip is not a completion and must not produce recognition events.
  const rewardEvents =
    input.type === "skip"
      ? []
      : (await recordEngagementForCompletion(db, userId, now)).rewardEvents;

  const dueReviews = await countDueScheduleStates(db, userId, occurredAt);
  captureOperationalEvent({
    operation: "adaptation",
    status: "success",
    count: result.adaptationLog.decisions.length,
  });
  return {
    scheduledReviews: result.scheduleUpdates.length,
    decisions: result.adaptationLog.decisions.length,
    dueReviews,
    rewardEvents,
  };
}

export async function runDailyAdaptation(
  db: Db,
  userId: string,
  clock: Clock = systemClock,
): Promise<{ decisions: number }> {
  const cfg = loadMethodology();
  const now = clock.now();
  const dayStart = new Date(now);
  dayStart.setUTCHours(0, 0, 0, 0);
  const dayEnd = new Date(dayStart.getTime() + 86_400_000);

  const alreadyRun = await db.adaptationLog.findFirst({
    where: {
      userId,
      trigger: "daily_cron",
      runAt: { gte: dayStart, lt: dayEnd },
    },
    select: { id: true },
  });
  if (alreadyRun) return { decisions: 0 };

  const result = runAdaptation({
    events: [],
    skillState: await findSkillStates(db, userId),
    scheduleState: [],
    glickoHistory: await loadGlickoHistory(db, userId),
    trigger: "daily_cron",
    clock,
    config: cfg,
  });
  await persistAdaptation(
    db,
    userId,
    result,
    { dailyRun: dayStart.toISOString() } as Prisma.InputJsonValue,
    cfg.version,
  );
  captureOperationalEvent({
    operation: "adaptation",
    status: "success",
    count: result.adaptationLog.decisions.length,
  });
  return { decisions: result.adaptationLog.decisions.length };
}
