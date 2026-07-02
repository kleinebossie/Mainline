import { describe, expect, it } from "vitest";

import { loadMethodology } from "@/methodology/loader";
import { bandForRating, interfaceAffordancesFor } from "@/methodology/provider";

// Golden tests for the Seam-4 §4.4(c) board interface-restriction doctrine (M11): the
// affordance values come ONLY from config (L1), eval bar + legal dots are off across all
// bands, and arrows/hover are gated by the user's play medium (targetFocus).
const cfg = loadMethodology("stub-0.1.0");
const band = bandForRating(1500, cfg);

describe("interfaceAffordancesFor (Seam 4 §4.4c)", () => {
  it("turns the eval bar and legal-move dots off regardless of focus", () => {
    for (const targetFocus of ["online", "otb", "hybrid"] as const) {
      const a = interfaceAffordancesFor({ band, targetFocus }, cfg);
      expect(a.showEvalBar).toBe(false);
      expect(a.showLegalMoveDots).toBe(false);
      expect(a.restricted).toBe(true);
      expect(a.restrictionRationaleKey).toBe("anti_arrow_hover");
    }
  });

  it("gates arrows and hover by play medium", () => {
    const online = interfaceAffordancesFor(
      { band, targetFocus: "online" },
      cfg,
    );
    expect(online.allowArrows).toBe(true);
    expect(online.allowHover).toBe(true);

    const otb = interfaceAffordancesFor({ band, targetFocus: "otb" }, cfg);
    expect(otb.allowArrows).toBe(false);
    expect(otb.allowHover).toBe(false);

    const hybrid = interfaceAffordancesFor(
      { band, targetFocus: "hybrid" },
      cfg,
    );
    expect(hybrid.allowArrows).toBe(false);
    expect(hybrid.allowHover).toBe(true);
  });

  it("carries the graded evidence for the restriction", () => {
    const a = interfaceAffordancesFor({ band, targetFocus: "otb" }, cfg);
    expect(a.citationKey).toBe("board_interface_restriction");
    expect(["A", "B", "C", "D"]).toContain(a.evidenceGrade);
    expect([1, 2]).toContain(a.evidenceTier);
  });
});
