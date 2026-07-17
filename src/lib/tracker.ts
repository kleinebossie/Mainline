// Shared validation for raw activity outcomes. Interpretation belongs in methodology.

import { z } from "zod";

import { DAY_MS } from "@/lib/clock";

/** Self-reported position in an external resource, never a skill estimate. */
export const bookPositionSchema = z
  .object({
    chapter: z.number().int().nonnegative().max(10_000).optional(),
    page: z.number().int().nonnegative().max(100_000).optional(),
    exercise: z.string().min(1).max(120).optional(),
    percent: z.number().min(0).max(100).optional(),
    unitCount: z.number().int().positive().max(10_000).optional(),
  })
  .strict();
export type BookPosition = z.infer<typeof bookPositionSchema>;

/** Book-session outcome used for difficulty feedback, never skill estimation. */
export const bookSelfReportSchema = z
  .object({
    successRate: z.number().min(0).max(1).optional(),
    woodpeckerCycle: z.number().int().min(1).max(99).optional(),
  })
  .strict();

export const activityEventPayloadSchema = z
  .object({
    correct: z.boolean().optional(),
    solveTimeMs: z.number().int().nonnegative().max(DAY_MS).optional(),
    durationMin: z.number().nonnegative().max(600).optional(),
    externalRef: z.string().min(1).max(200).optional(),
    puzzleId: z.string().min(1).max(100).optional(),
    // Identifies the personal position whose review schedule should be updated.
    practiceItemId: z.string().min(1).max(100).optional(),
    resourceRefId: z.string().min(1).max(200).optional(),
    position: bookPositionSchema.optional(),
    selfReport: bookSelfReportSchema.optional(),
    reversesEventId: z.string().min(1).max(100).optional(),
  })
  .strict();

const ACTIVITY_EVENT_TYPES = [
  "puzzle_attempt",
  "drill_done",
  "game_played",
  "book_session",
  "skip",
  "skip_undone",
  "self_report",
] as const;

type LoggableActivityEventType = (typeof ACTIVITY_EVENT_TYPES)[number];

/** Structural tracker events that change item state without completing activity. */
export const NON_COMPLETION_ACTIVITY_EVENT_TYPES = [
  "skip",
  "skip_undone",
] as const satisfies readonly LoggableActivityEventType[];

export const logOutcomeInputSchema = z.object({
  requestId: z.string().uuid(),
  programItemId: z.string().min(1).optional(),
  completeProgramItem: z.boolean().optional(),
  type: z.enum(ACTIVITY_EVENT_TYPES),
  correct: z.boolean().optional(),
  solveTimeMs: z.number().int().nonnegative().max(DAY_MS).optional(),
  durationMin: z.number().nonnegative().max(600).optional(),
  externalRef: z.string().min(1).max(200).optional(),
  puzzleId: z.string().min(1).max(100).optional(),
  practiceItemId: z.string().min(1).max(100).optional(),
  resourceRefId: z.string().min(1).max(200).optional(),
  position: bookPositionSchema.optional(),
  selfReport: bookSelfReportSchema.optional(),
});
export type LogOutcomeInput = z.infer<typeof logOutcomeInputSchema>;

export const completeProgramItemInputSchema = z
  .object({
    requestId: z.string().uuid(),
    programItemId: z.string().min(1),
  })
  .strict();
export type CompleteProgramItemInput = z.infer<
  typeof completeProgramItemInputSchema
>;

/** Persisted FSRS state, defined here to keep DB validation out of Engine internals. */
export const fsrsStateSchema = z
  .object({
    stability: z.number(),
    difficulty: z.number(),
    due: z.number(),
    reps: z.number().int(),
    lapses: z.number().int(),
    lastReview: z.number(),
  })
  .strict();
