// Shared transport schemas for the immutable program-history read side.

import { z } from "zod";

export const programHistoryCursorSchema = z
  .object({
    createdAt: z.date(),
    id: z.string().min(1).max(100),
  })
  .strict();

export const programHistoryInputSchema = z
  .object({
    cursor: programHistoryCursorSchema.optional(),
    limit: z.number().int().min(1).max(25).default(10),
    direction: z.enum(["forward", "backward"]).optional(),
  })
  .strict();

const historyMinutesSchema = z.number().nonnegative().finite().nullable();

export const programHistoryItemSchema = z
  .object({
    id: z.string(),
    orderIndex: z.number().int().nonnegative(),
    activityId: z.string(),
    activityType: z.string(),
    label: z.string(),
    dimensionLabels: z.array(z.string()),
    plannedMinutes: historyMinutesSchema,
    actualMinutes: historyMinutesSchema,
    status: z.string(),
    eventCount: z.number().int().nonnegative(),
    measuredEventCount: z.number().int().nonnegative(),
    measurementTruncated: z.boolean(),
    lastActivityAt: z.date().nullable(),
    rationale: z
      .object({
        text: z.string(),
        evidenceGrade: z.string(),
        evidenceTier: z.number().int(),
        citationKey: z.string(),
        citationSource: z.string().nullable(),
        confidence: z.string(),
        soften: z.boolean(),
      })
      .strict(),
  })
  .strict();

export const programHistoryEntrySchema = z
  .object({
    id: z.string(),
    status: z.string(),
    scheduledDate: z.date().nullable(),
    createdAt: z.date(),
    methodologyVersion: z.string(),
    plannedMinutes: historyMinutesSchema,
    actualMinutes: historyMinutesSchema,
    eventCount: z.number().int().nonnegative(),
    measuredEventCount: z.number().int().nonnegative(),
    measurementTruncated: z.boolean(),
    lastActivityAt: z.date().nullable(),
    items: z.array(programHistoryItemSchema),
  })
  .strict();

export const programHistoryPageSchema = z
  .object({
    entries: z.array(programHistoryEntrySchema),
    nextCursor: programHistoryCursorSchema.nullable(),
  })
  .strict();

export type ProgramHistoryCursor = z.infer<typeof programHistoryCursorSchema>;
export type ProgramHistoryInput = z.infer<typeof programHistoryInputSchema>;
export type ProgramHistoryItem = z.infer<typeof programHistoryItemSchema>;
export type ProgramHistoryEntry = z.infer<typeof programHistoryEntrySchema>;
export type ProgramHistoryPage = z.infer<typeof programHistoryPageSchema>;
