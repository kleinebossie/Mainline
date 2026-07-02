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

/** A resource the user already owns — so the generator can prefer what they can access
 *  (Seam 7 input) rather than recommend a book/course they'd have to buy. Self-report of
 *  RESOURCES, never of skill (Seam 2 boundary). */
export const OWNED_RESOURCE_KINDS = [
  "book",
  "course",
  "membership",
  "trainer",
  "other",
] as const;
export const ownedResourceSchema = z.object({
  kind: z.enum(OWNED_RESOURCE_KINDS),
  label: z.string().trim().min(1).max(160),
  /** Optional pointer to a catalog ResourceRef id / external URL the generator can match. */
  externalRef: z.string().trim().min(1).max(200).optional(),
});
export type OwnedResource = z.infer<typeof ownedResourceSchema>;

/** Depth-vs-breadth and interleave preference — a PREFERENCE (autonomy, SDT), not a skill
 *  claim. Feeds the daily-mix weighting (Seam 7); the science of how it weights lives in
 *  config, not here. */
export const DEPTH_VS_BREADTH = ["depth", "balanced", "breadth"] as const;
export const sessionStyleSchema = z.object({
  depthVsBreadth: z.enum(DEPTH_VS_BREADTH),
  interleave: z.boolean(),
});
export type SessionStyle = z.infer<typeof sessionStyleSchema>;

/** The default session style for a fresh user — balanced, interleaved (the config decides
 *  what those mean for the mix). */
export const DEFAULT_SESSION_STYLE: SessionStyle = {
  depthVsBreadth: "balanced",
  interleave: true,
};

/** Seam-9 implementation intention: anchor training to an existing daily cue. */
export const ifThenPlanSchema = z.object({
  cue: z.string().trim().min(1).max(160),
  plan: z.string().trim().min(1).max(160),
});
export type IfThenPlan = z.infer<typeof ifThenPlanSchema>;

export const CHESS_FORMATS = ["bullet", "blitz", "rapid", "classical"] as const;

/** The user's primary play medium (M14). Self-report is VALID here — it is a goal/constraint,
 *  not a skill claim (Seam 2) — and it drives the Seam-4 2D/3D modality, OTB-prep, and board
 *  interface-restriction recommendations (METHODOLOGY §4.4). Rides in the formatPrefs JSON
 *  column so no migration is needed (BUILD.md §5.4). */
export const TARGET_FOCUSES = ["online", "otb", "hybrid"] as const;
export type TargetFocus = (typeof TARGET_FOCUSES)[number];

export const formatPrefsSchema = z.object({
  formats: z.array(z.enum(CHESS_FORMATS)).max(CHESS_FORMATS.length),
  preferredVariety: z.boolean(),
  // Defaults to "online" so rows written before M14 decode cleanly (no migration).
  targetFocus: z.enum(TARGET_FOCUSES).default("online"),
});
export type FormatPrefs = z.infer<typeof formatPrefsSchema>;

export const constraintsInputSchema = z.object({
  minutesPerDay: z.number().int().min(5).max(1440),
  daysPerWeek: z.number().int().min(1).max(7),
  goals: z.array(goalSchema).max(10),
  ownedResources: z.array(ownedResourceSchema).max(100),
  formatPrefs: formatPrefsSchema,
  sessionStyle: sessionStyleSchema,
  ifThenPlan: ifThenPlanSchema.nullable(),
});
export type ConstraintsInput = z.infer<typeof constraintsInputSchema>;

/** A sensible empty default for a fresh form. */
export const EMPTY_CONSTRAINTS: ConstraintsInput = {
  minutesPerDay: 20,
  daysPerWeek: 5,
  goals: [],
  ownedResources: [],
  formatPrefs: { formats: [], preferredVariety: false, targetFocus: "online" },
  sessionStyle: DEFAULT_SESSION_STYLE,
  ifThenPlan: null,
};
