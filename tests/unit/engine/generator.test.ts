import { describe, expect, it } from "vitest";

import { fixedClock } from "@/lib/clock";
import { loadMethodology } from "@/methodology/loader";
import { generateProgram } from "@/engine/generator";
import type { WeaknessSignal } from "@/methodology/provider";

// Golden tests for the program generator (BUILD.md §13.1 + the M6 DoD): fixed inputs +
// a pinned config version → an exact ordered program, including rationale keys + grades
// (L3), and a session that fits the time budget. Deterministic (L2) via the injected Clock.
const cfg = loadMethodology("stub-0.1.0");
const clock = fixedClock(1_700_000_000_000);

describe("generateProgram (golden)", () => {
  it("builds a deterministic, budget-fitting day for a fresh user (no signals)", () => {
    const { items, band, generatedAt } = generateProgram({
      band: "b1200_1600",
      tacticalRating: 1300,
      weaknessSignals: [],
      dueItems: [],
      constraints: { minutesPerDay: 30 },
      clock,
      config: cfg,
    });

    expect(band).toBe("b1200_1600");
    expect(generatedAt).toBe(1_700_000_000_000); // from the injected clock (L2)

    // Order by ROI prior with id tiebreak. Hard-time-limit packing (Goal 1) fits the budget
    // with time-divisible puzzles: analyse(15, fixed) + themed_tactics(15 puzzles ×0.75 =
    // 11.25) + calculation_drill(1 ×3 = 3) = 29.25 ≤ 30 — a third item now fits.
    expect(items.map((i) => i.activityId)).toEqual([
      "analyse_own_games",
      "themed_tactics",
      "calculation_drill",
    ]);
    expect(items.reduce((sum, i) => sum + i.estMinutes, 0)).toBeLessThanOrEqual(
      30,
    );
    expect(items.map((i) => i.orderIndex)).toEqual([0, 1, 2]);
  });

  it("every item carries a graded, snapshotted 'why' (L3)", () => {
    const { items } = generateProgram({
      band: "b1200_1600",
      tacticalRating: 1300,
      weaknessSignals: [],
      dueItems: [],
      constraints: { minutesPerDay: 30 },
      clock,
      config: cfg,
    });
    for (const item of items) {
      expect(item.rationaleText.length).toBeGreaterThan(0);
      expect(["A", "B", "C", "D"]).toContain(item.evidenceGrade);
      expect(item.citationKey.length).toBeGreaterThan(0);
      // C/D grades must be softened so a placeholder never renders as fact.
      if (item.evidenceGrade === "C" || item.evidenceGrade === "D") {
        expect(item.soften).toBe(true);
      }
    }

    const tactics = items.find((i) => i.activityId === "themed_tactics")!;
    expect(tactics.activityType).toBe("puzzle_theme");
    expect(tactics.params).toMatchObject({
      theme: "fork",
      track: "pattern",
      targetRating: 1150, // servo seed target at b1200_1600
      successTarget: 0.8,
      count: 15,
      structure: "clustered",
      workedExample: false,
    });
    expect(tactics.evidenceGrade).toBe("B");
    expect(tactics.confidence).toBe("low"); // band prior, not the user's own data
  });

  it("a weakness signal reorders the day and snapshots the signal's confidence + theme", () => {
    const signal: WeaknessSignal = {
      dimension: "board_vision",
      severity: 1,
      confidence: "medium",
      sampleSize: 40,
      evidenceGrade: "C",
      evidenceTier: 1,
      citationKey: "smith_tikkanen2018",
      rationaleKey: "blunder_focus",
    };
    const { items } = generateProgram({
      band: "b1200_1600",
      tacticalRating: 1300,
      weaknessSignals: [signal],
      dueItems: [],
      constraints: { minutesPerDay: 60 },
      clock,
      config: cfg,
    });

    // themed_tactics is elevated to the top by the weakness severity.
    expect(items[0]!.activityId).toBe("themed_tactics");
    const tactics = items[0]!;
    expect(tactics.params.theme).toBe("hangingPiece"); // rule theme override
    expect(tactics.rationaleKey).toBe("blunder_focus");
    expect(tactics.confidence).toBe("medium"); // from the driving signal
    expect(tactics.soften).toBe(true); // blunder_focus is grade C
  });

  it("sizes the session to the hard time budget — never over, fewer puzzles when shorter (Goal 1)", () => {
    const common = {
      band: "b1200_1600" as const,
      tacticalRating: 1300,
      weaknessSignals: [],
      dueItems: [],
      clock,
      config: cfg,
    };
    const big = generateProgram({
      ...common,
      constraints: { minutesPerDay: 30 },
    });
    const small = generateProgram({
      ...common,
      constraints: { minutesPerDay: 10 },
    });

    const total = (r: ReturnType<typeof generateProgram>): number =>
      r.items.reduce((s, i) => s + i.estMinutes, 0);
    // The binding metric is time: each session stays at or under its budget.
    expect(total(big)).toBeLessThanOrEqual(30);
    expect(total(small)).toBeLessThanOrEqual(10);

    // A shorter budget yields no more tactics puzzles than a longer one (time-derived count).
    const puzzles = (r: ReturnType<typeof generateProgram>): number =>
      r.items.find((i) => i.activityId === "themed_tactics")?.params.count ?? 0;
    expect(puzzles(small)).toBeLessThanOrEqual(puzzles(big));
  });

  it("always yields at least one item even on a tiny budget", () => {
    const { items } = generateProgram({
      band: "b1200_1600",
      tacticalRating: 1300,
      weaknessSignals: [],
      dueItems: [],
      constraints: { minutesPerDay: 1 },
      clock,
      config: cfg,
    });
    expect(items.length).toBe(1);
  });

  it("surfaces due reviews as a spaced-review item carrying the due refs (M7)", () => {
    const { items } = generateProgram({
      band: "b1200_1600",
      tacticalRating: 1300,
      weaknessSignals: [],
      dueItems: [{ itemRef: "fork", itemType: "puzzle_theme" }],
      constraints: { minutesPerDay: 60 },
      clock,
      config: cfg,
    });
    const review = items.find((i) => i.activityType === "spaced_review");
    expect(review).toBeDefined();
    expect(review!.params.dueItemRefs).toEqual(["fork"]);
    expect(review!.params.count).toBe(1);
    // No due items → no spaced-review item (the prior goldens confirm it's dropped).
  });

  it("a higher recent success nudges the puzzle target harder (servo, M7)", () => {
    const common = {
      band: "b1200_1600" as const,
      tacticalRating: 1300,
      weaknessSignals: [],
      dueItems: [],
      constraints: { minutesPerDay: 60 },
      clock,
      config: cfg,
    };
    const seedOnly = generateProgram(common);
    const hot = generateProgram({
      ...common,
      recentSuccessByTrack: { pattern: 0.95 },
    });
    const target = (r: ReturnType<typeof generateProgram>): number =>
      r.items.find((i) => i.activityId === "themed_tactics")!.params
        .targetRating!;
    expect(target(hot)).toBeGreaterThan(target(seedOnly));
  });
});
