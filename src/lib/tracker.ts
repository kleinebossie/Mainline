// Tracker boundary types (BUILD.md §5.5). Shared by the /today client, the tRPC router,
// and the JSON-column typing — one validation truth (BUILD.md §3), like lib/constraints.ts.
//
// L1: these are RAW outcome shapes (correct / how long / how much time), never an
// interpretation, grade, or recommendation — judging an outcome is methodology (Seam 6),
// applied in the adaptation loop, not here. The numeric bounds are input-sanity limits.

import { z } from "zod";

/** Where the user is in an external book/course (M14, §5.5 ResourceProgress). Self-reported
 *  POSITION — never a skill claim (Seam 2 boundary). Rides in the book_session payload + rolls
 *  up into the derived ResourceProgress; no DB schema change (ActivityEvent.payload is JSON). */
export const bookPositionSchema = z
  .object({
    chapter: z.number().int().nonnegative().max(10_000).optional(),
    page: z.number().int().nonnegative().max(100_000).optional(),
    exercise: z.string().min(1).max(120).optional(),
    percent: z.number().min(0).max(100).optional(),
  })
  .strict();
export type BookPosition = z.infer<typeof bookPositionSchema>;

/** A book session's self-report (M14): the exercise success rate (drives the 85% difficulty-
 *  calibration nudge, Seam 4 §4.2) and the Woodpecker cycle the user is on (Seam 4 §4.2). A
 *  self-report of OUTCOME on exercises, used ONLY to tune book difficulty — never skill (Seam 2). */
export const bookSelfReportSchema = z
  .object({
    successRate: z.number().min(0).max(1).optional(),
    woodpeckerCycle: z.number().int().min(1).max(99).optional(),
  })
  .strict();
export type BookSelfReport = z.infer<typeof bookSelfReportSchema>;

/** The append-only ActivityEvent payload (§5.5) — uninterpreted facts only. */
export const activityEventPayloadSchema = z
  .object({
    correct: z.boolean().optional(),
    solveTimeMs: z.number().int().nonnegative().max(86_400_000).optional(),
    durationMin: z.number().nonnegative().max(600).optional(),
    externalRef: z.string().min(1).max(200).optional(),
    puzzleId: z.string().min(1).max(100).optional(),
    // The personal practice position a drill_done outcome solved (M12 blunder drill); keys
    // its per-item FSRS schedule (itemType "blunder_drill", itemRef = PracticeItem.id).
    practiceItemId: z.string().min(1).max(100).optional(),
    // M14 — a book_session ties to the external resource it progressed (the config book id /
    // ResourceRef id), and records the self-reported position + success. ResourceProgress
    // (§5.5) is ROLLED UP from these events; no DB schema change (this column is JSON).
    resourceRefId: z.string().min(1).max(200).optional(),
    position: bookPositionSchema.optional(),
    selfReport: bookSelfReportSchema.optional(),
  })
  .strict();
export type ActivityEventPayload = z.infer<typeof activityEventPayloadSchema>;

/** The event taxonomy the tracker accepts from the client (§5.5). */
export const ACTIVITY_EVENT_TYPES = [
  "puzzle_attempt",
  "drill_done",
  "game_played",
  // M14 — a logged book/course study session (external resource, self-reported), feeding the
  // SAME adaptation loop as every in-app outcome.
  "book_session",
  "skip",
  "self_report",
] as const;

/** The tRPC input for logging one outcome from the /today screen. */
export const logOutcomeInputSchema = z.object({
  programItemId: z.string().min(1).optional(),
  type: z.enum(ACTIVITY_EVENT_TYPES),
  correct: z.boolean().optional(),
  solveTimeMs: z.number().int().nonnegative().max(86_400_000).optional(),
  durationMin: z.number().nonnegative().max(600).optional(),
  externalRef: z.string().min(1).max(200).optional(),
  puzzleId: z.string().min(1).max(100).optional(),
  practiceItemId: z.string().min(1).max(100).optional(),
  // M14 — book_session fields (the external resource + self-reported position/success).
  resourceRefId: z.string().min(1).max(200).optional(),
  position: bookPositionSchema.optional(),
  selfReport: bookSelfReportSchema.optional(),
});
export type LogOutcomeInput = z.infer<typeof logOutcomeInputSchema>;

/** The FSRS memory state as persisted in ScheduleState.fsrsState (defensive re-parse). The
 *  shape mirrors engine/math FsrsState; kept here so db/server validate JSON without
 *  importing engine internals. */
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
