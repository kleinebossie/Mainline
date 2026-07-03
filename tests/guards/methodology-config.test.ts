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

  it.each(SHIPPED)(
    "%s: every citationKey resolves in the ledger",
    (version) => {
      const cfg = loadMethodology(version);
      const ledger = new Set(cfg.evidenceLedger.map((a) => a.key));
      const used = new Set<string>();
      // Walk every seam (M6 added interpretation/activities/difficulty/prioritization/
      // rationale) so a dangling citation anywhere fails.
      walkCitationKeys(cfg.bands, used);
      walkCitationKeys(cfg.assessment, used);
      walkCitationKeys(cfg.interpretation, used);
      walkCitationKeys(cfg.activities, used);
      walkCitationKeys(cfg.difficulty, used);
      walkCitationKeys(cfg.scheduling, used);
      walkCitationKeys(cfg.prioritization, used);
      walkCitationKeys(cfg.engagement, used);
      walkCitationKeys(cfg.measurement, used);
      walkCitationKeys(cfg.rationale, used);
      walkCitationKeys(cfg.gameAnalysis, used);
      // M14 — the deliberately-external layer (book study + 2D/3D modality).
      walkCitationKeys(cfg.bookStudy, used);
      walkCitationKeys(cfg.modality, used);
      expect(used.size).toBeGreaterThan(0);
      for (const key of used) expect(ledger).toContain(key);
    },
  );

  it.each(SHIPPED)(
    "%s: every C/D-grade rationale entry is softened (Seam-8 honesty rule)",
    (version) => {
      const cfg = loadMethodology(version);
      expect(cfg.rationale.length).toBeGreaterThan(0);
      for (const r of cfg.rationale) {
        if (r.grade === "C" || r.grade === "D") expect(r.soften).toBe(true);
      }
    },
  );

  it.each(SHIPPED)(
    "%s: every dimension/activity/rationale reference resolves",
    (version) => {
      const cfg = loadMethodology(version);
      const dimIds = new Set(cfg.dimensions.map((d) => d.id));
      const ratKeys = new Set(cfg.rationale.map((r) => r.key));
      for (const a of cfg.activities) {
        for (const d of a.dimensions) expect(dimIds).toContain(d);
        expect(ratKeys).toContain(a.rationaleKey);
      }
      expect(dimIds).toContain(cfg.interpretation.blunderRate.dimension);
      expect(ratKeys).toContain(cfg.interpretation.blunderRate.rationaleKey);
    },
  );

  it.each(SHIPPED)(
    "%s: stub/best-guess leaves are flagged (never bare)",
    (version) => {
      // Every calibration leaf in the stub carries a grade; spot-check that the
      // best-guess ladder params are flagged so the UI can soften them.
      const cfg = loadMethodology(version);
      expect(cfg.assessment.calibration.stepDown.flag).toBeDefined();
      expect(cfg.assessment.selfReportForSkill.value).toBe(false);
    },
  );

  it.each(SHIPPED)(
    "%s: the M7 scheduling + measurement seams load with graded leaves",
    (version) => {
      const cfg = loadMethodology(version);
      // FSRS-6 weight vector is one graded leaf of 21 numbers.
      expect(cfg.scheduling.fsrsWeights.value).toHaveLength(21);
      expect(cfg.scheduling.desiredRetention.grade).toBeDefined();
      expect(cfg.scheduling.maximumIntervalDays.value).toBeGreaterThan(0);
      // Measurement CI/baseline/plateau params present and graded.
      expect(cfg.measurement.ciMultiplier.value).toBeGreaterThan(0);
      expect(cfg.measurement.plateauWindowDays.value).toBeGreaterThan(0);
    },
  );

  it.each(SHIPPED)(
    "%s: the M9 engagement seam loads graded, forbid-list enforced, copyKeys resolve",
    (version) => {
      const cfg = loadMethodology(version);
      const e = cfg.engagement;
      // Mechanism numbers are graded leaves.
      expect(e.streakCapDays.value).toBeGreaterThan(0);
      expect(e.competenceMilestones.value.length).toBeGreaterThan(0);
      expect(e.reminderCadenceCapPerDay.grade).toBeDefined();
      // Forbid list enforced BY CONFIG, not the engine: leaderboards off, streak capped.
      expect(e.globalLeaderboards.value).toBe(false);
      // Every event rule maps to an allowed type + a copyKey that resolves in rationale.
      const ratKeys = new Set(cfg.rationale.map((r) => r.key));
      expect(e.events.length).toBeGreaterThan(0);
      for (const ev of e.events) expect(ratKeys).toContain(ev.copyKey);
    },
  );

  it.each(SHIPPED)(
    "%s: the M14 book-study + modality seams load graded, band-covered, rationale-resolved",
    (version) => {
      const cfg = loadMethodology(version);
      const bandIds = cfg.bands.map((b) => b.id);
      const ratKeys = new Set(cfg.rationale.map((r) => r.key));

      // Book-study protocol leaves are graded; the per-band catalog + block list cover every band.
      expect(cfg.bookStudy.difficultyCalibration.targetSuccessRate.value).toBe(
        0.85,
      );
      expect(cfg.bookStudy.woodpecker.firstCycleDays.grade).toBeDefined();
      expect(cfg.bookStudy.ownedBookDailyPriority.grade).toBe("C");
      expect(cfg.bookStudy.categoryDimensions["endgame"]).toContain("endgames");
      const calculationSub = cfg.bookStudy.activitySubstitutions.find(
        (s) => s.activityId === "calculation_drill",
      );
      expect(calculationSub?.preferredBookIdsByBand.b800_1200?.value).toContain(
        "polgar_5334",
      );
      for (const id of bandIds) {
        expect(cfg.bookStudy.catalogByBand[id]).toBeDefined();
        expect(cfg.bookStudy.blockedCategoriesByBand[id]).toBeDefined();
        expect(cfg.modality.splitByBand[id]).toBeDefined();
        expect(cfg.modality.otbSimulationByBand[id]).toBeDefined();
      }
      // Low-band overload books are blocked (the cognitive-load rule).
      expect(
        cfg.bookStudy.blockedCategoriesByBand[bandIds[0]!]!.value,
      ).toContain("strategy");

      // Every new Seam-8 rationale key resolves (book study + modality + OTB).
      for (const key of [
        cfg.bookStudy.activeRecallRationaleKey,
        cfg.bookStudy.calibrationRationaleKey,
        cfg.bookStudy.woodpeckerRationaleKey,
        cfg.modality.modalityRationaleKey,
        cfg.modality.otbRationaleKey,
      ]) {
        expect(ratKeys).toContain(key);
      }
      // The `book` activity is a deliberately-external Seam-4 activity.
      const book = cfg.activities.find((a) => a.activityType === "book");
      expect(book?.delivery.value).toBe("external");
    },
  );

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
    (
      broken.assessment as { calibration: Record<string, unknown> }
    ).calibration.minItems = 8;
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

  it("rejects a C/D-grade rationale entry that is not softened", () => {
    const broken = structuredClone(stub010) as MethodologyConfig;
    const cd = broken.rationale.find(
      (r) => r.grade === "C" || r.grade === "D",
    )!;
    cd.soften = false;
    expect(methodologyConfigSchema.safeParse(broken).success).toBe(false);
  });

  it("rejects a dangling dimension reference", () => {
    const broken = structuredClone(stub010) as MethodologyConfig;
    broken.interpretation.blunderRate.dimension = "no_such_dimension";
    expect(methodologyConfigSchema.safeParse(broken).success).toBe(false);
  });

  it("rejects a per-band record that is missing a band", () => {
    const broken = structuredClone(stub010) as Record<string, unknown>;
    const interp = broken.interpretation as {
      blunderRate: { baselineByBand: Record<string, unknown> };
    };
    delete interp.blunderRate.baselineByBand.u800;
    expect(methodologyConfigSchema.safeParse(broken).success).toBe(false);
  });

  it("rejects globalLeaderboards = true (forbidden dark pattern, Seam 9)", () => {
    const broken = structuredClone(stub010) as MethodologyConfig;
    broken.engagement.globalLeaderboards.value = true;
    expect(methodologyConfigSchema.safeParse(broken).success).toBe(false);
  });

  it("rejects a dangling engagement event copyKey", () => {
    const broken = structuredClone(stub010) as MethodologyConfig;
    broken.engagement.events[0]!.copyKey = "no_such_copy";
    expect(methodologyConfigSchema.safeParse(broken).success).toBe(false);
  });

  it("rejects a forbidden reward-event type (taxonomy is enum-bounded)", () => {
    const broken = structuredClone(stub010) as Record<string, unknown>;
    const eng = broken.engagement as { events: { type: string }[] };
    eng.events[0]!.type = "global_leaderboard";
    expect(methodologyConfigSchema.safeParse(broken).success).toBe(false);
  });
});
