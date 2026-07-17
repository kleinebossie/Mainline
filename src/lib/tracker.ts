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

export const LOGGABLE_ACTIVITY_EVENT_TYPES = [
  "puzzle_attempt",
  "drill_done",
  "game_played",
  "book_session",
  "skip",
  "self_report",
] as const;

export type LoggableActivityEventType =
  (typeof LOGGABLE_ACTIVITY_EVENT_TYPES)[number];

export const SKIP_UNDONE_ACTIVITY_EVENT_TYPE = "skip_undone" as const;
export const PROGRAM_ITEM_COMPLETION_EVENT_TYPE = "session_completed" as const;
export const GAME_ANALYSED_ACTIVITY_EVENT_TYPE = "game_analysed" as const;

export const STRUCTURAL_ACTIVITY_EVENT_TYPES = [
  SKIP_UNDONE_ACTIVITY_EVENT_TYPE,
  PROGRAM_ITEM_COMPLETION_EVENT_TYPE,
] as const;

export const SPECIALIZED_ACTIVITY_EVENT_TYPES = [
  GAME_ANALYSED_ACTIVITY_EVENT_TYPE,
] as const;

export const ACTIVITY_EVENT_TYPES = [
  ...LOGGABLE_ACTIVITY_EVENT_TYPES,
  ...STRUCTURAL_ACTIVITY_EVENT_TYPES,
  ...SPECIALIZED_ACTIVITY_EVENT_TYPES,
] as const;
export type ActivityEventType = (typeof ACTIVITY_EVENT_TYPES)[number];

export const PROGRAM_ITEM_TERMINAL_STATUSES = ["done", "skipped"] as const;
export type ProgramItemTerminalStatus =
  (typeof PROGRAM_ITEM_TERMINAL_STATUSES)[number];

/** Structural tracker events that change item state without completing activity. */
export const NON_COMPLETION_ACTIVITY_EVENT_TYPES = [
  "skip",
  SKIP_UNDONE_ACTIVITY_EVENT_TYPE,
] as const satisfies readonly ActivityEventType[];

export const NON_OUTCOME_ACTIVITY_EVENT_TYPES = [
  ...NON_COMPLETION_ACTIVITY_EVENT_TYPES,
  PROGRAM_ITEM_COMPLETION_EVENT_TYPE,
] as const satisfies readonly ActivityEventType[];

export function programItemStatusAfterOutcome(input: {
  readonly programItemId?: string;
  readonly completeProgramItem?: boolean;
  readonly type: LoggableActivityEventType;
}): ProgramItemTerminalStatus | null {
  if (!input.programItemId) return null;
  if (input.type === "skip") return "skipped";
  return input.completeProgramItem === false ? null : "done";
}

export function outcomeCompletesActivity(input: {
  readonly programItemId?: string;
  readonly completeProgramItem?: boolean;
  readonly type: LoggableActivityEventType;
}): boolean {
  const itemStatus = programItemStatusAfterOutcome(input);
  if (input.programItemId) return itemStatus === "done";
  return input.type !== "skip";
}

export const logOutcomeInputSchema = z.object({
  requestId: z.string().uuid(),
  programItemId: z.string().min(1).optional(),
  completeProgramItem: z.boolean().optional(),
  type: z.enum(LOGGABLE_ACTIVITY_EVENT_TYPES),
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
