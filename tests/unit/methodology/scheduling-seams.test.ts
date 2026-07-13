import { describe, expect, it } from "vitest";

import { DAY_MS } from "@/lib/clock";
import { loadMethodology } from "@/methodology/loader";
import {
  detectPlateau,
  gradeFromOutcome,
  isProgressReal,
  isStableBaseline,
  newItemScheduleGrade,
  redoFlowPolicy,
  scheduleReview,
  expectationForBand,
  type RatingPoint,
  type Band,
} from "@/methodology/provider";

// Golden tests for the M7 methodology seams (BUILD.md §13.1): Seam 6 (scheduling) +
// Measurement, pinned to the stub config. Deterministic (L2): pure (inputs, config).
const cfg = loadMethodology("stub-0.1.0");
const T = 1_700_000_000_000;
const day = (n: number): number => n * DAY_MS;

it("reads the graded seed for an unseen scheduled item", () => {
  expect(newItemScheduleGrade(cfg)).toBe(3);
  expect(cfg.scheduling.newItemSeedGrade).toMatchObject({
    grade: "C",
    tier: 1,
    citationKey: "stub_open_question",
    flag: "best-guess",
  });
});

describe("gradeFromOutcome (Seam 6 outcome → FSRS grade)", () => {
  it("wrong → Again(1); correct (no timing) → Good(3)", () => {
    expect(gradeFromOutcome({ correct: false }, cfg)).toBe(1);
    expect(gradeFromOutcome({ correct: true }, cfg)).toBe(3);
  });

  it("correct & fast → Easy(4); slow → Hard(2); normal → Good(3) (band-median relative)", () => {
    const median = 10_000;
    expect(
      gradeFromOutcome(
        { correct: true, solveTimeMs: 3_000, bandMedianMs: median },
        cfg,
      ),
    ).toBe(4); // < median × 0.5
    expect(
      gradeFromOutcome(
        { correct: true, solveTimeMs: 20_000, bandMedianMs: median },
        cfg,
      ),
    ).toBe(2); // > median × 1.5
    expect(
      gradeFromOutcome(
        { correct: true, solveTimeMs: 10_000, bandMedianMs: median },
        cfg,
      ),
    ).toBe(3);
  });
});

describe("scheduleReview (Seam 6 — FSRS step from config params)", () => {
  it("a first-review miss is due in ~1 day and counts a lapse", () => {
    const { nextDue, newState } = scheduleReview(
      { grade: 1, fsrsState: null, now: T },
      cfg,
    );
    expect(nextDue).toBe(newState.due);
    expect(Math.round((nextDue - T) / DAY_MS)).toBe(1);
    expect(newState.lapses).toBe(1);
  });

  it("a first-review Good schedules further out than a miss", () => {
    const miss = scheduleReview({ grade: 1, fsrsState: null, now: T }, cfg);
    const good = scheduleReview({ grade: 3, fsrsState: null, now: T }, cfg);
    expect(good.nextDue).toBeGreaterThan(miss.nextDue);
  });
});

describe("redoFlowPolicy (Seam 6 scaffold)", () => {
  it("returns the versioned delay, hint behavior, and evidence", () => {
    expect(redoFlowPolicy(cfg)).toEqual({
      retestDelaySec: 600,
      hint: {
        mode: "solution-start-square",
        includeMotifNames: true,
        copy: "We highlighted the starting square of the correct piece.",
        evidenceGrade: "C",
        evidenceTier: 2,
        citationKey: "roediger2006",
        flag: "best-guess",
      },
    });
  });
});

describe("isStableBaseline (Measurement — RD gate)", () => {
  it("is true only when RD ≤ the config max", () => {
    expect(isStableBaseline(100, cfg)).toBe(true); // ≤ 110
    expect(isStableBaseline(200, cfg)).toBe(false);
  });
});

describe("isProgressReal (Measurement — non-overlapping CIs)", () => {
  it("true only when the latest CI lower clears the baseline CI upper", () => {
    const real: RatingPoint[] = [
      { at: 0, rating: 1500, rd: 40 },
      { at: day(60), rating: 1700, rd: 40 },
    ];
    const noise: RatingPoint[] = [
      { at: 0, rating: 1500, rd: 40 },
      { at: day(60), rating: 1540, rd: 40 },
    ];
    expect(isProgressReal({ history: real }, cfg)).toBe(true);
    expect(isProgressReal({ history: noise }, cfg)).toBe(false);
    expect(isProgressReal({ history: [real[0]!] }, cfg)).toBe(false); // <2 stable
  });
});

describe("detectPlateau (Seam 7 — CI high over the window)", () => {
  it("reports insufficient when there is no usable history", () => {
    expect(detectPlateau({ history: [] }, cfg)).toEqual({
      isPlateau: false,
      suggestedStimulusChange: false,
      reason: "insufficient",
    });
  });

  it("flags a plateau when the CI upper sets no new high in the window", () => {
    const history: RatingPoint[] = [
      { at: 0, rating: 1500, rd: 40 },
      { at: day(200), rating: 1500, rd: 40 },
      { at: day(250), rating: 1490, rd: 40 },
    ];
    expect(detectPlateau({ history }, cfg)).toEqual({
      isPlateau: true,
      suggestedStimulusChange: true,
      reason: "plateau",
    });
  });

  it("is not a plateau when a new CI high is set within the window", () => {
    const history: RatingPoint[] = [
      { at: 0, rating: 1500, rd: 40 },
      { at: day(200), rating: 1600, rd: 40 },
    ];
    expect(detectPlateau({ history }, cfg).reason).toBe("new_high");
  });
});

describe("expectationForBand (Measurement — per-band expectations)", () => {
  it("returns the exact copy and grade for a known band", () => {
    const expectation = expectationForBand("b800_1200", cfg);
    expect(expectation.evidenceGrade).toBe("A");
    expect(expectation.text).toContain("hundred-point mark");
    expect(expectation.citationKey).toBe("lichess_etl");
  });

  it("falls back to the top band if the band is missing", () => {
    // "unknown_band" is not in our stub config, so it should fall back to b2200plus
    const expectation = expectationForBand(
      "unknown_band" as unknown as Band,
      cfg,
    );
    const topBandExpectation = expectationForBand("b2200plus", cfg);
    expect(expectation.text).toBe(topBandExpectation.text);
  });
});
