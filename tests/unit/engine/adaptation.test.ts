import { describe, expect, it } from "vitest";

import { DAY_MS, fixedClock } from "@/lib/clock";
import { loadMethodology } from "@/methodology/loader";
import {
  runAdaptation,
  type AdaptationEvent,
  type RunAdaptationInput,
} from "@/engine/adaptation";

const cfg = loadMethodology("stub-0.1.0");
const T = 1_700_000_000_000;
const clock = fixedClock(T);

const puzzleEvent = (correct: boolean): AdaptationEvent => ({
  occurredAt: T,
  itemRef: "fork",
  itemType: "puzzle_theme",
  correct,
  solveTimeMs: null,
  bandMedianMs: null,
  dimensions: ["tactics"],
});

const baseInput = (
  events: AdaptationEvent[],
  extra: Partial<RunAdaptationInput> = {},
): RunAdaptationInput => ({
  events,
  skillState: [],
  scheduleState: [],
  glickoHistory: [],
  trigger: "new_events",
  clock,
  config: cfg,
  ...extra,
});

describe("runAdaptation scheduling", () => {
  it("a miss schedules a spaced review ~1 day out with a graded decision", () => {
    const res = runAdaptation(baseInput([puzzleEvent(false)]));

    expect(res.scheduleUpdates).toHaveLength(1);
    const s = res.scheduleUpdates[0]!;
    expect(s.itemRef).toBe("fork");
    expect(s.itemType).toBe("puzzle_theme");
    expect(s.lastGrade).toBe(1);
    expect(s.fsrs.lapses).toBe(1);
    expect(s.fsrs.due).toBe(T + DAY_MS);

    const decision = res.adaptationLog.decisions.find(
      (d) => d.kind === "schedule",
    )!;
    expect(decision.rationaleKey).toBe("redo_failed");
    expect(decision.soften).toBe(true);
    expect(decision.detail).toMatchObject({ itemRef: "fork", grade: 1 });
  });

  it("a success does NOT create a schedule for an item with no prior review", () => {
    const res = runAdaptation(baseInput([puzzleEvent(true)]));
    expect(res.scheduleUpdates).toEqual([]);
  });

  it("re-steps an item already in the queue (a correct redo progresses it)", () => {
    const prior = runAdaptation(baseInput([puzzleEvent(false)]))
      .scheduleUpdates[0]!;
    const res = runAdaptation(
      baseInput([{ ...puzzleEvent(true), occurredAt: prior.fsrs.due }], {
        scheduleState: [prior],
      }),
    );
    expect(res.scheduleUpdates).toHaveLength(1);
    const s = res.scheduleUpdates[0]!;
    expect(s.lastGrade).toBe(3);
    expect(s.fsrs.lapses).toBe(1);
    expect(s.fsrs.reps).toBe(2);
  });
});

describe("runAdaptation skill updates", () => {
  it("folds the outcome into a per-dimension running proportion", () => {
    const res = runAdaptation(baseInput([puzzleEvent(false)]));
    expect(res.skillStateUpdates).toEqual([
      { dimension: "tactics", estimate: 0, uncertainty: 0, sampleSize: 1 },
    ]);
    const hit = runAdaptation(baseInput([puzzleEvent(true)]));
    expect(hit.skillStateUpdates[0]!.estimate).toBe(1);
  });

  it("folds new outcomes onto the prior SkillState", () => {
    const res = runAdaptation(
      baseInput([puzzleEvent(false)], {
        skillState: [
          { dimension: "tactics", estimate: 1, uncertainty: 0, sampleSize: 1 },
        ],
      }),
    );
    // prior 1×1 + 0 of 1 new = 1/2.
    expect(res.skillStateUpdates[0]!).toMatchObject({
      estimate: 0.5,
      sampleSize: 2,
    });
  });
});

describe("runAdaptation plateau detection and determinism", () => {
  it("logs a plateau decision only when the history can support a verdict", () => {
    const empty = runAdaptation(baseInput([puzzleEvent(false)]));
    expect(
      empty.adaptationLog.decisions.some((d) => d.kind === "plateau"),
    ).toBe(false);

    const history = [
      { at: 0, rating: 1500, rd: 40 },
      { at: 200 * DAY_MS, rating: 1500, rd: 40 },
      { at: 250 * DAY_MS, rating: 1490, rd: 40 },
    ];
    const withHistory = runAdaptation(
      baseInput([], { glickoHistory: history, trigger: "daily_cron" }),
    );
    const plateau = withHistory.adaptationLog.decisions.find(
      (d) => d.kind === "plateau",
    )!;
    expect(plateau.detail.isPlateau).toBe(true);
    expect(plateau.evidenceGrade).toBe("B");
  });

  it("stamps runAt from the injected clock and is fully deterministic", () => {
    const input = baseInput([puzzleEvent(false)]);
    const a = runAdaptation(input);
    const b = runAdaptation(input);
    expect(a).toEqual(b);
    expect(a.adaptationLog.runAt).toBe(T);
  });
});
