// Tracker + adaptation orchestration (BUILD.md M7 · §7.3, §7.4). `logOutcome` is the
// `applyEvent` of the contract: it appends ONE immutable ActivityEvent, then runs the pure
// adaptation loop over the new event + current state and persists the result. The graded
// DECISIONS live in the pure core (engine/adaptation.runAdaptation) + the methodology
// provider; this module only does I/O and mapping (L1: server orchestrates, never decides).
// The injected Clock keeps the run reproducible (L2) — the router passes the system clock;
// tests pass a fixed one.

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

type Db = Pick<
  PrismaClient,
  | "activityEvent"
  | "skillState"
  | "scheduleState"
  | "adaptationLog"
  | "chessProfileSnapshot"
  | "programItem"
  | "rewardEvent"
  | "notificationPref"
  | "$transaction"
>;

/** Pull a (rating, rd) point from a snapshot's ratings JSON; null if no usable format. */
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

/** The user's Glicko-2 rating history (oldest→newest) for plateau/progress detection. */
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

/** Re-parse persisted ScheduleState rows into the engine's ScheduleStateValue shape. */
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
    for (const s of result.skillStateUpdates) {
      await upsertSkillState(tx, {
        userId,
        dimension: s.dimension,
        estimate: s.estimate,
        uncertainty: s.uncertainty,
        sampleSize: s.sampleSize,
      });
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
      runAt: new Date(result.adaptationLog.runAt),
      trigger: result.adaptationLog.trigger,
      inputsSnapshot,
      decisions: result.adaptationLog
        .decisions as unknown as Prisma.InputJsonValue,
      methodologyVersion,
    });
  });
}

export interface LogOutcomeResult {
  /** Spaced reviews scheduled/updated by this outcome. */
  scheduledReviews: number;
  /** Decisions recorded in the AdaptationLog. */
  decisions: number;
  /** Total reviews now due (so the UI can nudge "N due"). */
  dueReviews: number;
  /** Engagement events fired by this completion (Seam 9) — for an immediate, honest nudge. */
  rewardEvents: RewardEventView[];
}

/**
 * `applyEvent` (§7.3): append one immutable outcome, run the adaptation loop, persist its
 * updates + log. Returns a small summary the UI surfaces. Pure decisions happen inside
 * runAdaptation; everything here is plumbing.
 */
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

  // 1. Resolve the originating program item → dimensions/track and a schedulable ref.
  let dimensions: string[] = [];
  let track: Track | null = null;
  let itemRef: string | null = null;
  let itemType: string | null = null;
  if (input.programItemId) {
    const item = await db.programItem.findUnique({
      where: { id: input.programItemId },
      select: { dimensionsTargeted: true, params: true },
    });
    if (item) {
      dimensions = item.dimensionsTargeted;
      const p = (item.params ?? {}) as { track?: unknown; theme?: unknown };
      track =
        p.track === "pattern" || p.track === "calculation" ? p.track : null;
      const theme = typeof p.theme === "string" ? p.theme : null;
      // v0: a puzzle MISS schedules a spaced redo of its theme — the puzzle DB isn't
      // ingested yet, so theme selection (Seam 4/5) is the schedulable unit, not a puzzle id.
      if (input.type === "puzzle_attempt" && theme) {
        itemRef = theme;
        itemType = "puzzle_theme";
      }
    }
  }

  // 2. Append the immutable event (the append-only substrate, §7.3 — never updated/deleted).
  const payloadObj: Record<string, unknown> = {};
  if (input.correct !== undefined) payloadObj.correct = input.correct;
  if (input.solveTimeMs !== undefined)
    payloadObj.solveTimeMs = input.solveTimeMs;
  if (input.durationMin !== undefined)
    payloadObj.durationMin = input.durationMin;
  if (input.externalRef !== undefined)
    payloadObj.externalRef = input.externalRef;
  await appendActivityEvent(db, {
    userId,
    programItemId: input.programItemId ?? null,
    type: input.type,
    occurredAt,
    payload: payloadObj as Prisma.InputJsonValue,
    source: "user",
  });

  // 3. Mark the originating item done/skipped (plan state — distinct from the immutable log).
  if (input.programItemId) {
    await db.programItem.update({
      where: { id: input.programItemId },
      data: { status: input.type === "skip" ? "skipped" : "done" },
    });
  }

  // 4. Run the pure adaptation loop over the new event + current state.
  const event: AdaptationEvent = {
    type: input.type,
    occurredAt: now,
    itemRef,
    itemType,
    correct: input.correct ?? null,
    solveTimeMs: input.solveTimeMs ?? null,
    bandMedianMs: null, // STUB: no band-median solve-time data yet (Seam 6).
    dimensions,
    track,
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

  // 5. Persist the updates + the graded log (reproducibility snapshot).
  const inputsSnapshot = {
    event: {
      type: event.type,
      itemRef: event.itemRef,
      itemType: event.itemType,
      correct: event.correct,
      dimensions: event.dimensions,
      track: event.track,
    },
  } as unknown as Prisma.InputJsonValue;
  await persistAdaptation(db, userId, result, inputsSnapshot, cfg.version);

  // 6. Fire engagement events for the completion (Seam 9 plumbing) — a skip is not a
  //    completion, so it never ticks the streak or earns a badge (the forgiving design).
  const rewardEvents =
    input.type === "skip"
      ? []
      : (await recordEngagementForCompletion(db, userId, now)).rewardEvents;

  const dueReviews = await countDueScheduleStates(db, userId, occurredAt);
  return {
    scheduledReviews: result.scheduleUpdates.length,
    decisions: result.adaptationLog.decisions.length,
    dueReviews,
    rewardEvents,
  };
}
