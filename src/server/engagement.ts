// Engagement orchestration (BUILD.md §9, M9). The Engine owns the mechanism; Seam 9 owns the
// policy. This module is the I/O around the pure core: it rolls up the plumbing facts (active
// days → streak, completed count → milestones), calls onStateChange (which delegates the
// graded which/when/copy to engagementEventsFor), and persists/reads RewardEvent +
// NotificationPref. No graded decision lives here (L1: server orchestrates, it does not
// decide). The injected Clock keeps it reproducible (L2) — the router passes the system clock.

import type { Prisma, PrismaClient } from "@prisma/client";

import {
  loadMethodology,
  rationaleFor,
  type MethodologyConfig,
} from "@/methodology";
import { clampReminderCadence, onStateChange } from "@/engine/events";
import {
  consistencyGrid,
  consistencyStreak,
  dayIndexOf,
  type GridCell,
} from "@/engine/math/consistency";
import { DAY_MS, systemClock, type Clock } from "@/lib/clock";
import {
  notificationPrefInputSchema,
  type NotificationPrefInput,
} from "@/lib/engagement";
import {
  appendRewardEvents,
  countCompletedActivities,
  findActiveDayEpochs,
  findRecentRewardEvents,
  getNotificationPref,
  upsertNotificationPref,
} from "@/db/engagement";

type Db = Pick<
  PrismaClient,
  "activityEvent" | "rewardEvent" | "notificationPref"
>;

// How many days of the consistency window the grid renders (≈13 weeks); the streak/active
// counts still use the full Seam-9 window. Display bound only, not a methodology number.
const MAX_GRID_DAYS = 91;

/** A reward event shaped for the UI — copy/grade resolved from its Seam-8 copyKey (L3). */
export interface RewardEventView {
  id: string | null;
  type: string;
  copyKey: string;
  text: string;
  evidenceGrade: string;
  evidenceTier: number;
  citationKey: string;
  citationSource: string | null;
  soften: boolean;
  payload: { streakDay?: number; streak?: number; milestone?: number };
  occurredAt: Date | null;
  seen: boolean;
}

function payloadOf(raw: unknown): RewardEventView["payload"] {
  if (!raw || typeof raw !== "object") return {};
  const p = raw as Record<string, unknown>;
  const out: RewardEventView["payload"] = {};
  if (typeof p.streakDay === "number") out.streakDay = p.streakDay;
  if (typeof p.streak === "number") out.streak = p.streak;
  if (typeof p.milestone === "number") out.milestone = p.milestone;
  return out;
}

/** Resolve a fired/persisted event's graded copy from its copyKey (Seam 8). */
function toRewardView(
  e: {
    id?: string | null;
    type: string;
    copyKey: string;
    payload: unknown;
    occurredAt?: Date | null;
    seen?: boolean;
  },
  cfg: MethodologyConfig,
  ledger: Map<string, string>,
): RewardEventView {
  const r = rationaleFor(e.copyKey, cfg);
  return {
    id: e.id ?? null,
    type: e.type,
    copyKey: e.copyKey,
    text: r.value,
    evidenceGrade: r.grade,
    evidenceTier: r.tier,
    citationKey: r.citationKey,
    citationSource: ledger.get(r.citationKey) ?? null,
    soften: r.soften,
    payload: payloadOf(e.payload),
    occurredAt: e.occurredAt ?? null,
    seen: e.seen ?? false,
  };
}

function ledgerMap(cfg: MethodologyConfig): Map<string, string> {
  return new Map(cfg.evidenceLedger.map((a) => [a.key, a.source]));
}

/** The user's active-day set within the Seam-9 consistency window, plus `today`. */
async function activeDaySet(
  db: Db,
  userId: string,
  now: number,
  windowDays: number,
): Promise<Set<number>> {
  const epochs = await findActiveDayEpochs(
    db,
    userId,
    now - windowDays * DAY_MS,
  );
  const set = new Set(epochs.map(dayIndexOf));
  return set;
}

export interface EngagementOutcome {
  rewardEvents: RewardEventView[];
}

/**
 * Record the engagement events for a completed (non-skip) activity (§9). Rolls up the streak
 * + cumulative completion count, fires the Seam-9 events via the engine bus, and appends them.
 * Called by the tracker after an outcome is logged — this is how "completing a session emits a
 * competence event" (M9 DoD). Returns the fired events (copy resolved) for an immediate nudge.
 */
