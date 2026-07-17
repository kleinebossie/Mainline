// Progress dashboard orchestration. This is a process-signal surface, not a rating-results
// surface: the methodology supplies the evidence-graded copy and thresholds; this module
// only rolls up persisted facts for display (L1).

import type { PrismaClient } from "@prisma/client";

import {
  bandForRating,
  detectPlateau,
  expectationForBand,
  isProgressReal,
  isStableBaseline,
  loadMethodology,
  rationaleFor,
  type MethodologyConfig,
  type RatingPoint,
} from "@/methodology";
import { glickoConfidenceInterval } from "@/engine/math/glicko";
import { getEngagementSummary } from "@/server/engagement";
import { DAY_MS, systemClock, type Clock } from "@/lib/clock";
import { activityEventPayloadSchema } from "@/lib/tracker";
import { CHESS_FORMATS, formatPrefsSchema } from "@/lib/constraints";
import { platformLabel } from "@/lib/format-game";
import { ratingEntriesFromSnapshot } from "@/lib/rating-snapshot";

type Db = Pick<
  PrismaClient,
  | "activityEvent"
  | "chessProfileSnapshot"
  | "constraintSet"
  | "notificationPref"
  | "programItem"
  | "rewardEvent"
  | "scheduleState"
  | "skillState"
  | "user"
>;

interface ProgressEvidence {
  text: string;
  evidenceGrade: string;
  evidenceTier: number;
  citationKey: string;
  citationSource: string | null;
  soften: boolean;
}

interface RatingSeriesPoint extends RatingPoint {
  platform: string;
  format: string;
}

interface RatingFormatSignal {
  format: string;
  label: string;
  capturedAt: Date;
  latestStable: boolean;
  baseline: {
    capturedAt: Date;
    range: { lower: number; upper: number };
  } | null;
  latest: {
    range: { lower: number; upper: number };
    rd: number;
  };
  realProgress: boolean;
  plateau: { reason: "plateau" | "new_high" | "insufficient" };
  expectation: { text: string } | null;
}

function ledgerMap(cfg: MethodologyConfig): Map<string, string> {
  return new Map(cfg.evidenceLedger.map((a) => [a.key, a.source]));
}

function evidenceFor(key: string, cfg: MethodologyConfig): ProgressEvidence {
  const r = rationaleFor(key, cfg);
  const ledger = ledgerMap(cfg);
  return {
    text: r.value,
    evidenceGrade: r.grade,
    evidenceTier: r.tier,
    citationKey: r.citationKey,
    citationSource: ledger.get(r.citationKey) ?? null,
    soften: r.soften,
  };
}

function ratingSeriesFromSnapshot(snapshot: {
  platform: string;
  capturedAt: Date;
  ratings: unknown;
}): RatingSeriesPoint[] {
  return ratingEntriesFromSnapshot(snapshot.ratings).flatMap((entry) =>
    entry.rd === null
      ? []
      : [
          {
            at: snapshot.capturedAt.getTime(),
            platform: snapshot.platform,
            format: entry.format,
            rating: entry.rating,
            rd: entry.rd,
          },
        ],
  );
}

function minutesFromPayload(payload: unknown): number {
  const parsed = activityEventPayloadSchema.safeParse(payload);
  if (!parsed.success) return 0;
  if (typeof parsed.data.durationMin === "number") {
    return parsed.data.durationMin;
  }
  if (typeof parsed.data.solveTimeMs === "number") {
    return parsed.data.solveTimeMs / 60_000;
  }
  return 0;
}

