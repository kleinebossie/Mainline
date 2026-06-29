import { describe, expect, it } from "vitest";

import { loadMethodology } from "@/methodology/loader";
import { bandForRating, modalityRecommendation } from "@/methodology/provider";

// Golden tests for the Seam-4 §4.4 2D/3D modality + OTB calibration layer (M14): the per-band
// split comes from config (L1), and whether physical-board / tournament-simulation guidance is
// surfaced is gated by the user's play medium (targetFocus). Pinned to stub-0.1.0.
const cfg = loadMethodology("stub-0.1.0");
const u800 = bandForRating(500, cfg);
const top = bandForRating(2300, cfg);

describe("modalityRecommendation (Seam 4 §4.4)", () => {
  it("returns the per-band 2D/3D split from config", () => {
    const beginner = modalityRecommendation(
      { band: u800, targetFocus: "online" },
      cfg,
    );
    expect(beginner.digitalPct).toBe(90);
    expect(beginner.physicalPct).toBe(10);

    const expert = modalityRecommendation(
      { band: top, targetFocus: "otb" },
      cfg,
    );
    expect(expert.digitalPct).toBe(40);
    expect(expert.physicalPct).toBe(60);
  });

  it("does NOT push physical-board / OTB guidance for an online-only player", () => {
    const r = modalityRecommendation(
      { band: u800, targetFocus: "online" },
      cfg,
    );
    expect(r.surfacePhysical).toBe(false);
  });

  it("pushes physical-board + OTB-simulation guidance for OTB and hybrid players", () => {
    for (const targetFocus of ["otb", "hybrid"] as const) {
      const r = modalityRecommendation(
        { band: bandForRating(1800, cfg), targetFocus },
        cfg,
      );
      expect(r.surfacePhysical).toBe(true);
      expect(r.otbCadence.length).toBeGreaterThan(0);
      expect(r.physicalBoardAdvice.length).toBeGreaterThan(0);
    }
  });

  it("carries the graded evidence + the Seam-8 rationale keys", () => {
    const r = modalityRecommendation({ band: top, targetFocus: "otb" }, cfg);
    expect(["A", "B", "C", "D"]).toContain(r.evidenceGrade);
    expect(r.modalityRationaleKey).toBe("modality_2d_vs_3d");
    expect(r.otbRationaleKey).toBe("otb_tournament_simulation");
  });
});
