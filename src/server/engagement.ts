// Persists engagement events and preferences. Engine and methodology own policy.
// Summary generation uses an injected clock for reproducibility.

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
  "activityEvent" | "rewardEvent" | "notificationPref" | "programItem"
>;

// Display bound only; streak calculations still use the full methodology window.
const MAX_GRID_DAYS = 91;

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
  active.add(today);
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

/**
 * Fire the configured recovery event for one genuinely missed planned day. The job key
 * provides concurrency control; the existing-event check also makes a post-write retry safe.
 */
export async function recordEngagementForMissedDay(
  db: Db,
  userId: string,
  missedDayStart: number,
): Promise<{ recorded: boolean }> {
  const missedStart = new Date(missedDayStart);
  const missedEnd = new Date(missedDayStart + DAY_MS);
  const alreadyRecorded = await db.rewardEvent.findFirst({
    where: {
      userId,
      type: "recovery_prompt",
      occurredAt: { gte: missedStart, lt: missedEnd },
    },
    select: { id: true },
  });
  if (alreadyRecorded) return { recorded: false };

  const planned = await db.programItem.count({
    where: {
      program: { userId },
      date: { gte: missedStart, lt: missedEnd },
    },
  });
  if (planned === 0) return { recorded: false };

  const cfg = loadMethodology();
  const active = await activeDaySet(
    db,
    userId,
    missedDayStart + DAY_MS - 1,
    cfg.engagement.consistencyWindowDays.value,
  );
  const missedDay = dayIndexOf(missedDayStart);
  if (active.has(missedDay)) return { recorded: false };

  const drafts = onStateChange(
    {
      activityCompleted: false,
      activeDayStreak: consistencyStreak(active, missedDay - 1),
      completedCount: await countCompletedActivities(db, userId),
      dayMissed: true,
    },
    cfg,
  );
  await appendRewardEvents(
    db,
    drafts.map((draft) => ({
      userId,
      type: draft.type,
      copyKey: draft.copyKey,
      occurredAt: missedStart,
      payload: draft.payload as Prisma.InputJsonValue,
    })),
  );
  return { recorded: drafts.length > 0 };
}

export interface EngagementSummary {
  streak: {
    day: number;
    cap: number;
    rawStreak: number;
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
    cap: number;
  };
  habitExpectationDays: number;
}

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

/** Clamp reminder cadence to methodology policy before persistence. */
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
