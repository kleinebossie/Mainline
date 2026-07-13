// Shared validation for user constraints. Self-report belongs here, but skill estimates
// must come from observed behavior. Numeric bounds are input-sanity limits.

import { z } from "zod";
import {
  MAX_MINUTES_PER_DAY,
  MIN_MINUTES_PER_DAY,
} from "@/lib/constraint-limits";

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
  externalRef: z.string().trim().min(1).max(200).optional(),
});
export type OwnedResource = z.infer<typeof ownedResourceSchema>;

export const DEPTH_VS_BREADTH = ["depth", "balanced", "breadth"] as const;
export const sessionStyleSchema = z.object({
  depthVsBreadth: z.enum(DEPTH_VS_BREADTH),
  interleave: z.boolean(),
});
export type SessionStyle = z.infer<typeof sessionStyleSchema>;

export const DEFAULT_SESSION_STYLE: SessionStyle = {
  depthVsBreadth: "balanced",
  interleave: true,
};

export const ifThenPlanSchema = z.object({
  cue: z.string().trim().min(1).max(160),
  plan: z.string().trim().min(1).max(160),
});

export const CHESS_FORMATS = ["bullet", "blitz", "rapid", "classical"] as const;

export const TARGET_FOCUSES = ["online", "otb", "hybrid"] as const;
export type TargetFocus = (typeof TARGET_FOCUSES)[number];

export const formatPrefsSchema = z.object({
  formats: z.array(z.enum(CHESS_FORMATS)).max(CHESS_FORMATS.length),
  preferredVariety: z.boolean(),
  // Defaults to "online" so rows written before M14 decode cleanly (no migration).
  targetFocus: z.enum(TARGET_FOCUSES).default("online"),
});

export const constraintsInputSchema = z.object({
  minutesPerDay: z
    .number()
    .int()
    .min(MIN_MINUTES_PER_DAY)
    .max(MAX_MINUTES_PER_DAY),
  daysPerWeek: z.number().int().min(1).max(7),
  goals: z.array(goalSchema).max(10),
  ownedResources: z.array(ownedResourceSchema).max(100),
  formatPrefs: formatPrefsSchema,
  sessionStyle: sessionStyleSchema,
  ifThenPlan: ifThenPlanSchema.nullable(),
});
export type ConstraintsInput = z.infer<typeof constraintsInputSchema>;

export const EMPTY_CONSTRAINTS: ConstraintsInput = {
  minutesPerDay: 20,
  daysPerWeek: 5,
  goals: [],
  ownedResources: [],
  formatPrefs: { formats: [], preferredVariety: false, targetFocus: "online" },
  sessionStyle: DEFAULT_SESSION_STYLE,
  ifThenPlan: null,
};
