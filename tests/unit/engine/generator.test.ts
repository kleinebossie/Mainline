import { describe, expect, it } from "vitest";

import { fixedClock } from "@/lib/clock";
import { loadMethodology } from "@/methodology/loader";
import { generateProgram } from "@/engine/generator";
import type { WeaknessSignal } from "@/methodology/provider";

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

    // The fixed activity and divisible activities fill, but never exceed, the budget.
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

  it("replaces endgame study with an owned endgame book", () => {
    const { items } = generateProgram({
      band: "b1200_1600",
      tacticalRating: 1300,
      weaknessSignals: [],
      dueItems: [],
      constraints: {
        minutesPerDay: 30,
        ownedRefs: ["delavilla_100_endgames"],
      },
      clock,
      config: cfg,
    });

    expect(items[0]!.activityId).toBe("endgame_study");
    expect(items[0]!.activityType).toBe("book");
    expect(items[0]!.label).toBe("Study 100 Endgames You Must Know");
    expect(items[0]!.dimensionsTargeted).toEqual(["endgames"]);
    expect(items[0]!.params.bookResource).toEqual({
      id: "delavilla_100_endgames",
      title: "100 Endgames You Must Know",
      category: "endgame",
      studyUnit: "exercises",
    });
    expect(items[0]!.params.studyMinutes).toBe(15);
  });

  it("replaces calculation/visualisation drill with Polgar 5334 when owned", () => {
    const { items } = generateProgram({
      band: "b800_1200",
      tacticalRating: 1000,
      weaknessSignals: [],
      dueItems: [],
      constraints: {
        minutesPerDay: 30,
        ownedRefs: ["polgar_5334"],
      },
      clock,
      config: cfg,
    });

    const calculation = items.find((i) => i.activityId === "calculation_drill");
    expect(calculation).toBeDefined();
    expect(calculation?.activityType).toBe("book");
    expect(calculation?.label).toBe(
      "Study Chess: 5334 Problems, Combinations and Games",
    );
    expect(calculation?.params.bookResource).toEqual({
      id: "polgar_5334",
      title: "Chess: 5334 Problems, Combinations and Games",
      category: "tactics",
      studyUnit: "exercises",
    });
    expect(calculation?.params.studyMinutes).toBe(15);
    expect(items.map((i) => i.activityId)).not.toContain("book_study");
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

  it("never exceeds the time budget and fits fewer puzzles when shorter", () => {
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

  it("keeps visible allocations whole-minute and within a high budget", () => {
    const { items } = generateProgram({
      band: "b1600_2000",
      tacticalRating: 1800,
      weaknessSignals: [],
      dueItems: [{ itemRef: "pi-endgame-1", itemType: "endgame" }],
      constraints: { minutesPerDay: 360 },
      clock,
      config: cfg,
    });

    expect(items.every((i) => Number.isInteger(i.estMinutes))).toBe(true);
    expect(items.reduce((sum, i) => sum + i.estMinutes, 0)).toBeLessThanOrEqual(
      360,
    );
    const endgame = items.find((i) => i.activityType === "endgame_drill");
    expect(endgame).toBeDefined();
    expect(endgame?.estMinutes).toBe(15);
    expect(endgame?.params.count).toBe(1);
  });

  it("omits an under-viable endgame drill on a tight budget instead of shrinking it", () => {
    const { items } = generateProgram({
      band: "b1600_2000",
      tacticalRating: 1800,
      weaknessSignals: [],
      dueItems: [{ itemRef: "pi-endgame-1", itemType: "endgame" }],
      constraints: { minutesPerDay: 10 },
      clock,
      config: cfg,
    });

    expect(
      items.find((i) => i.activityType === "endgame_drill"),
    ).toBeUndefined();
    expect(items.every((i) => Number.isInteger(i.estMinutes))).toBe(true);
    expect(items.reduce((sum, i) => sum + i.estMinutes, 0)).toBeLessThanOrEqual(
      10,
    );
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

  it("surfaces due reviews as a spaced-review item carrying the due refs", () => {
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
  });

  it("nudges the puzzle target harder after higher recent success", () => {
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
