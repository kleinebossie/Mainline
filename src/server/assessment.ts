// Assessment orchestration (BUILD.md M4 · Seam 2). The graded DECISIONS live in the
// pure methodology functions (nextCalibrationItem/scoreCalibration); this module only
// plumbs DB state into and out of them (L1: server orchestrates, it does not decide).
// The append-only calibration responses are BEHAVIOURAL — skill is never read from
// self-report (Seam 2 / Dunning-Kruger).

import type { Prisma, PrismaClient } from "@prisma/client";
import { z } from "zod";

import {
  loadMethodology,
  nextCalibrationItem,
  scoreCalibration,
  type CalibrationEstimate,
  type CalibrationResponse,
  type MethodologyConfig,
  type NextCalibrationItem,
} from "@/methodology";

type Db = Pick<PrismaClient, "assessment" | "chessProfileSnapshot">;

export const calibrationResponseSchema = z.object({
  ratingShown: z.number().int(),
  correct: z.boolean(),
});

const responsesSchema = z.array(calibrationResponseSchema);

/** Parse the stored JSON responses defensively (server-written, but never trust JSON). */
function parseResponses(stored: unknown): CalibrationResponse[] {
  const r = responsesSchema.safeParse(stored);
  return r.success ? r.data : [];
}

/** Pull a tactical-ish rating (puzzle, else rapid) from a snapshot's ratings JSON. */
function ratingFromSnapshot(ratings: unknown): number | null {
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
    ratingFromSnapshot(snap?.ratings) ?? cfg.assessment.calibration.startRating.value
  );
}

export interface CalibrationState {
  completed: boolean;
  responseCount: number;
  maxItems: number;
  timeBudgetMin: number;
  next: NextCalibrationItem;
  /** Live graded estimate (preview during; final once `completed`). Carries its grade (L3). */
  estimate: CalibrationEstimate;
}

/** Assemble the full calibration state the UI renders from current DB + config. */
export async function getCalibrationState(
  db: Db,
  userId: string,
): Promise<CalibrationState> {
  const cfg = loadMethodology();
  const row = await db.assessment.findUnique({ where: { userId } });
  const responses = parseResponses(row?.calibrationResponses);
  const startRating = await resolveStartRating(db, userId, cfg);
  return {
    completed: Boolean(row?.completedAt),
    responseCount: responses.length,
    maxItems: cfg.assessment.calibration.maxItems.value,
    timeBudgetMin: cfg.assessment.calibration.timeBudgetMin.value,
    next: nextCalibrationItem({ responses, startRating }, cfg),
    estimate: scoreCalibration({ responses }, cfg),
  };
}

/**
 * Append one calibration response, persist, and — if the stop rule now fires — score
 * the calibration into a graded estimate and snapshot it (grade + citation travel onto
 * `derivedSkillSeed`, L3, to seed SkillState in M6/M7). Returns the fresh state.
 */
export async function applyCalibrationResponse(
  db: Db,
  userId: string,
  response: CalibrationResponse,
): Promise<CalibrationState> {
  const cfg = loadMethodology();
  const row = await db.assessment.findUnique({ where: { userId } });

  // Once complete, submissions are a no-op (idempotent): just return current state.
  if (row?.completedAt) return getCalibrationState(db, userId);

  const prev = parseResponses(row?.calibrationResponses);
  const startRating = await resolveStartRating(db, userId, cfg);

  // Guard against over-filling past the cap (UI also stops, but be defensive).
  const atCap = prev.length >= cfg.assessment.calibration.maxItems.value;
  const responses = atCap ? prev : [...prev, response];

  const next = nextCalibrationItem({ responses, startRating }, cfg);
  const finished = next.done;

  const completion = finished
    ? (() => {
        const est = scoreCalibration({ responses }, cfg);
        return {
          completedAt: new Date(),
          tacticalRatingEstimate: est.tacticalRatingEstimate,
          uncertainty: est.uncertainty,
          // L3 snapshot: the grade/citation travel with the persisted seed.
          derivedSkillSeed: {
            dimension: "tactics",
            estimate: est.tacticalRatingEstimate,
            uncertainty: est.uncertainty,
            evidenceGrade: est.evidenceGrade,
            evidenceTier: est.evidenceTier,
            citationKey: est.citationKey,
            flag: est.flag ?? null,
            rationaleKey: est.rationaleKey,
            methodologyVersion: cfg.version,
          } satisfies Prisma.InputJsonObject,
        };
      })()
    : {};

  const responsesJson = responses as unknown as Prisma.InputJsonValue;
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
