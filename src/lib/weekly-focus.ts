import { z } from "zod";

import { programDecisionInputSchema } from "@/lib/decision-input";

export const focusRationaleSnapshotSchema = z.object({
  text: z.string().min(1),
  grade: z.enum(["A", "B", "C", "D"]),
  tier: z.union([z.literal(1), z.literal(2)]),
  citationKey: z.string().min(1),
  soften: z.boolean(),
});

export const focusAlternativeSchema = z.object({
  focusArea: z.string().min(1),
  score: z.number().finite(),
  supportingSources: z.array(z.string().min(1)),
  tradeoff: focusRationaleSnapshotSchema,
});

export const programWeeklyFocusSnapshotSchema = z.object({
  id: z.string().min(1),
  weekStart: z.number().int(),
  focusAreas: z.array(z.string().min(1)).min(1),
  supportingSignals: z.array(
    z.object({
      focusArea: z.string().min(1),
      sources: z.array(z.string().min(1)),
      score: z.number().finite(),
    }),
  ),
  confidence: z.enum(["insufficient", "low", "medium", "high"]),
  methodologyVersion: z.string().min(1),
  rationaleSnapshots: z.array(focusRationaleSnapshotSchema).min(1),
  alternatives: z.array(focusAlternativeSchema),
  selectedAlternative: z.string().nullable(),
  revisionTrigger: z.string().nullable(),
  createdAt: z.number().int(),
});

export const programGenerationInputSchema = programDecisionInputSchema.extend({
  weeklyFocus: programWeeklyFocusSnapshotSchema,
});

export const weeklyFocusSchema = z.object({
  id: z.string().min(1),
  weekStart: z.number().int(),
  focusAreas: z.array(z.string().min(1)).min(1),
  supportingSignals: z.array(
    z.object({
      focusArea: z.string().min(1),
      sources: z.array(z.string().min(1)),
      score: z.number().finite(),
    }),
  ),
  confidence: z.enum(["insufficient", "low", "medium", "high"]),
  methodologyVersion: z.string().min(1),
  inputSnapshot: programDecisionInputSchema,
  status: z.enum(["active", "superseded"]),
  rationaleSnapshots: z.array(focusRationaleSnapshotSchema).min(1),
  alternatives: z.array(focusAlternativeSchema),
  selectedAlternative: z.string().nullable(),
  revisionTrigger: z.string().nullable(),
  createdAt: z.number().int(),
});

export type WeeklyFocus = z.infer<typeof weeklyFocusSchema>;
export type FocusAlternative = z.infer<typeof focusAlternativeSchema>;
export type ProgramGenerationInput = z.infer<
  typeof programGenerationInputSchema
>;
