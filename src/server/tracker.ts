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
import { DAY_MS, systemClock, type Clock } from "@/lib/clock";
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
import { expectedError } from "@/server/errors";

type TrackerDb = Pick<
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
>;

type Db = TrackerDb & Pick<PrismaClient, "$transaction">;

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
  db: TrackerDb,
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
  db: TrackerDb,
  userId: string,
  result: RunAdaptationResult,
  inputsSnapshot: Prisma.InputJsonValue,
  methodologyVersion: string,
): Promise<void> {
  const runAtDate = new Date(result.adaptationLog.runAt);
  const snapshotInputs: SkillStateSnapshotInput[] = [];
  for (const s of result.skillStateUpdates) {
    await upsertSkillState(db, {
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
    await appendSkillStateSnapshots(db, snapshotInputs);
  }
  for (const s of result.scheduleUpdates) {
    await upsertScheduleState(db, {
      userId,
      itemRef: s.itemRef,
      itemType: s.itemType,
      fsrsState: s.fsrs as unknown as Prisma.InputJsonValue,
      due: new Date(s.fsrs.due),
      lastGrade: s.lastGrade,
      source: s.source,
    });
  }
  await createAdaptationLog(db, {
    userId,
    runAt: runAtDate,
    trigger: result.adaptationLog.trigger,
    inputsSnapshot,
    decisions: result.adaptationLog
      .decisions as unknown as Prisma.InputJsonValue,
    methodologyVersion,
  });
}

export interface LogOutcomeResult {
  scheduledReviews: number;
  decisions: number;
  dueReviews: number;
  rewardEvents: RewardEventView[];
}

export async function undoSkip(
  db: Pick<PrismaClient, "activityEvent" | "programItem" | "$transaction">,
  userId: string,
  programItemId: string,
  clock: Clock = systemClock,
): Promise<void> {
  await db.$transaction(async (tx) => {
    await lockUserProgramMutation(tx, userId);
    const item = await tx.programItem.findFirst({
      where: {
        id: programItemId,
        status: "skipped",
        program: { userId, status: "active" },
      },
      select: {
        activityEvents: {
          where: { type: "skip" },
          orderBy: [{ occurredAt: "desc" }, { id: "desc" }],
          take: 1,
          select: { id: true },
        },
      },
    });
    const skippedEvent = item?.activityEvents[0];
    if (!skippedEvent)
      throw expectedError.conflict(
        "That block changed since this page loaded. Reload Today before undoing the skip.",
      );

    await appendActivityEvent(tx, {
      userId,
      programItemId,
      type: "skip_undone",
      occurredAt: new Date(clock.now()),
      payload: { reversesEventId: skippedEvent.id },
      source: "user",
    });
    await tx.programItem.update({
      where: { id: programItemId },
      data: { status: "todo" },
    });
  });
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
  // Keep the append-only event, adaptation state, and rewards atomic. The request id makes
  // a retry after a lost response a no-op while the per-user lock serializes concurrent work.
  const transactionResult = await db.$transaction(async (tx) => {
    await lockUserProgramMutation(tx, userId);
    const existing = await tx.activityEvent.findUnique({
      where: {
        userId_requestId: { userId, requestId: input.requestId },
      },
      select: { id: true },
    });
    if (existing) {
      return {
        duplicate: true,
        result: {
          scheduledReviews: 0,
          decisions: 0,
          dueReviews: await countDueScheduleStates(tx, userId, occurredAt),
          rewardEvents: [],
        } satisfies LogOutcomeResult,
      };
    }

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
      if (!item) {
        throw expectedError.conflict(
          "That block changed since this page loaded. Reload Today before logging it.",
        );
      }
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
      requestId: input.requestId,
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

    const event: AdaptationEvent = {
      occurredAt: now,
      itemRef,
      itemType,
      correct: input.correct ?? null,
      solveTimeMs: input.solveTimeMs ?? null,
      bandMedianMs: null, // No band-median solve-time data is available.
      dimensions,
    };
    const skillState: SkillStateValue[] = await findSkillStates(tx, userId);
    const scheduleState =
      itemRef && itemType
        ? toScheduleStateValues(
            await findScheduleStates(tx, userId, [{ itemType, itemRef }]),
          )
        : [];
    const glickoHistory = await loadGlickoHistory(tx, userId);

    const adaptation = runAdaptation({
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
    await persistAdaptation(
      tx,
      userId,
      adaptation,
      inputsSnapshot,
      cfg.version,
    );

    // A skip is not a completion and must not produce recognition events.
    const rewardEvents =
      input.type === "skip"
        ? []
        : (await recordEngagementForCompletion(tx, userId, now)).rewardEvents;

    return {
      duplicate: false,
      result: {
        scheduledReviews: adaptation.scheduleUpdates.length,
        decisions: adaptation.adaptationLog.decisions.length,
        dueReviews: await countDueScheduleStates(tx, userId, occurredAt),
        rewardEvents,
      } satisfies LogOutcomeResult,
    };
  });

  captureOperationalEvent({
    operation: "adaptation",
    status: transactionResult.duplicate ? "skipped" : "success",
    count: transactionResult.result.decisions,
  });
  return transactionResult.result;
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
  const dayEnd = new Date(dayStart.getTime() + DAY_MS);

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