export async function recordEngagementForCompletion(
  db: Db,
  userId: string,
  now: number,
): Promise<EngagementOutcome> {
  const cfg = loadMethodology();
  const today = dayIndexOf(now);
  const active = await activeDaySet(
    db,
    userId,
    now,
    cfg.engagement.consistencyWindowDays.value,
  );
  active.add(today); // the just-logged completion makes today active
  const activeDayStreak = consistencyStreak(active, today);
  const completedCount = await countCompletedActivities(db, userId);

  const drafts = onStateChange(
    {
      activityCompleted: true,
      activeDayStreak,
      completedCount,
      dayMissed: false,
    },
    cfg,
  );

  await appendRewardEvents(
    db,
    drafts.map((d) => ({
      userId,
      type: d.type,
      copyKey: d.copyKey,
      occurredAt: new Date(now),
      payload: d.payload as Prisma.InputJsonValue,
    })),
  );

  const ledger = ledgerMap(cfg);
  return {
    rewardEvents: drafts.map((d) =>
      toRewardView(
        {
          type: d.type,
          copyKey: d.copyKey,
          payload: d.payload,
          occurredAt: new Date(now),
        },
        cfg,
        ledger,
      ),
    ),
  };
}

export interface EngagementSummary {
  streak: {
    /** Capped, forgiving streak position (1..cap), or 0 when today isn't active. */
    day: number;
    cap: number;
    /** The true consecutive-day run (for an honest, non-headline detail). */
    rawStreak: number;
    /** Active days within the consistency window. */
    activeDayCount: number;
    windowDays: number;
  };
  grid: { date: Date; active: boolean }[];
  gridCaption: {
    text: string;
    evidenceGrade: string;
    evidenceTier: number;
    citationKey: string;
    soften: boolean;
  };
  recentEvents: RewardEventView[];
  notifications: {
    enabled: boolean;
    channel: string;
    cadenceCap: number;
    quietHours: string | null;
    /** The Seam-9 ceiling the UI shows ("capped at N/day"). */
    cap: number;
  };
  habitExpectationDays: number;
}

/** The engagement dashboard's data: the consistency grid + capped streak, recent recognition,
 *  and the (capped) reminder settings. All copy graded via Seam 8. */
export async function getEngagementSummary(
  db: Db,
  userId: string,
  clock: Clock = systemClock,
): Promise<EngagementSummary> {
  const cfg = loadMethodology();
  const e = cfg.engagement;
  const now = clock.now();
  const today = dayIndexOf(now);
  const windowDays = e.consistencyWindowDays.value;
  const active = await activeDaySet(db, userId, now, windowDays);

  const rawStreak = consistencyStreak(active, today);
  const cap = e.streakCapDays.value;
  const day = rawStreak > 0 ? ((rawStreak - 1) % cap) + 1 : 0;

  const gridDays = Math.min(windowDays, MAX_GRID_DAYS);
  const cells: GridCell[] = consistencyGrid(active, today, gridDays);
  const grid = cells.map((c) => ({
    date: new Date(c.dayIndex * DAY_MS),
    active: c.active,
  }));

  const ledger = ledgerMap(cfg);
  const recent = await findRecentRewardEvents(db, userId, 8);
  const recentEvents = recent.map((r) => toRewardView(r, cfg, ledger));

  const pref = await getNotificationPref(db, userId);
  const caption = rationaleFor("consistency_grid", cfg);

  return {
    streak: {
      day,
      cap,
      rawStreak,
      activeDayCount: cells.filter((c) => c.active).length,
      windowDays,
    },
    grid,
    gridCaption: {
      text: caption.value,
      evidenceGrade: caption.grade,
      evidenceTier: caption.tier,
      citationKey: caption.citationKey,
      soften: caption.soften,
    },
    recentEvents,
    notifications: {
      enabled: pref?.enabled ?? false,
      channel: pref?.channel ?? "none",
      cadenceCap: pref?.cadenceCap ?? 0,
      quietHours: pref?.quietHours ?? null,
      cap: e.reminderCadenceCapPerDay.value,
    },
    habitExpectationDays: e.habitExpectationDays.value,
  };
}

export interface SavedNotificationPref {
  enabled: boolean;
  channel: string;
  cadenceCap: number;
  quietHours: string | null;
  cap: number;
}

/**
 * Save reminder preferences, clamping the requested cadence to the Seam-9 ceiling
 * (clampReminderCadence) before write — the anti-nag cap is enforced in code and can never be
 * exceeded by a client (M9 DoD: reminders capped & user-configurable).
 */
export async function saveNotificationPref(
  db: Db,
  userId: string,
  rawInput: NotificationPrefInput,
): Promise<SavedNotificationPref> {
  const input = notificationPrefInputSchema.parse(rawInput);
  const cfg = loadMethodology();
  const cadenceCap = clampReminderCadence(input.cadenceCap, cfg);
  const saved = await upsertNotificationPref(db, {
    userId,
    channel: input.channel,
    cadenceCap,
    enabled: input.enabled,
    quietHours: input.quietHours ?? null,
  });
  return {
    enabled: saved.enabled,
    channel: saved.channel,
    cadenceCap: saved.cadenceCap,
    quietHours: saved.quietHours,
    cap: cfg.engagement.reminderCadenceCapPerDay.value,
  };
}
