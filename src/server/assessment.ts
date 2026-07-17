// Persists behavioral calibration outcomes. Methodology owns all graded decisions.
// Tracks run in configured order, with the first track supplying the primary estimate.

import type { Prisma, PrismaClient, LichessPuzzle } from "@prisma/client";
import { z } from "zod";

import {
  loadMethodology,
  nextCalibrationItem,
  scoreCalibration,
  bandForRating,
  interfaceAffordancesFor,
  rationaleFor,
  type BoardAffordances,
  type CalibrationEstimate,
  type CalibrationResponse,
  type CalibrationTrack,
  type MethodologyConfig,
  type NextCalibrationItem,
  type RationaleEntry,
} from "@/methodology";
import { selectPuzzles } from "@/db/puzzles";
import { getTargetFocus } from "@/server/constraints";
import { expectedError } from "@/server/errors";
import { calibrationRatingFromSnapshot } from "@/lib/rating-snapshot";

type Db = Pick<
  PrismaClient,
  "assessment" | "chessProfileSnapshot" | "lichessPuzzle" | "constraintSet"
>;

// Legacy single-track responses have no track and belong to the first configured track.
const calibrationResponseSchema = z.object({
  track: z.string().min(1).optional(),
  ratingShown: z.number().int(),
  correct: z.boolean(),
  puzzleId: z.string().optional(),
});
type StoredResponse = z.infer<typeof calibrationResponseSchema>;

const responsesSchema = z.array(calibrationResponseSchema);

function parseResponses(stored: unknown): StoredResponse[] {
  const r = responsesSchema.safeParse(stored);
  return r.success ? r.data : [];
}

function responsesForTrack(
  all: StoredResponse[],
  trackId: string,
  firstTrackId: string,
): CalibrationResponse[] {
  return all
    .filter((r) => (r.track ?? firstTrackId) === trackId)
    .map((r) => ({ ratingShown: r.ratingShown, correct: r.correct }));
}

async function resolveStartRating(
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
    calibrationRatingFromSnapshot(snap?.ratings) ??
    cfg.assessment.calibration.startRating.value
  );
}

interface CalibrationTrackState {
  id: string;
  dimension: string;
  label: string;
  theme: string;
  completed: boolean;
  responseCount: number;
  next: NextCalibrationItem;
  estimate: CalibrationEstimate;
}

export interface CalibrationState {
  completed: boolean;
  responseCount: number;
  maxItems: number;
  timeBudgetMin: number;
  next: NextCalibrationItem;
  estimate: CalibrationEstimate;
  trackCount: number;
  activeTrackIndex: number;
  activeTrack: CalibrationTrackState | null;
  tracks: CalibrationTrackState[];
  activePuzzle: LichessPuzzle | null;
  affordances: BoardAffordances;
  restrictionRationale: RationaleEntry | null;
}

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
      theme: t.theme,
      completed: next.done,
      responseCount: responses.length,
      next,
      estimate: scoreCalibration({ responses }, cfg),
    };
  });
}

export async function getCalibrationState(
  db: Db,
  userId: string,
): Promise<CalibrationState> {
  const row = await db.assessment.findUnique({ where: { userId } });
  // Existing assessments stay pinned to the methodology release that created them.
  const cfg = loadMethodology(row?.methodologyVersion ?? undefined);
  const all = parseResponses(row?.calibrationResponses);
  const startRating = await resolveStartRating(db, userId, cfg);

  const trackStates = buildTrackStates(cfg, all, startRating);
  const primary = trackStates[0]!;
  const activeTrackIndex = trackStates.findIndex((t) => !t.completed);
  const activeTrack =
    activeTrackIndex >= 0 ? trackStates[activeTrackIndex]! : null;

  let activePuzzle: LichessPuzzle | null = null;
  if (activeTrack && !activeTrack.completed) {
    const excludePuzzleIds = all
      .map((r) => r.puzzleId)
      .filter((id): id is string => !!id);

    const puzzles = await selectPuzzles(db, {
      theme: activeTrack.theme,
      ratingTarget: activeTrack.next.ratingTarget,
      count: 10,
      excludePuzzleIds,
    });

    if (puzzles.length > 0) {
      // Stable selection prevents a new puzzle on every render.
      const seedStr = userId + activeTrack.id + activeTrack.next.itemNumber;
      let hash = 0;
      for (let i = 0; i < seedStr.length; i++) {
        hash = seedStr.charCodeAt(i) + ((hash << 5) - hash);
      }
      const idx = Math.abs(hash) % puzzles.length;
      activePuzzle = puzzles[idx] ?? null;
    }
  }

  const targetFocus = await getTargetFocus(db, userId);
  const affordances = interfaceAffordancesFor(
    { band: bandForRating(startRating, cfg), targetFocus },
    cfg,
  );
  const restrictionRationale = affordances.restricted
    ? rationaleFor(affordances.restrictionRationaleKey, cfg)
    : null;

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
    activePuzzle,
    affordances,
    restrictionRationale,
  };
}

/** Append to the server-selected active track and return the refreshed state. */
export async function applyCalibrationResponse(
  db: Db,
  userId: string,
  response: { ratingShown: number; correct: boolean; puzzleId?: string },
  now: Date,
): Promise<CalibrationState> {
  const row = await db.assessment.findUnique({ where: { userId } });
  const cfg = loadMethodology(row?.methodologyVersion ?? undefined);

  if (row?.completedAt) return getCalibrationState(db, userId);

  const prev = parseResponses(row?.calibrationResponses);
  const startRating = await resolveStartRating(db, userId, cfg);

  const states = buildTrackStates(cfg, prev, startRating);
  const active = states.find((t) => !t.completed) ?? null;

  if (active && response.ratingShown !== active.next.ratingTarget) {
    throw expectedError.conflict(
      "That calibration puzzle changed. Reload the calibration before submitting it.",
    );
  }

  const all =
    active == null
      ? prev
      : [
          ...prev,
          {
            track: active.id,
            ratingShown: active.next.ratingTarget,
            correct: response.correct,
            puzzleId: response.puzzleId,
          } satisfies StoredResponse,
        ];

  const after = buildTrackStates(cfg, all, startRating);
  const finished = after.every((t) => t.completed);

  const completion = finished
    ? {
        completedAt: now,
        tacticalRatingEstimate: after[0]!.estimate.tacticalRatingEstimate,
        uncertainty: after[0]!.estimate.uncertainty,
        // Snapshot evidence with each derived seed.
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
