import { describe, expect, it } from "vitest";

import {
  methodologyConfigSchema,
  type MethodologyConfig,
} from "@/methodology/schema/config";
import { isGradedValue } from "@/methodology/schema/graded";
import { loadMethodology } from "@/methodology/loader";
import stub010 from "@/methodology/configs/stub-0.1.0.json";

// L3 guard (BUILD.md §13.4): every shipped config loads through the Zod schema, every
// leaf is a GradedValue, every citationKey resolves in evidenceLedger, and the result is
// immutable. The negative cases prove the guard actually rejects ungraded/dangling data.

const SHIPPED = ["stub-0.1.0"];

function walkCitationKeys(node: unknown, into: Set<string>): void {
  if (Array.isArray(node)) {
    for (const item of node) walkCitationKeys(item, into);
  } else if (node && typeof node === "object") {
    if (isGradedValue(node)) into.add(node.citationKey);
    for (const v of Object.values(node)) walkCitationKeys(v, into);
  }
}

describe("L3: methodology config integrity", () => {
  it.each(SHIPPED)("%s loads and validates", (version) => {
    const cfg = loadMethodology(version);
    expect(cfg.version).toBe(version);
  });

  it.each(SHIPPED)("%s: every citationKey resolves in the ledger", (version) => {
    const cfg = loadMethodology(version);
    const ledger = new Set(cfg.evidenceLedger.map((a) => a.key));
    const used = new Set<string>();
    walkCitationKeys(cfg.bands, used);
    walkCitationKeys(cfg.assessment, used);
    expect(used.size).toBeGreaterThan(0);
    for (const key of used) expect(ledger).toContain(key);
  });

  it.each(SHIPPED)("%s: stub/best-guess leaves are flagged (never bare)", (version) => {
    // Every calibration leaf in the stub carries a grade; spot-check that the
    // best-guess ladder params are flagged so the UI can soften them.
    const cfg = loadMethodology(version);
    expect(cfg.assessment.calibration.stepDown.flag).toBeDefined();
    expect(cfg.assessment.selfReportForSkill.value).toBe(false);
  });

  it("the loaded config is deeply frozen (immutability, §2.6)", () => {
    const cfg = loadMethodology("stub-0.1.0");
    expect(Object.isFrozen(cfg)).toBe(true);
    expect(Object.isFrozen(cfg.assessment.calibration)).toBe(true);
    expect(Object.isFrozen(cfg.assessment.calibration.stepUp)).toBe(true);
  });

  it("rejects an unknown version (fail-closed)", () => {
    expect(() => loadMethodology("stub-9.9.9")).toThrow(/Unknown methodology/);
  });

  it("rejects a bare (ungraded) leaf number", () => {
    const broken = structuredClone(stub010) as Record<string, unknown>;
    (broken.assessment as { calibration: Record<string, unknown> }).calibration.minItems = 8;
    expect(methodologyConfigSchema.safeParse(broken).success).toBe(false);
  });

  it("rejects a dangling citationKey", () => {
    const broken = structuredClone(stub010) as MethodologyConfig;
    broken.bands[0]!.minRating.citationKey = "no_such_anchor";
    expect(methodologyConfigSchema.safeParse(broken).success).toBe(false);
  });

  it("rejects a non-channel-qualified version", () => {
    const broken = structuredClone(stub010) as Record<string, unknown>;
    broken.version = "1.0.0";
    expect(methodologyConfigSchema.safeParse(broken).success).toBe(false);
  });
});
