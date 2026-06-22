import { describe, expect, it } from "vitest";

import { loadMethodology } from "@/methodology/loader";
import { onStateChange, clampReminderCadence } from "@/engine/events";
import {
  consistencyGrid,
  consistencyStreak,
  dayIndexOf,
} from "@/engine/math/consistency";
import { DAY_MS } from "@/lib/clock";

// M9 engine plumbing (BUILD.md §9, §13.1). onStateChange shapes the Seam-9 events for
// persistence; clampReminderCadence is the anti-nag cap; the consistency math is generic
// day-bucketing. All pure (L2): deterministic over (inputs, config).
const cfg = loadMethodology("stub-0.1.0");

describe("onStateChange (engine event bus → persistable drafts)", () => {
  it("maps a completion to drafts carrying type + copyKey + payload (no forbidden type)", () => {
    const drafts = onStateChange(
      {
        activityCompleted: true,
        activeDayStreak: 3,
        completedCount: 3,
        dayMissed: false,
      },
      cfg,
    );
    const tick = drafts.find((d) => d.type === "streak_tick");
    expect(tick).toBeDefined();
    expect(tick!.copyKey).toBe("streak_tick");
    expect(tick!.payload.streakDay).toBe(3);
  });
});

describe("clampReminderCadence (anti-nag cap)", () => {
  it("clamps any request to the config ceiling (reminders capped)", () => {
    const cap = cfg.engagement.reminderCadenceCapPerDay.value;
    expect(clampReminderCadence(99, cfg)).toBe(cap);
    expect(clampReminderCadence(cap + 5, cfg)).toBe(cap);
  });

  it("passes through an in-range request and floors negatives/garbage to 0", () => {
    const cap = cfg.engagement.reminderCadenceCapPerDay.value;
    expect(clampReminderCadence(Math.min(1, cap), cfg)).toBe(Math.min(1, cap));
    expect(clampReminderCadence(0, cfg)).toBe(0);
    expect(clampReminderCadence(-3, cfg)).toBe(0);
    expect(clampReminderCadence(Number.NaN, cfg)).toBe(0);
  });
});

describe("consistency math (generic day bucketing)", () => {
  it("dayIndexOf buckets epochs into UTC days", () => {
    expect(dayIndexOf(0)).toBe(0);
    expect(dayIndexOf(DAY_MS)).toBe(1);
    expect(dayIndexOf(DAY_MS * 5 + 1)).toBe(5);
  });

  it("consistencyStreak counts the consecutive run ending today (0 if today inactive)", () => {
    const today = 100;
    expect(consistencyStreak(new Set([100, 99, 98]), today)).toBe(3);
    expect(consistencyStreak(new Set([99, 98]), today)).toBe(0); // today not active
    expect(consistencyStreak(new Set([100, 98, 97]), today)).toBe(1); // gap at 99
    expect(consistencyStreak(new Set(), today)).toBe(0);
  });

  it("consistencyGrid returns windowDays cells oldest→newest with active flags", () => {
    const grid = consistencyGrid(new Set([10, 8]), 10, 3);
    expect(grid).toEqual([
      { dayIndex: 8, active: true },
      { dayIndex: 9, active: false },
      { dayIndex: 10, active: true },
    ]);
  });
});
