import { z } from "zod";

import {
  MAX_MINUTES_PER_DAY,
  MIN_MINUTES_PER_DAY,
} from "@/lib/constraint-limits";
import { focusRationaleSnapshotSchema } from "@/lib/weekly-focus";

const weekdaySchema = z.number().int().min(0).max(6);
export const weeklyAvailabilityInputSchema = z
  .object({
    mode: z.enum(["flexible", "preferred"]),
    preferredWeekdays: z.array(weekdaySchema).max(7),
    defaultMinutesByDay: z.record(
      z.string(),
      z.number().int().min(MIN_MINUTES_PER_DAY).max(MAX_MINUTES_PER_DAY),
    ),
  })
  .strict()
  .superRefine((value, ctx) => {
    if (value.mode === "preferred" && value.preferredWeekdays.length === 0) {
      ctx.addIssue({
        code: "custom",
        message: "Choose at least one preferred weekday",
      });
    }
    if (
      new Set(value.preferredWeekdays).size !== value.preferredWeekdays.length
    ) {
      ctx.addIssue({
        code: "custom",
        path: ["preferredWeekdays"],
        message: "Preferred weekdays must be unique",
      });
    }
    for (const key of Object.keys(value.defaultMinutesByDay)) {
      if (!/^[0-6]$/.test(key)) {
        ctx.addIssue({
          code: "custom",
          path: ["defaultMinutesByDay", key],
          message: "Minute budgets must use UTC weekday keys 0 through 6",
        });
      }
    }
  });
export type WeeklyAvailabilityInput = z.infer<
  typeof weeklyAvailabilityInputSchema
>;

export const availabilityOverrideInputSchema = z
  .object({
    date: z.number().int(),
    minutes: z
      .number()
      .int()
      .min(MIN_MINUTES_PER_DAY)
      .max(MAX_MINUTES_PER_DAY)
      .nullable(),
    unavailable: z.boolean(),
  })
  .strict()
  .superRefine((value, ctx) => {
    if (value.unavailable === (value.minutes !== null)) {
      ctx.addIssue({
        code: "custom",
        message: "Choose either unavailable or a minute budget",
      });
    }
  });
export type AvailabilityOverrideInput = z.infer<
  typeof availabilityOverrideInputSchema
>;

export const forecastBlockSchema = z
  .object({
    activityId: z.string().min(1),
    activityType: z.string().min(1),
    expectedMinutes: z.number().int().nonnegative(),
    dimensionsTargeted: z.array(z.string()),
    rationaleKey: z.string().min(1),
    rationaleText: z.string().min(1),
    evidenceGrade: z.enum(["A", "B", "C", "D"]),
    evidenceTier: z.union([z.literal(1), z.literal(2)]),
    citationKey: z.string().min(1),
    confidence: z.string().min(1),
    soften: z.boolean(),
  })
  .strict();
export type ForecastBlock = z.infer<typeof forecastBlockSchema>;

export const programDayForecastSchema = z
  .object({
    id: z.string().min(1),
    date: z.number().int(),
    status: z.enum(["provisional", "materialized", "superseded"]),
    plannedBlocks: z.array(forecastBlockSchema),
    expectedMinutes: z.number().int().nonnegative(),
    focusLinks: z.array(z.string()),
    dueReviewPressure: z
      .object({ count: z.number().int().nonnegative() })
      .strict(),
    rationaleSnapshots: z.array(focusRationaleSnapshotSchema),
    methodologyVersion: z.string().min(1),
  })
  .strict();
export type ProgramDayForecast = z.infer<typeof programDayForecastSchema>;

const revisionDecisionSchema = focusRationaleSnapshotSchema;
export const programRevisionSchema = z
  .object({
    id: z.string().min(1),
    previousFocusId: z.string().nullable(),
    newFocusId: z.string().nullable(),
    previousForecastId: z.string().nullable(),
    newForecastId: z.string().nullable(),
    trigger: z.string().min(1),
    changedFields: z.array(z.string()),
    gradedDecisions: z.array(revisionDecisionSchema),
    methodologyVersion: z.string().min(1),
    occurredAt: z.number().int(),
  })
  .strict();
export type ProgramRevision = z.infer<typeof programRevisionSchema>;

export const programRevisionCursorSchema = z
  .object({
    occurredAt: z.number().int(),
    id: z.string().min(1),
  })
  .strict();

export const programRevisionPageInputSchema = z
  .object({
    cursor: programRevisionCursorSchema.optional(),
    limit: z.number().int().min(1).max(50).default(20),
    direction: z.enum(["forward", "backward"]).optional(),
  })
  .strict();

export const programRevisionPageSchema = z
  .object({
    revisions: z.array(programRevisionSchema),
    nextCursor: programRevisionCursorSchema.nullable(),
  })
  .strict();

export type ProgramRevisionPageInput = z.infer<
  typeof programRevisionPageInputSchema
>;
export type ProgramRevisionPage = z.infer<typeof programRevisionPageSchema>;
