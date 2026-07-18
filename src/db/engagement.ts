// Typed query helpers for the engagement plumbing (BUILD.md §4: db/ holds query helpers, NO
// business logic). The graded DECISIONS (which events fire, the cadence cap) happen upstream
// in the methodology provider + engine/events; this module only appends reward events and
// reads/writes state. Each helper takes a narrow client (the model[s] it touches) so the
// transaction client and test fakes can pass exactly what they need.

import type { Prisma, PrismaClient } from "@prisma/client";

import { NON_COMPLETION_ACTIVITY_EVENT_TYPES } from "@/lib/tracker";

// --- Append-only RewardEvent log (§5.7 — never updated except `seen`) ----------

export interface RewardEventInput {
  userId: string;
  type: string;
  copyKey: string;
  occurredAt: Date;
  payload: Prisma.InputJsonValue;
}

/** Append fired reward events (seen=false). No-op for an empty batch. */
export async function appendRewardEvents(
  db: Pick<PrismaClient, "rewardEvent">,
  inputs: readonly RewardEventInput[],
): Promise<void> {
  if (inputs.length === 0) return;
  await db.rewardEvent.createMany({
    data: inputs.map((i) => ({
      userId: i.userId,
      type: i.type,
      copyKey: i.copyKey,
      occurredAt: i.occurredAt,
      payload: i.payload,
      seen: false,
    })),
  });
}

/** The most recent reward events for the user (newest first), for the dashboard. */
export async function findRecentRewardEvents(
  db: Pick<PrismaClient, "rewardEvent">,
  userId: string,
  limit: number,
) {
  return db.rewardEvent.findMany({
    where: { userId },
    orderBy: { occurredAt: "desc" },
    take: limit,
    select: {
      id: true,
      type: true,
      copyKey: true,
      payload: true,
      occurredAt: true,
      seen: true,
    },
  });
}

/** Latest unseen event of one configured type, independent of the recent-event display cap. */
export async function findLatestUnseenRewardEvent(
  db: Pick<PrismaClient, "rewardEvent">,
  userId: string,
  type: string,
) {
  return db.rewardEvent.findFirst({
    where: { userId, type, seen: false },
    orderBy: [{ occurredAt: "desc" }, { id: "desc" }],
    select: {
      id: true,
      type: true,
      copyKey: true,
      payload: true,
      occurredAt: true,
      seen: true,
    },
  });
}

/** Mark reward events seen (the only mutation allowed on the append-only log). */
export async function markRewardEventsSeen(
  db: Pick<PrismaClient, "rewardEvent">,
  userId: string,
  ids: readonly string[],
): Promise<number> {
  if (ids.length === 0) return 0;
  const res = await db.rewardEvent.updateMany({
    where: { userId, id: { in: [...ids] } },
    data: { seen: true },
  });
  return res.count;
}

// --- Activity rollups the engagement bus reads (streak / milestones) ----------

/** Timestamps (epoch ms) of every completed activity since `sinceEpoch`, bucketed into
 *  active days by the caller (engine/math/consistency). Excludes skips and skip undones. */
export async function findActiveDayEpochs(
  db: Pick<PrismaClient, "activityEvent">,
  userId: string,
  sinceEpoch: number,
): Promise<number[]> {
  const rows = await db.activityEvent.findMany({
    where: {
      userId,
      type: { notIn: [...NON_COMPLETION_ACTIVITY_EVENT_TYPES] },
      occurredAt: { gte: new Date(sinceEpoch) },
      OR: [
        { programItemId: null },
        { programItem: { is: { status: "done" } } },
      ],
    },
    select: { occurredAt: true, programItemId: true },
  });

  const standaloneEpochs: number[] = [];
  const completedItemEpochs = new Map<string, number>();
  for (const row of rows) {
    const epoch = row.occurredAt.getTime();
    if (!row.programItemId) {
      standaloneEpochs.push(epoch);
      continue;
    }
    completedItemEpochs.set(
      row.programItemId,
      Math.max(completedItemEpochs.get(row.programItemId) ?? 0, epoch),
    );
  }
  return [...standaloneEpochs, ...completedItemEpochs.values()];
}

/** Cumulative count of completed activities, used by the competence-milestone counter.
 *  Program items count once regardless of their number of outcome observations. */
export async function countCompletedActivities(
  db: Pick<PrismaClient, "activityEvent" | "programItem">,
  userId: string,
): Promise<number> {
  const [completedProgramItems, standaloneCompletions] = await Promise.all([
    db.programItem.count({
      where: { program: { userId }, status: "done" },
    }),
    db.activityEvent.count({
      where: {
        userId,
        programItemId: null,
        type: { notIn: [...NON_COMPLETION_ACTIVITY_EVENT_TYPES] },
      },
    }),
  ]);
  return completedProgramItems + standaloneCompletions;
}

// --- NotificationPref (one per user) ------------------------------------------

export async function getNotificationPref(
  db: Pick<PrismaClient, "notificationPref">,
  userId: string,
) {
  return db.notificationPref.findUnique({
    where: { userId },
    select: {
      channel: true,
      cadenceCap: true,
      enabled: true,
      quietHours: true,
    },
  });
}

export interface NotificationPrefUpsert {
  userId: string;
  channel: string;
  cadenceCap: number;
  enabled: boolean;
  quietHours: string | null;
}

export async function upsertNotificationPref(
  db: Pick<PrismaClient, "notificationPref">,
  input: NotificationPrefUpsert,
) {
  const { userId, ...rest } = input;
  return db.notificationPref.upsert({
    where: { userId },
    create: { userId, ...rest },
    update: rest,
    select: {
      channel: true,
      cadenceCap: true,
      enabled: true,
      quietHours: true,
    },
  });
}
