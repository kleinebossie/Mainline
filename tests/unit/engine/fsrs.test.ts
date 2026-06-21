import { describe, expect, it } from "vitest";

import { DAY_MS } from "@/lib/clock";
import { fsrsStep, type FsrsParams } from "@/engine/math/fsrs";
import { loadMethodology } from "@/methodology/loader";

// Golden tests for the generic FSRS step (BUILD.md §13.1, M7). Pinned against the SHIPPED
// Seam-6 weights, so this exercises both the engine math and the stub config together.
// Deterministic (L2): a pure function of (prev, grade, reviewedAt, params).
const cfg = loadMethodology("stub-0.1.0");
const params: FsrsParams = {
  weights: cfg.scheduling.fsrsWeights.value,
  desiredRetention: cfg.scheduling.desiredRetention.value,
  maximumIntervalDays: cfg.scheduling.maximumIntervalDays.value,
};

const T = 1_700_000_000_000;
const dueOffsetDays = (due: number, from: number): number =>
  Math.round((due - from) / DAY_MS);

describe("fsrsStep — first review", () => {
  it("schedules by initial stability (w[grade-1]); harder grade → longer interval", () => {
    const again = fsrsStep(null, 1, T, params);
    const hard = fsrsStep(null, 2, T, params);
    const good = fsrsStep(null, 3, T, params);
    const easy = fsrsStep(null, 4, T, params);

    // Initial stability is the per-grade weight; intervals at retention 0.90 ≈ stability.
    expect(dueOffsetDays(again.due, T)).toBe(1); // S0≈0.22 → clamped to 1 day
    expect(dueOffsetDays(hard.due, T)).toBe(1); // S0≈1.18 → 1 day
    expect(dueOffsetDays(good.due, T)).toBe(3); // S0≈3.26 → 3 days
    expect(dueOffsetDays(easy.due, T)).toBe(16); // S0≈16.15 → 16 days

    expect(easy.due).toBeGreaterThan(good.due);
    expect(good.due).toBeGreaterThan(hard.due);
  });

  it("sets reps/lapses and a sane stability/difficulty for Good", () => {
    const good = fsrsStep(null, 3, T, params);
    expect(good.reps).toBe(1);
    expect(good.lapses).toBe(0);
    expect(good.stability).toBeCloseTo(3.2602, 3); // w[2]
    expect(good.difficulty).toBeCloseTo(4.8846, 3); // w4 − exp(2·w5) + 1
    expect(good.lastReview).toBe(T);
  });

  it("counts a first-review Again as a lapse", () => {
    const again = fsrsStep(null, 1, T, params);
    expect(again.lapses).toBe(1);
    expect(again.reps).toBe(1);
  });

  it("respects the maximum-interval cap", () => {
    const capped = fsrsStep(null, 4, T, { ...params, maximumIntervalDays: 5 });
    expect(dueOffsetDays(capped.due, T)).toBe(5); // 16-day interval capped to 5
  });
});

describe("fsrsStep — subsequent reviews", () => {
  it("grows stability (and the interval) on a successful recall", () => {
    const first = fsrsStep(null, 3, T, params); // Good → ~3 day interval
    const second = fsrsStep(first, 3, first.due, params); // recall at due, Good again
    expect(second.reps).toBe(2);
    expect(second.lapses).toBe(0);
    expect(second.stability).toBeGreaterThan(first.stability);
    expect(dueOffsetDays(second.due, first.due)).toBeGreaterThan(
      dueOffsetDays(first.due, T),
    );
  });

  it("a lapse cuts stability and increments lapses (the redo trigger)", () => {
    const grown = fsrsStep(
      fsrsStep(null, 3, T, params),
      3,
      T + 3 * DAY_MS,
      params,
    );
    const lapsed = fsrsStep(grown, 1, grown.due, params);
    expect(lapsed.lapses).toBe(grown.lapses + 1);
    expect(lapsed.stability).toBeLessThan(grown.stability);
    expect(dueOffsetDays(lapsed.due, grown.due)).toBeGreaterThanOrEqual(1);
  });

  it("is deterministic (same inputs → identical state)", () => {
    const a = fsrsStep(null, 3, T, params);
    const b = fsrsStep(null, 3, T, params);
    expect(a).toEqual(b);
  });
});
