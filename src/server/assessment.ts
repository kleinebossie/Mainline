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
import { resolveCalibrationSeedRating } from "@/lib/rating-snapshot";
import { formatPrefsSchema } from "@/lib/constraints";




type Db = Pick<
  PrismaClient,
  | "assessment"
  | "chessProfileSnapshot"
  | "lichessPuzzle"
  | "constraintSet"
  | "platformConnection"
>;

// Legacy single-track responses have no track and belong to the first configured track.
const calibrationResponseSchema = z.object({
  track: z.string().min(1).optional(),
  ratingShown: z.number().int(),
  correct: z.boolean(),
  puzzleId: z.string().optional(),
});
type StoredResponse = z.infer<typeof calibrationResponseSchema>;

export interface GuestConnectionInfo {
  platform: "lichess" | "chesscom";
  externalUsername?: string;
  ratings?: Record<string, { rating?: number; rd?: number; games?: number }>;
}

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
): Promise<{ startRating: number; hasConnectedAccount: boolean }> {
  const [connections, snapshots, constraintRow] = await Promise.all([
    db.platformConnection.findMany({
      where: { userId, status: "active" },
      select: { platform: true },
    }),
    db.chessProfileSnapshot.findMany({
      where: { userId },
      orderBy: { capturedAt: "desc" },
      select: { platform: true, ratings: true },
    }),
    db.constraintSet.findFirst({
      where: { userId, isCurrent: true },
      orderBy: { version: "desc" },
      select: { formatPrefs: true },
    }),
  ]);

  const hasConnectedAccount = connections.length > 0;
  const lichessSnap = snapshots.find((s) => s.platform === "lichess");
  const chesscomSnap = snapshots.find((s) => s.platform === "chesscom");

  let primaryFormat: string | null = null;
  const parsedPrefs = formatPrefsSchema.safeParse(constraintRow?.formatPrefs);
  if (parsedPrefs.success && parsedPrefs.data.formats.length > 0) {
    primaryFormat = parsedPrefs.data.formats[0] ?? null;
  }

  const startRating = resolveCalibrationSeedRating({
    lichessRatings: lichessSnap?.ratings,
    chesscomRatings: chesscomSnap?.ratings,
    primaryFormat,
    defaultStartRating: cfg.assessment.calibration.startRating.value,
  });

  return { startRating, hasConnectedAccount };
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
  locked?: boolean;
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
  const { startRating, hasConnectedAccount } = await resolveStartRating(
    db,
    userId,
    cfg,
  );

  const trackStates = buildTrackStates(cfg, all, startRating);
  const primary = trackStates[0]!;
  const activeTrackIndex = trackStates.findIndex((t) => !t.completed);
  const activeTrack =
    activeTrackIndex >= 0 ? trackStates[activeTrackIndex]! : null;

  let activePuzzle: LichessPuzzle | null = null;
  if (activeTrack && !activeTrack.completed && hasConnectedAccount) {
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
    locked: !hasConnectedAccount,
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
  const { startRating, hasConnectedAccount } = await resolveStartRating(
    db,
    userId,
    cfg,
  );

  if (!hasConnectedAccount) {
    throw expectedError.badRequest(
      "Connect a chess account before completing calibration.",
    );
  }

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

/** Pure deterministic calibration state resolution for guest sessions. */
export async function getGuestCalibrationState(
  db: Pick<PrismaClient, "lichessPuzzle">,
  storedResponses: StoredResponse[] = [],
  guestConnections: GuestConnectionInfo[] = [],
  primaryFormat?: string | null,
): Promise<CalibrationState & { guestResponses: StoredResponse[] }> {
  const cfg = loadMethodology();
  const hasConnectedAccount = guestConnections.length > 0;

  const lichessConn = guestConnections.find((c) => c.platform === "lichess");
  const chesscomConn = guestConnections.find((c) => c.platform === "chesscom");

  const startRating = resolveCalibrationSeedRating({
    lichessRatings: lichessConn?.ratings,
    chesscomRatings: chesscomConn?.ratings,
    primaryFormat,
    defaultStartRating: cfg.assessment.calibration.startRating.value,
  });

  const trackStates = buildTrackStates(cfg, storedResponses, startRating);
  const primary = trackStates[0]!;
  const activeTrackIndex = trackStates.findIndex((t) => !t.completed);
  const activeTrack =
    activeTrackIndex >= 0 ? trackStates[activeTrackIndex]! : null;

  let activePuzzle: LichessPuzzle | null = null;
  if (activeTrack && !activeTrack.completed && hasConnectedAccount) {
    const excludePuzzleIds = storedResponses
      .map((r) => r.puzzleId)
      .filter((id): id is string => !!id);

    const puzzles = await selectPuzzles(db, {
      theme: activeTrack.theme,
      ratingTarget: activeTrack.next.ratingTarget,
      count: 10,
      excludePuzzleIds,
    });

    if (puzzles.length > 0) {
      const seedStr = "guest" + activeTrack.id + activeTrack.next.itemNumber;
      let hash = 0;
      for (let i = 0; i < seedStr.length; i++) {
        hash = seedStr.charCodeAt(i) + ((hash << 5) - hash);
      }
      const idx = Math.abs(hash) % puzzles.length;
      activePuzzle = puzzles[idx] ?? null;
    }
  }

  const affordances = interfaceAffordancesFor(
    { band: bandForRating(startRating, cfg), targetFocus: "online" },
    cfg,
  );
  const restrictionRationale = affordances.restricted
    ? rationaleFor(affordances.restrictionRationaleKey, cfg)
    : null;

  const isCompleted = trackStates.every((t) => t.completed);

  return {
    completed: isCompleted,
    locked: !hasConnectedAccount,
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
    guestResponses: storedResponses,
  };
}

/** Record a calibration response for a guest session and return refreshed state. */
export async function applyGuestCalibrationResponse(
  db: Pick<PrismaClient, "lichessPuzzle">,
  input: {
    ratingShown: number;
    correct: boolean;
    puzzleId?: string;
    guestResponses?: StoredResponse[];
    guestConnections?: GuestConnectionInfo[];
    primaryFormat?: string | null;
  },
): Promise<CalibrationState & { guestResponses: StoredResponse[] }> {
  const prev = input.guestResponses ?? [];
  const cfg = loadMethodology();
  const guestConnections = input.guestConnections ?? [];

  if (guestConnections.length === 0) {
    throw expectedError.badRequest(
      "Connect a chess account before completing calibration.",
    );
  }

  const lichessConn = guestConnections.find((c) => c.platform === "lichess");
  const chesscomConn = guestConnections.find((c) => c.platform === "chesscom");

  const startRating = resolveCalibrationSeedRating({
    lichessRatings: lichessConn?.ratings,
    chesscomRatings: chesscomConn?.ratings,
    primaryFormat: input.primaryFormat,
    defaultStartRating: cfg.assessment.calibration.startRating.value,
  });

  const states = buildTrackStates(cfg, prev, startRating);
  const active = states.find((t) => !t.completed) ?? null;

  const updatedResponses: StoredResponse[] =
    active == null
      ? prev
      : [
          ...prev,
          {
            track: active.id,
            ratingShown: input.ratingShown,
            correct: input.correct,
            puzzleId: input.puzzleId,
          },
        ];

  return getGuestCalibrationState(
    db,
    updatedResponses,
    guestConnections,
    input.primaryFormat,
  );
}

