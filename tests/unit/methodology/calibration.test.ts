import { describe, expect, it } from "vitest";

import { loadMethodology } from "@/methodology/loader";
import {
  buildImplementationIntention,
  nextCalibrationItem,
  scoreCalibration,
  type CalibrationResponse,
} from "@/methodology/provider";

// Golden tests for the Seam 2 pure functions (BUILD.md §13.1): fixed inputs + a pinned
// config version → exact output, including the evidence grade (L3). Deterministic (L2).
const cfg = loadMethodology("stub-0.1.0");

// Pinned stub parameters the goldens below are computed against (config is the source
// of truth — these mirror configs/stub-0.1.0.json so a value change fails loudly).
//   targetSuccessRate 0.8 · abilitySpread 400 · uncertaintyBase 350 · floor 600 · ceil 2600
//   startRating 1200 · stepUp 50 · stepDown 200 · minItems 8 · maxItems 12 · stopUncertainty 120
const r = (ratingShown: number, correct: boolean): CalibrationResponse => ({
  ratingShown,
  correct,
});
const repeat = (n: number, c: CalibrationResponse): CalibrationResponse[] =>
  Array.from({ length: n }, () => c);

describe("scoreCalibration (golden)", () => {
  it("estimate = meanShown + (success − target)·spread; uncertainty = base/√n", () => {
    // 10 items, mean shown 1175, 8 correct → successRate 0.8 → offset 0 → 1175.
    const responses = [
      r(1200, true),
      r(1250, true),
      r(1300, false),
      r(1100, true),
      r(1150, true),
      r(1200, true),
      r(1250, false),
      r(1050, true),
      r(1100, true),
      r(1150, true),
    ];
    expect(scoreCalibration({ responses }, cfg)).toEqual({
      tacticalRatingEstimate: 1175,
      uncertainty: 111, // round(350/√10)
      evidenceGrade: "C",
      evidenceTier: 1,
      citationKey: "stub_open_question",
      flag: "best-guess",
      rationaleKey: "calibration_estimate",
    });
  });

  it("higher success raises the estimate above mean-shown", () => {
    const out = scoreCalibration({ responses: repeat(10, r(1500, true)) }, cfg);
    // 1500 + (1.0 − 0.8)·400 = 1580
    expect(out.tacticalRatingEstimate).toBe(1580);
    expect(out.uncertainty).toBe(111);
  });

  it("lower success lowers the estimate below mean-shown", () => {
    const out = scoreCalibration({ responses: repeat(10, r(1500, false)) }, cfg);
    // 1500 + (0 − 0.8)·400 = 1180
    expect(out.tacticalRatingEstimate).toBe(1180);
  });

  it("clamps the estimate to the calibration ceiling", () => {
    const out = scoreCalibration({ responses: repeat(10, r(2600, true)) }, cfg);
    expect(out.tacticalRatingEstimate).toBe(2600); // 2680 clamped to ceil
  });

  it("carries a best-guess grade so the UI never renders it as fact (L3)", () => {
    const out = scoreCalibration({ responses: repeat(8, r(1200, true)) }, cfg);
    expect(out.evidenceGrade).toBe("C");
    expect(out.flag).toBe("best-guess");
  });
});

describe("nextCalibrationItem (golden ladder)", () => {
  it("starts at the resolved startRating with no history", () => {
    expect(
      nextCalibrationItem({ responses: [], startRating: 1200 }, cfg),
    ).toEqual({ ratingTarget: 1200, itemNumber: 1, done: false });
  });

  it("steps up after a solve, down after a miss", () => {
    expect(
      nextCalibrationItem(
        { responses: [r(1200, true)], startRating: 1200 },
        cfg,
      ).ratingTarget,
    ).toBe(1250); // +stepUp
    expect(
      nextCalibrationItem(
        { responses: [r(1200, false)], startRating: 1200 },
        cfg,
      ).ratingTarget,
    ).toBe(1000); // −stepDown
  });

  it("clamps the next target to the calibration floor", () => {
    expect(
      nextCalibrationItem(
        { responses: [r(650, false)], startRating: 1200 },
        cfg,
      ).ratingTarget,
    ).toBe(600); // 450 clamped to floor
  });

  it("is not done at 8 items (SE still above stop threshold)", () => {
    const out = nextCalibrationItem(
      { responses: repeat(8, r(1200, true)), startRating: 1200 },
      cfg,
    );
    // round(350/√8)=124 > 120 → keep going; serve item 9 at 1200+stepUp.
    expect(out).toEqual({ ratingTarget: 1250, itemNumber: 9, done: false });
  });

  it("stops at 9 items once SE drops below the threshold", () => {
    const out = nextCalibrationItem(
      { responses: repeat(9, r(1200, true)), startRating: 1200 },
      cfg,
    );
    // round(350/√9)=117 ≤ 120 → done; ratingTarget = the estimate (1200 + 80).
    expect(out).toEqual({ ratingTarget: 1280, itemNumber: 9, done: true });
  });

  it("stops at maxItems even if still uncertain", () => {
    const mixed = [
      ...repeat(6, r(1200, true)),
      ...repeat(6, r(1200, false)),
    ];
    const out = nextCalibrationItem(
      { responses: mixed, startRating: 1200 },
      cfg,
    );
    expect(out.done).toBe(true);
    expect(out.itemNumber).toBe(12);
  });
});

describe("buildImplementationIntention", () => {
  it("assembles and trims the if-then plan (Seam 9 data assembly)", () => {
    expect(
      buildImplementationIntention("  my morning coffee ", " open today's session "),
    ).toEqual({ cue: "my morning coffee", plan: "open today's session" });
  });
});
