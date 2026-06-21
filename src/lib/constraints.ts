// ConstraintSet input schema (BUILD.md §5.4) — the user's reality: time, cadence,
// goals, owned resources, format preferences, and the Seam-9 if-then plan. Shared by
// the constraints form (client), the tRPC router (server), and the JSON-column typing
// (db) — one validation truth (BUILD.md §3).
//
// SELF-REPORT BOUNDARY (Seam 2 / DoD): everything here is constraints/goals/resources/
// preferences — NEVER a skill self-rating. There is deliberately no "rate your tactics"
// field; skill is diagnosed behaviourally (calibration + game data), so self-report can
// never leak into skill estimation. The numeric bounds below are input-sanity limits
// (UX/infra), not chess-learning values (L1-safe: lib/ is not a decision module).

import { z } from "zod";

/** A goal is a constraint/aspiration, not a skill claim (Seam 2 boundary). */
export const goalSchema = z.object({
  kind: z.enum([
    "rating",
    "tactics",
    "openings",
    "endgames",
    "consistency",
    "fun",
    "other",
  ]),
  label: z.string().trim().min(1).max(120),
});
export type Goal = z.infer<typeof goalSchema>;

/** Seam-9 implementation intention: anchor training to an existing daily cue. */
export const ifThenPlanSchema = z.object({
  cue: z.string().trim().min(1).max(160),
  plan: z.string().trim().min(1).max(160),
});
export type IfThenPlan = z.infer<typeof ifThenPlanSchema>;

export const CHESS_FORMATS = ["bullet", "blitz", "rapid", "classical"] as const;

export const formatPrefsSchema = z.object({
  formats: z.array(z.enum(CHESS_FORMATS)).max(CHESS_FORMATS.length),
  preferredVariety: z.boolean(),
});
export type FormatPrefs = z.infer<typeof formatPrefsSchema>;

export const constraintsInputSchema = z.object({
  minutesPerDay: z.number().int().min(5).max(600),
  daysPerWeek: z.number().int().min(1).max(7),
  goals: z.array(goalSchema).max(10),
  ownedResources: z.array(z.string().min(1)).max(100),
  formatPrefs: formatPrefsSchema,
  ifThenPlan: ifThenPlanSchema.nullable(),
});
export type ConstraintsInput = z.infer<typeof constraintsInputSchema>;

/** A sensible empty default for a fresh form. */
export const EMPTY_CONSTRAINTS: ConstraintsInput = {
  minutesPerDay: 20,
  daysPerWeek: 5,
  goals: [],
  ownedResources: [],
  formatPrefs: { formats: [], preferredVariety: false },
  ifThenPlan: null,
};
