import { describe, expect, it } from "vitest";
import type { PrismaClient } from "@prisma/client";

import {
  getEngagementSummary,
  recordEngagementForCompletion,
  recordEngagementForMissedDay,
  saveNotificationPref,
} from "@/server/engagement";
import { loadMethodology } from "@/methodology/loader";
import { DAY_MS, fixedClock } from "@/lib/clock";

// M9 server orchestration over an in-memory fake Prisma (mirrors server/tracker.test). The
// graded which/when/copy is golden-tested in the methodology + engine; this pins the plumbing:
// the streak/milestone rollup, the persisted RewardEvents, and the clamped reminder cadence.
const cfg = loadMethodology("stub-0.1.0");
const T = 1_700_000_000_000;
const clock = fixedClock(T);

interface Rec {
  rewardCreates: { type: string; copyKey: string; payload: unknown }[];
  prefUpserts: { cadenceCap: number; enabled: boolean; channel: string }[];
}

function fakeDb(opts: {
  activeEpochs?: number[];
  completedCount?: number;
  recentEvents?: {
    id: string;
    type: string;
    copyKey: string;
    payload: unknown;
    occurredAt: Date;
    seen: boolean;
  }[];
  pref?: {
    channel: string;
    cadenceCap: number;
    enabled: boolean;
    quietHours: string | null;
  } | null;
  plannedCount?: number;
}) {
  const rec: Rec = { rewardCreates: [], prefUpserts: [] };
  const db = {
    activityEvent: {
      findMany: async () =>
        (opts.activeEpochs ?? []).map((e) => ({ occurredAt: new Date(e) })),
      count: async () => opts.completedCount ?? 0,
    },
    rewardEvent: {
      createMany: async ({
        data,
      }: {
        data: { type: string; copyKey: string; payload: unknown }[];
      }) => {
        for (const d of data)
          rec.rewardCreates.push({
            type: d.type,
            copyKey: d.copyKey,
            payload: d.payload,
          });
        return { count: data.length };
      },
      findMany: async () => opts.recentEvents ?? [],
      findFirst: async () =>
        rec.rewardCreates.some((event) => event.type === "recovery_prompt")
          ? { id: "recovery" }
          : null,
    },
    programItem: { count: async () => opts.plannedCount ?? 0 },
    notificationPref: {
      findUnique: async () => opts.pref ?? null,
      upsert: async ({
        create,
      }: {
        create: { cadenceCap: number; enabled: boolean; channel: string };
      }) => {
        rec.prefUpserts.push({
          cadenceCap: create.cadenceCap,
          enabled: create.enabled,
          channel: create.channel,
        });
        return {
          channel: create.channel,
          cadenceCap: create.cadenceCap,
          enabled: create.enabled,
          quietHours: null,
        };
      },
    },
  } as unknown as PrismaClient;
  return { db, rec };
}

describe("recordEngagementForCompletion", () => {
  it("a first completion appends one capped streak tick (no milestone)", async () => {
    const { db, rec } = fakeDb({ activeEpochs: [T], completedCount: 1 });
    const res = await recordEngagementForCompletion(db, "u1", T);

    expect(rec.rewardCreates).toHaveLength(1);
    expect(rec.rewardCreates[0]!.type).toBe("streak_tick");
    expect(rec.rewardCreates[0]!.payload).toMatchObject({
      streakDay: 1,
      streak: 1,
    });
    // The returned view resolves its copy + grade from the copyKey (Seam 8).
    expect(res.rewardEvents[0]!.text.length).toBeGreaterThan(0);
    expect(res.rewardEvents[0]!.evidenceGrade).toBe("B");
  });

  it("a 3-day run that hits a milestone fires both a streak tick and a competence badge", async () => {
    const { db, rec } = fakeDb({
      activeEpochs: [T, T - DAY_MS, T - 2 * DAY_MS],
      completedCount: cfg.engagement.competenceMilestones.value[0]!, // e.g. 10
    });
    const res = await recordEngagementForCompletion(db, "u1", T);

    const types = rec.rewardCreates.map((r) => r.type).sort();
    expect(types).toEqual(["competence_milestone", "streak_tick"]);
    const tick = res.rewardEvents.find((e) => e.type === "streak_tick")!;
    expect(tick.payload.streak).toBe(3);
    const badge = res.rewardEvents.find(
      (e) => e.type === "competence_milestone",
    )!;
    expect(badge.payload.milestone).toBe(
      cfg.engagement.competenceMilestones.value[0],
    );
  });
});

describe("recordEngagementForMissedDay", () => {
  it("records one configured recovery prompt for a planned inactive day", async () => {
    const missedAt = Math.floor(T / DAY_MS) * DAY_MS - DAY_MS;
    const { db, rec } = fakeDb({ plannedCount: 1, activeEpochs: [] });

    const first = await recordEngagementForMissedDay(db, "u1", missedAt);
    const second = await recordEngagementForMissedDay(db, "u1", missedAt);

    expect(first.recorded).toBe(true);
    expect(second.recorded).toBe(false);
    expect(rec.rewardCreates.map((event) => event.type)).toEqual([
      "recovery_prompt",
    ]);
  });

  it("does nothing when no work was planned", async () => {
    const missedAt = Math.floor(T / DAY_MS) * DAY_MS - DAY_MS;
    const { db, rec } = fakeDb({ plannedCount: 0 });

    await expect(
      recordEngagementForMissedDay(db, "u1", missedAt),
    ).resolves.toEqual({ recorded: false });
    expect(rec.rewardCreates).toEqual([]);
  });
});

describe("saveNotificationPref (anti-nag cap enforced in code)", () => {
  it("clamps a greedy cadence request to the Seam-9 ceiling before persisting", async () => {
    const { db, rec } = fakeDb({});
    const cap = cfg.engagement.reminderCadenceCapPerDay.value;
    // 12/day is within the input-sanity bound (≤24) but well above the Seam-9 cap (≈1).
    const saved = await saveNotificationPref(db, "u1", {
      channel: "email",
      cadenceCap: 12,
      enabled: true,
    });
    expect(rec.prefUpserts[0]!.cadenceCap).toBe(cap);
    expect(saved.cadenceCap).toBe(cap);
    expect(saved.cap).toBe(cap);
  });
});

describe("getEngagementSummary", () => {
  it("returns the capped streak, the grid, and the reminder ceiling", async () => {
    const { db } = fakeDb({
      activeEpochs: [T, T - DAY_MS],
      pref: {
        channel: "email",
        cadenceCap: 1,
        enabled: true,
        quietHours: null,
      },
    });
    const summary = await getEngagementSummary(db, "u1", clock);

    expect(summary.streak.rawStreak).toBe(2);
    expect(summary.streak.day).toBeGreaterThanOrEqual(1);
    expect(summary.streak.day).toBeLessThanOrEqual(summary.streak.cap);
    expect(summary.grid.length).toBeGreaterThan(0);
    expect(summary.grid[summary.grid.length - 1]!.active).toBe(true); // today
    expect(summary.notifications.cap).toBe(
      cfg.engagement.reminderCadenceCapPerDay.value,
    );
    expect(summary.notifications.enabled).toBe(true);
  });
});
