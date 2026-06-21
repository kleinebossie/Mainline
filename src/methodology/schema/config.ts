// The MethodologyConfig structural contract (BUILD.md §2.5; METHODOLOGY §3). This is
// the ONE object through which science enters the system (VISION §4). Every leaf is a
// GradedValue (L3), and every citationKey must resolve in `evidenceLedger` — both are
// enforced here so an ungraded or dangling value is a boot error (loader, §2.6),
// never a silent fallback.
//
// INCREMENTAL BY DESIGN. The full top-level shape in BUILD.md §2.5 lists 13 sub-objects,
// one per seam. Each seam's Zod sub-schema lands with the milestone that first consumes
// it (BUILD.md §2.5: "encoded as Zod schemas under src/methodology/schema/" as seams
// land). M4 ships the container + the seams M4 actually uses:
//   • bands           (§0.4 — rating bands as DATA; used to seed calibration)
//   • assessment      (Seam 2 — onboarding behavioural calibration; the M4 contract)
//   • evidenceLedger  (§5 — the citation map the UI shows; required for L3 resolution)
// Forthcoming (added by their slices, never invented early — that would inject ungraded
// science): dimensions (1), interpretation (3), activities/weaknessResourceRules (4),
// difficulty (5), scheduling (6), prioritization (7), rationale (8), engagement (9),
// measurement. Parsing is non-strict, so a future config may carry them before their
// schema lands without breaking M4.

import { z } from "zod";

import { gradedValue, isGradedValue } from "@/methodology/schema/graded";

// Channel-qualified version id (also the config filename stem and the value persisted
// as `methodologyVersion` for reproducibility, §2.6). e.g. "stub-0.1.0".
const versionSchema = z
  .string()
  .regex(
    /^(stub|research)-\d+\.\d+\.\d+$/,
    "version must be <channel>-<semver>, e.g. stub-0.1.0",
  );

// §0.4 — a band is a convenience prior; the user's own data always overrides it. `id`
// and `label` are structural (an identifier / a display string), not evidence claims;
// the rating cutoffs ARE methodology leaves, so they are graded. null = open-ended edge.
const bandSchema = z.object({
  id: z.string().min(1),
  label: z.string().min(1),
  minRating: gradedValue(z.number().nullable()),
  maxRating: gradedValue(z.number().nullable()),
});

// Seam 2 — assessment calibration. Every number a graded leaf; the two pure functions
// (provider.ts) read these and nothing else, so re-tuning calibration is a config edit.
const calibrationSchema = z.object({
  minItems: gradedValue(z.number().int().positive()),
  maxItems: gradedValue(z.number().int().positive()),
  timeBudgetMin: gradedValue(z.number().positive()),
  // Default ladder start when the user has no platform rating (else the caller passes
  // the platform puzzle/rapid rating — Seam 2 startRating rule).
  startRating: gradedValue(z.number()),
  // The success rate the adaptive ladder servos toward (~75–85%, Seam 5 / wilson2019).
  targetSuccessRate: gradedValue(z.number().min(0).max(1)),
  // Transformed-staircase steps: harder by `stepUp` after a solve, easier by `stepDown`
  // after a miss. The ratio sets the convergence success rate (stepDown/(up+down)).
  stepUp: gradedValue(z.number().positive()),
  stepDown: gradedValue(z.number().positive()),
  // Calibration rating span (clamps the ladder). Best-guess methodology range.
  ratingFloor: gradedValue(z.number()),
  ratingCeil: gradedValue(z.number()),
  // Estimator knobs: success-vs-target → rating offset, and base SE shrunk by √n.
  abilitySpread: gradedValue(z.number().positive()),
  uncertaintyBase: gradedValue(z.number().positive()),
  // Stop early once the estimate's uncertainty drops below this (and minItems met).
  stopUncertainty: gradedValue(z.number().positive()),
});

const assessmentSchema = z.object({
  // Dunning-Kruger: self-report is INVALID for skill diagnosis, VALID for
  // constraints/goals (heck2025, G8). These two flags encode exactly that split.
  selfReportForSkill: gradedValue(z.boolean()),
  selfReportForConstraints: gradedValue(z.boolean()),
  instantEvalGames: gradedValue(z.number().int().positive()),
  calibration: calibrationSchema,
});

// §5 — the evidence ledger the UI cites. Mirrors the METHODOLOGY §5 columns.
const anchorSourceSchema = z.object({
  key: z.string().min(1),
  source: z.string().min(1),
  anchors: z.string().min(1), // what this source anchors
  grade: z.enum(["A", "B", "C", "D"]),
});

/** Recursively collect every citationKey appearing on a GradedValue in the config. */
function collectCitationKeys(node: unknown, into: Set<string>): void {
  if (Array.isArray(node)) {
    for (const item of node) collectCitationKeys(item, into);
    return;
  }
  if (node && typeof node === "object") {
    if (isGradedValue(node)) into.add(node.citationKey);
    for (const v of Object.values(node)) collectCitationKeys(v, into);
  }
}

export const methodologyConfigSchema = z
  .object({
    version: versionSchema,
    bands: z.array(bandSchema).min(1),
    assessment: assessmentSchema,
    evidenceLedger: z.array(anchorSourceSchema).min(1),
  })
  .superRefine((cfg, ctx) => {
    // L3 — every citationKey must resolve to a ledger anchor (fail-closed, §2.6).
    const ledger = new Set(cfg.evidenceLedger.map((a) => a.key));
    const used = new Set<string>();
    collectCitationKeys(cfg.bands, used);
    collectCitationKeys(cfg.assessment, used);
    for (const key of used) {
      if (!ledger.has(key)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: `citationKey "${key}" does not resolve in evidenceLedger`,
          path: ["evidenceLedger"],
        });
      }
    }
  });

export type MethodologyConfig = z.infer<typeof methodologyConfigSchema>;
export type AssessmentConfig = MethodologyConfig["assessment"];
export type CalibrationConfig = AssessmentConfig["calibration"];
export type BandDefinition = MethodologyConfig["bands"][number];
export type AnchorSource = MethodologyConfig["evidenceLedger"][number];
