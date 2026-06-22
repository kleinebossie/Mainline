// Tracker boundary types (BUILD.md §5.5). Shared by the /today client, the tRPC router,
// and the JSON-column typing — one validation truth (BUILD.md §3), like lib/constraints.ts.
//
// L1: these are RAW outcome shapes (correct / how long / how much time), never an
// interpretation, grade, or recommendation — judging an outcome is methodology (Seam 6),
// applied in the adaptation loop, not here. The numeric bounds are input-sanity limits.

import { z } from "zod";

/** The append-only ActivityEvent payload (§5.5) — uninterpreted facts only. */
export const activityEventPayloadSchema = z
  .object({
    correct: z.boolean().optional(),
    solveTimeMs: z.number().int().nonnegative().max(86_400_000).optional(),
    durationMin: z.number().nonnegative().max(600).optional(),
    externalRef: z.string().min(1).max(200).optional(),
    puzzleId: z.string().min(1).max(100).optional(),
  })
  .strict();
export type ActivityEventPayload = z.infer<typeof activityEventPayloadSchema>;

/** The event taxonomy the tracker accepts from the client (§5.5). */
export const ACTIVITY_EVENT_TYPES = [
  "puzzle_attempt",
  "drill_done",
  "game_played",
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
