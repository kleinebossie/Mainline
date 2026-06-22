// Assessment orchestration (BUILD.md M4 · Seam 2). The graded DECISIONS live in the
// pure methodology functions (nextCalibrationItem/scoreCalibration); this module only
// plumbs DB state into and out of them (L1: server orchestrates, it does not decide).
// The append-only calibration responses are BEHAVIOURAL — skill is never read from
// self-report (Seam 2 / Dunning-Kruger).
//
// MULTI-TRACK (Seam 2 tracks): calibration runs one adaptive ladder per configured track
// (tactics → calculation → endgames…), reusing the same pure staircase/estimator. Each
// stored response is tagged with its track; the ladders run in sequence; the assessment is
// complete when every track's stop rule has fired. The first track is the primary tactical
// estimate that seeds the band (resolveTacticalRating).

import type { Prisma, PrismaClient } from "@prisma/client";
import { z } from "zod";

import {
  loadMethodology,
  nextCalibrationItem,
  scoreCalibration,
  type CalibrationEstimate,
  type CalibrationResponse,
  type CalibrationTrack,
  type MethodologyConfig,
  type NextCalibrationItem,
} from "@/methodology";

type Db = Pick<PrismaClient, "assessment" | "chessProfileSnapshot">;

// A stored response is a behavioural outcome tagged with its track (track optional for
// back-compat with single-track rows written before multi-track; those default to track 0).
export const calibrationResponseSchema = z.object({
  track: z.string().min(1).optional(),
  ratingShown: z.number().int(),
  correct: z.boolean(),
});
type StoredResponse = z.infer<typeof calibrationResponseSchema>;

const responsesSchema = z.array(calibrationResponseSchema);

/** Parse the stored JSON responses defensively (server-written, but never trust JSON). */
function parseResponses(stored: unknown): StoredResponse[] {
  const r = responsesSchema.safeParse(stored);
  return r.success ? r.data : [];
}

/** The behavioural responses for one track (track-tagged; untagged → the first track). */
function responsesForTrack(
  all: StoredResponse[],
  trackId: string,
  firstTrackId: string,
): CalibrationResponse[] {
  return all
    .filter((r) => (r.track ?? firstTrackId) === trackId)
    .map((r) => ({ ratingShown: r.ratingShown, correct: r.correct }));
}

/** Pull a tactical-ish rating (puzzle, else rapid) from a snapshot's ratings JSON. */
export function ratingFromSnapshot(ratings: unknown): number | null {
  if (!ratings || typeof ratings !== "object") return null;
  const r = ratings as Record<string, unknown>;
  for (const fmt of ["puzzle", "rapid"]) {
    const f = r[fmt];
    if (f && typeof f === "object") {
      const rating = (f as Record<string, unknown>).rating;
      if (typeof rating === "number" && Number.isFinite(rating)) {
        return Math.round(rating);
      }
    }
  }
  return null;
}

/**
 * Seam 2 startRating rule: the user's platform puzzle/rapid rating if present, else the
 * config default (which is effectively the no-data band midpoint — without a rating
 * there is no band). Only used to seed the very first ladder item.
 */
export async function resolveStartRating(
  db: Db,
  userId: string,
  cfg: MethodologyConfig,
): Promise<number> {
  const snap = await db.chessProfileSnapshot.findFirst({
    where: { userId },
    orderBy: { capturedAt: "desc" },
    select: { ratings: true },
  });
  return (
    ratingFromSnapshot(snap?.ratings) ??
    cfg.assessment.calibration.startRating.value
  );
}

export interface CalibrationTrackState {
  id: string;
  dimension: string;
  label: string;
  /** True once this track's own ladder stop rule has fired. */
  completed: boolean;
  responseCount: number;
  next: NextCalibrationItem;
  estimate: CalibrationEstimate;
}

export interface CalibrationState {
  /** True once EVERY track is complete (the whole assessment is done). */
  completed: boolean;
  // Active-track convenience (what the live ladder UI serves now).
  responseCount: number;
  maxItems: number;
  timeBudgetMin: number;
  next: NextCalibrationItem;
  /** The PRIMARY (first/tactical) track estimate — what the reveal gauge shows (L3). */
  estimate: CalibrationEstimate;
  // Multi-track.
  trackCount: number;
  /** Index of the track currently being probed, or -1 when all are complete. */
  activeTrackIndex: number;
  activeTrack: CalibrationTrackState | null;
  tracks: CalibrationTrackState[];
}

