// The GradedValue wrapper — the structural form of Law L3 (BUILD.md §0.1, §2.5;
// METHODOLOGY §0.3). EVERY methodology leaf number/copy string is wrapped in a
// GradedValue carrying its evidence grade, tier, and citation, so the transparency
// UI can always show "how strong is this?" and a stub/Grade-D value can never
// masquerade as fact. The config Zod schema (schema/config.ts) is built from the
// `gradedValue()` combinator below, which is what makes "no bare leaf number"
// machine-checkable (the L3 guard, §13.4).

import { z } from "zod";

/** A = strong/replicated · B = suggestive · C = theory/expert · D = myth-to-avoid. */
export const GRADES = ["A", "B", "C", "D"] as const;
export type Grade = (typeof GRADES)[number];

/** Tier 1 = chess-specific evidence · Tier 2 = general learning-science, extrapolated. */
export const TIERS = [1, 2] as const;
export type Tier = (typeof TIERS)[number];

/** Honesty flags: a value carrying any of these must never render as Grade-A fact. */
export const GRADED_FLAGS = [
  "best-guess",
  "semi-evidenced",
  "contested",
  "stub",
] as const;
export type GradedFlag = (typeof GRADED_FLAGS)[number];

export interface GradedValue<T> {
  value: T;
  grade: Grade;
  tier: Tier;
  /** → an evidenceLedger anchor key (resolution enforced by the loader, L3). */
  citationKey: string;
  /** stub/best-guess/contested values are flagged so the UI can soften them. */
  flag?: GradedFlag;
  note?: string;
}

export const gradeSchema = z.enum(GRADES);
export const tierSchema = z.union([z.literal(1), z.literal(2)]);
export const gradedFlagSchema = z.enum(GRADED_FLAGS);

/**
 * Wrap an inner value schema as a GradedValue. Using this everywhere a leaf appears
 * is what lets the L3 guard assert "every leaf is graded": a bare number in the JSON
 * fails to parse because the schema expects `{ value, grade, tier, citationKey }`.
 */
export function gradedValue<T extends z.ZodTypeAny>(inner: T) {
  return z.object({
    value: inner,
    grade: gradeSchema,
    tier: tierSchema,
    citationKey: z.string().min(1),
    flag: gradedFlagSchema.optional(),
    note: z.string().optional(),
  });
}

/** Structural test (used by the citation-resolution walk): is this a GradedValue? */
export function isGradedValue(x: unknown): x is GradedValue<unknown> {
  return (
    typeof x === "object" &&
    x !== null &&
    "value" in x &&
    "grade" in x &&
    "citationKey" in x &&
    typeof (x as { citationKey: unknown }).citationKey === "string"
  );
}