export async function getProgressSummary(
  db: Db,
  userId: string,
  clock: Clock = systemClock,
) {
  const cfg = loadMethodology();
  const now = clock.now();
  const workWindowDays = cfg.engagement.streakCapDays.value;
  const workWindowStart = new Date(now - workWindowDays * DAY_MS);
  const nowDate = new Date(now);

  const [
    engagement,
    completedBlocks,
    skippedBlocks,
    workEvents,
    dueStates,
    skillStates,
    ratingSnapshots,
    userRow,
    constraintRow,
  ] = await Promise.all([
    getEngagementSummary(db, userId, clock),
    db.programItem.count({
      where: {
        program: { userId },
        status: "done",
        updatedAt: { gte: workWindowStart },
      },
    }),
    db.programItem.count({
      where: {
        program: { userId },
        status: "skipped",
        updatedAt: { gte: workWindowStart },
      },
    }),
    db.activityEvent.findMany({
      where: {
        userId,
        occurredAt: { gte: workWindowStart },
        NOT: { type: "skip" },
      },
      select: { payload: true },
    }),
    db.scheduleState.findMany({
      where: { userId, due: { lte: nowDate } },
      select: { itemType: true, due: true },
      orderBy: { due: "asc" },
    }),
    db.skillState.findMany({
      where: { userId },
      select: {
        dimension: true,
        estimate: true,
        uncertainty: true,
        sampleSize: true,
      },
      orderBy: { dimension: "asc" },
    }),
    db.chessProfileSnapshot.findMany({
      where: { userId },
      select: { platform: true, capturedAt: true, ratings: true },
      orderBy: { capturedAt: "asc" },
    }),
    db.user.findUnique({
      where: { id: userId },
      select: { primaryPlatform: true },
    }),
    db.constraintSet.findFirst({
      where: { userId, isCurrent: true },
      orderBy: { version: "desc" },
      select: { formatPrefs: true },
    }),
  ]);

  const minutesLogged = Math.round(
    workEvents.reduce(
      (sum, event) => sum + minutesFromPayload(event.payload),
      0,
    ),
  );

  const reviewTypes = dueStates.reduce<Record<string, number>>((acc, row) => {
    acc[row.itemType] = (acc[row.itemType] ?? 0) + 1;
    return acc;
  }, {});

  const dimensionLabels = new Map(cfg.dimensions.map((d) => [d.id, d.label]));
  const skillSignals = skillStates.map((state) => ({
    dimension: state.dimension,
    label: dimensionLabels.get(state.dimension) ?? state.dimension,
    estimate: state.estimate,
    uncertainty: state.uncertainty,
    sampleSize: state.sampleSize,
  }));

  // --- Resolve primary platform ---
  const explicitPlatform = userRow?.primaryPlatform ?? null;

  // --- Resolve format preferences from current constraint set ---
  let resolvedFormats: string[] = [];
  let formatsSet = false;
  if (constraintRow) {
    const parsed = formatPrefsSchema.safeParse(constraintRow.formatPrefs);
    if (parsed.success && parsed.data.formats.length > 0) {
      resolvedFormats = parsed.data.formats;
      formatsSet = true;
    }
  }
  if (resolvedFormats.length === 0) {
    resolvedFormats = [...CHESS_FORMATS];
  }

  // --- Determine the platform to use ---
  let resolvedPlatform: string;
  let platformSet: boolean;
  if (explicitPlatform) {
    resolvedPlatform = explicitPlatform;
    platformSet = true;
  } else if (ratingSnapshots.length > 0) {
    // Use the platform of the most recent snapshot
    const sorted = [...ratingSnapshots].sort(
      (a, b) => b.capturedAt.getTime() - a.capturedAt.getTime(),
    );
    resolvedPlatform = sorted[0]!.platform;
    platformSet = false;
  } else {
    // No snapshots at all; fall back
    resolvedPlatform = "lichess";
    platformSet = false;
  }

  // Filter out classical for Chess.com
  if (resolvedPlatform === "chesscom") {
    resolvedFormats = resolvedFormats.filter((f) => f !== "classical");
  }

  // --- Gather all rating points (existing extraction) ---
  const allPoints = ratingSnapshots.flatMap(ratingSeriesFromSnapshot);
  const ciMultiplier = cfg.measurement.ciMultiplier.value;

  // --- Per-format rating signals ---
  const formatSignals: RatingFormatSignal[] = [];
  for (const format of resolvedFormats) {
    const formatPoints: RatingPoint[] = allPoints
      .filter((p) => p.platform === resolvedPlatform && p.format === format)
      .map((p) => ({ at: p.at, rating: p.rating, rd: p.rd }))
      .sort((a, b) => a.at - b.at);

    if (formatPoints.length === 0) continue;

    const latestPoint = formatPoints[formatPoints.length - 1]!;
    const stable = formatPoints.filter((p) => isStableBaseline(p.rd, cfg));
    const baseline = stable[0] ?? null;
    const latestStableFlag = isStableBaseline(latestPoint.rd, cfg);
    const plateau = detectPlateau({ history: formatPoints }, cfg);
    const realProgress = isProgressReal({ history: formatPoints }, cfg);
    const band = bandForRating(latestPoint.rating, cfg);
    const expectation = expectationForBand(band, cfg);

    formatSignals.push({
      format,
      label: format.charAt(0).toUpperCase() + format.slice(1),
      capturedAt: new Date(latestPoint.at),
      latestStable: latestStableFlag,
      baseline: baseline
        ? {
            capturedAt: new Date(baseline.at),
            range: glickoConfidenceInterval(
              baseline.rating,
              baseline.rd,
              ciMultiplier,
            ),
          }
        : null,
      latest: {
        range: glickoConfidenceInterval(
          latestPoint.rating,
          latestPoint.rd,
          ciMultiplier,
        ),
        rd: latestPoint.rd,
      },
      realProgress,
      plateau: { reason: plateau.reason },
      expectation: { text: expectation.text },
    });
  }

  const hasAnySnapshot = ratingSnapshots.length > 0;

  return {
    methodologyVersion: cfg.version,
    evidence: {
      progressSurface: evidenceFor("progress_surface", cfg),
      processGoal: evidenceFor("process_goal", cfg),
      consistency: evidenceFor("consistency_grid", cfg),
      review: evidenceFor("redo_failed", cfg),
      skill: evidenceFor("skill_update", cfg),
      expectations: evidenceFor("expectations", cfg),
      ratingNoise: evidenceFor("rating_noise", cfg),
    },
    consistency: {
      streak: engagement.streak,
      grid: engagement.grid,
    },
    work: {
      windowDays: workWindowDays,
      completedBlocks,
      skippedBlocks,
      minutesLogged,
    },
    reviews: {
      dueCount: dueStates.length,
      oldestDue: dueStates[0]?.due ?? null,
      itemTypes: reviewTypes,
    },
    skills: skillSignals,
    rating: hasAnySnapshot
      ? {
          platform: resolvedPlatform,
          platformLabel: platformLabel(resolvedPlatform),
          platformSet,
          formatsSet,
          formats: formatSignals,
          ciMultiplier,
          ciEvidence: {
            evidenceGrade: cfg.measurement.ciMultiplier.grade,
            evidenceTier: cfg.measurement.ciMultiplier.tier,
            citationKey: cfg.measurement.ciMultiplier.citationKey,
            citationSource:
              ledgerMap(cfg).get(cfg.measurement.ciMultiplier.citationKey) ??
              null,
          },
        }
      : null,
  };
}
