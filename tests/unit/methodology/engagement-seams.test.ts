import { describe, expect, it } from "vitest";

import { loadMethodology } from "@/methodology/loader";
import {
  engagementEventsFor,
  type EngagementStateChange,
} from "@/methodology/provider";

// Golden tests for the M9 engagement seam (BUILD.md §13.1), pinned to the stub config.
// Deterministic (L2): pure (change, config) → events. These also prove the §9 forbid list is
// structural — no forbidden mechanic can ever be emitted, and the streak is always capped.
const cfg = loadMethodology("stub-0.1.0");
const ALLOWED = new Set([
  "streak_tick",
  "competence_milestone",
  "consistency_grid",
  "recovery_prompt",
]);

const completion = (
  over: Partial<EngagementStateChange> = {},
): EngagementStateChange => ({
  activityCompleted: true,
  activeDayStreak: 1,
  completedCount: 1,
  dayMissed: false,
  ...over,
});

describe("engagementEventsFor (Seam 9 — state change → reward events)", () => {
  it("a completion fires a capped streak tick carrying its grade (from the copyKey)", () => {
    const events = engagementEventsFor(completion(), cfg);
    const tick = events.find((e) => e.type === "streak_tick");
    expect(tick).toBeDefined();
    expect(tick!.copyKey).toBe("streak_tick");
    expect(tick!.payload.streakDay).toBe(1);
    expect(tick!.payload.streak).toBe(1);
    // Grade + citation come from the Seam-8 rationale entry, never invented here.
    expect(tick!.evidenceGrade).toBe("B");
    expect(tick!.citationKey).toBe("silverman_barasch2023");
    expect(tick!.soften).toBe(false);
  });

  it("the streak is CAPPED — the displayed number cycles 1..cap and never grows unbounded", () => {
    const cap = cfg.engagement.streakCapDays.value;
    for (const n of [1, cap, cap + 1, 2 * cap, 100, 1000]) {
      const events = engagementEventsFor(
        completion({ activeDayStreak: n }),
        cfg,
      );
      const tick = events.find((e) => e.type === "streak_tick")!;
      expect(tick.payload.streakDay).toBeGreaterThanOrEqual(1);
      expect(tick.payload.streakDay).toBeLessThanOrEqual(cap);
    }
    // The cycle resets exactly at the cap.
    expect(
      engagementEventsFor(completion({ activeDayStreak: cap }), cfg).find(
        (e) => e.type === "streak_tick",
      )!.payload.streakDay,
    ).toBe(cap);
    expect(
      engagementEventsFor(completion({ activeDayStreak: cap + 1 }), cfg).find(
        (e) => e.type === "streak_tick",
      )!.payload.streakDay,
    ).toBe(1);
  });

  it("crossing a configured milestone fires a competence badge; a non-milestone count does not", () => {
    const milestone = cfg.engagement.competenceMilestones.value[0]!;
    const hit = engagementEventsFor(
      completion({ completedCount: milestone }),
      cfg,
    );
    const badge = hit.find((e) => e.type === "competence_milestone");
    expect(badge).toBeDefined();
    expect(badge!.payload.milestone).toBe(milestone);
    expect(badge!.citationKey).toBe("deci1999");

    const miss = engagementEventsFor(
      completion({ completedCount: milestone + 1 }),
      cfg,
    );
    expect(miss.find((e) => e.type === "competence_milestone")).toBeUndefined();
  });

  it("a missed day fires a forgiving recovery prompt — and no streak/competence event", () => {
    const events = engagementEventsFor(
      {
        activityCompleted: false,
        activeDayStreak: 0,
        completedCount: null,
        dayMissed: true,
      },
      cfg,
    );
    expect(events.map((e) => e.type)).toEqual(["recovery_prompt"]);
    expect(events[0]!.copyKey).toBe("recovery_prompt");
    expect(events[0]!.soften).toBe(false);
  });

  it("no completion and no missed day → no events (nothing fabricated)", () => {
    expect(
      engagementEventsFor(
        {
          activityCompleted: false,
          activeDayStreak: 0,
          completedCount: 0,
          dayMissed: false,
        },
        cfg,
      ),
    ).toEqual([]);
  });

  it("forbidden mechanics are unrepresentable: every emitted type is in the allowed taxonomy", () => {
    const inputs: EngagementStateChange[] = [
      completion(),
      completion({ activeDayStreak: 50, completedCount: 50 }),
      {
        activityCompleted: false,
        activeDayStreak: 0,
        completedCount: null,
        dayMissed: true,
      },
    ];
    for (const change of inputs) {
      for (const e of engagementEventsFor(change, cfg)) {
        expect(ALLOWED.has(e.type)).toBe(true);
      }
    }
    // The forbid list is enforced by config: global leaderboards are OFF (a dark pattern).
    expect(cfg.engagement.globalLeaderboards.value).toBe(false);
    // …and every event rule in the config maps to an allowed type (no smuggled mechanic).
    for (const rule of cfg.engagement.events) {
      expect(ALLOWED.has(rule.type)).toBe(true);
    }
  });
});