/** Build the per-track states from the stored responses + config (pure given inputs). */
function buildTrackStates(
  cfg: MethodologyConfig,
  all: StoredResponse[],
  startRating: number,
): CalibrationTrackState[] {
  const tracks = cfg.assessment.tracks;
  const firstId = tracks[0]!.id;
  return tracks.map((t: CalibrationTrack): CalibrationTrackState => {
    const responses = responsesForTrack(all, t.id, firstId);
    const next = nextCalibrationItem({ responses, startRating }, cfg);
    return {
      id: t.id,
      dimension: t.dimension,
      label: t.label,
      completed: next.done,
      responseCount: responses.length,
      next,
      estimate: scoreCalibration({ responses }, cfg),
    };
  });
}

/** Assemble the full calibration state the UI renders from current DB + config. */
export async function getCalibrationState(
  db: Db,
  userId: string,
): Promise<CalibrationState> {
  const cfg = loadMethodology();
  const row = await db.assessment.findUnique({ where: { userId } });
  const all = parseResponses(row?.calibrationResponses);
  const startRating = await resolveStartRating(db, userId, cfg);

  const trackStates = buildTrackStates(cfg, all, startRating);
  const primary = trackStates[0]!;
  const activeTrackIndex = trackStates.findIndex((t) => !t.completed);
  const activeTrack =
    activeTrackIndex >= 0 ? trackStates[activeTrackIndex]! : null;

  return {
    completed: Boolean(row?.completedAt),
    responseCount: activeTrack?.responseCount ?? primary.responseCount,
    maxItems: cfg.assessment.calibration.maxItems.value,
    timeBudgetMin: cfg.assessment.calibration.timeBudgetMin.value,
    next: activeTrack?.next ?? primary.next,
    estimate: primary.estimate,
    trackCount: trackStates.length,
    activeTrackIndex,
    activeTrack,
    tracks: trackStates,
  };
}

/**
 * Append one calibration response to the ACTIVE track, persist, and — once every track's
 * stop rule has fired — score each track into a graded estimate and snapshot the seeds
 * (grade + citation travel onto `derivedSkillSeed`, an array, one per dimension; L3). The
 * server picks the active track (no client/server race). Returns the fresh state.
 */
export async function applyCalibrationResponse(
  db: Db,
  userId: string,
  response: { ratingShown: number; correct: boolean },
  now: Date,
): Promise<CalibrationState> {
  const cfg = loadMethodology();
  const row = await db.assessment.findUnique({ where: { userId } });

  // Once complete, submissions are a no-op (idempotent): just return current state.
  if (row?.completedAt) return getCalibrationState(db, userId);

  const prev = parseResponses(row?.calibrationResponses);
  const startRating = await resolveStartRating(db, userId, cfg);

  // The active track = the first whose ladder has not yet stopped.
  const states = buildTrackStates(cfg, prev, startRating);
  const active = states.find((t) => !t.completed) ?? null;

  // No active track means everything already finished — finalise idempotently.
  const all =
    active == null
      ? prev
      : [
          ...prev,
          {
            track: active.id,
            ratingShown: response.ratingShown,
            correct: response.correct,
          } satisfies StoredResponse,
        ];

  // Recompute after appending; the assessment is finished when all tracks are done.
  const after = buildTrackStates(cfg, all, startRating);
  const finished = after.every((t) => t.completed);

  const completion = finished
    ? {
        completedAt: now,
        // Primary (tactical) track seeds the band-driving estimate.
        tacticalRatingEstimate: after[0]!.estimate.tacticalRatingEstimate,
        uncertainty: after[0]!.estimate.uncertainty,
        // L3 snapshot: one graded seed per probed dimension.
        derivedSkillSeed: after.map((t) => ({
          track: t.id,
          dimension: t.dimension,
          estimate: t.estimate.tacticalRatingEstimate,
          uncertainty: t.estimate.uncertainty,
          evidenceGrade: t.estimate.evidenceGrade,
          evidenceTier: t.estimate.evidenceTier,
          citationKey: t.estimate.citationKey,
          flag: t.estimate.flag ?? null,
          rationaleKey: t.estimate.rationaleKey,
          methodologyVersion: cfg.version,
        })) as unknown as Prisma.InputJsonValue,
      }
    : {};

  const responsesJson = all as unknown as Prisma.InputJsonValue;
  await db.assessment.upsert({
    where: { userId },
    create: {
      userId,
      calibrationResponses: responsesJson,
      methodologyVersion: cfg.version,
      ...completion,
    },
    update: {
      calibrationResponses: responsesJson,
      methodologyVersion: cfg.version,
      ...completion,
    },
  });

  return getCalibrationState(db, userId);
}
