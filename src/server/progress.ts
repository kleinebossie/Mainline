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

type Db = Pick<
  PrismaClient,
  | "activityEvent"
  | "chessProfileSnapshot"
  | "notificationPref"
  | "programItem"
  | "rewardEvent"
  | "scheduleState"
  | "skillState"
>;

export interface ProgressEvidence {
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
  if (!snapshot.ratings || typeof snapshot.ratings !== "object") return [];
  const out: RatingSeriesPoint[] = [];
  for (const [format, raw] of Object.entries(
    snapshot.ratings as Record<string, unknown>,
  )) {
    if (!raw || typeof raw !== "object") continue;
    const rec = raw as Record<string, unknown>;
    const rating = rec.rating;
    const rd = rec.rd;
    if (
      typeof rating === "number" &&
      Number.isFinite(rating) &&
      typeof rd === "number" &&
      Number.isFinite(rd)
    ) {
      out.push({
        at: snapshot.capturedAt.getTime(),
        platform: snapshot.platform,
        format,
        rating: Math.round(rating),
        rd: Math.round(rd),
      });
    }
  }
  return out;
}

function chooseRatingSeries(
  points: readonly RatingSeriesPoint[],
  cfg: MethodologyConfig,
): RatingSeriesPoint[] {
  const groups = new Map<string, RatingSeriesPoint[]>();
  for (const point of points) {
    const key = `${point.platform}:${point.format}`;
    groups.set(key, [...(groups.get(key) ?? []), point]);
  }

  return [...groups.values()]
    .map((series) => [...series].sort((a, b) => a.at - b.at))
    .sort((a, b) => {
      const latestA = a[a.length - 1]!.at;
      const latestB = b[b.length - 1]!.at;
      if (latestA !== latestB) return latestB - latestA;
      const stableA = a.filter((p) => isStableBaseline(p.rd, cfg)).length;
      const stableB = b.filter((p) => isStableBaseline(p.rd, cfg)).length;
      if (stableA !== stableB) return stableB - stableA;
      return b.length - a.length;
    })[0] ?? [];
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
  ]);

  const minutesLogged = Math.round(
    workEvents.reduce((sum, event) => sum + minutesFromPayload(event.payload), 0),
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

  const ratingSeries = chooseRatingSeries(
    ratingSnapshots.flatMap(ratingSeriesFromSnapshot),
    cfg,
  );
  const ratingHistory: RatingPoint[] = ratingSeries.map((p) => ({
    at: p.at,
    rating: p.rating,
    rd: p.rd,
  }));
  const latestRating = ratingSeries[ratingSeries.length - 1] ?? null;
  const stable = ratingSeries.filter((p) => isStableBaseline(p.rd, cfg));
  const baseline = stable[0] ?? null;
  const latestStable = latestRating
    ? isStableBaseline(latestRating.rd, cfg)
    : false;
  const ciMultiplier = cfg.measurement.ciMultiplier.value;
  const ratingBand = latestRating ? bandForRating(latestRating.rating, cfg) : null;
  const expectation = ratingBand ? expectationForBand(ratingBand, cfg) : null;
  const plateau = detectPlateau({ history: ratingHistory }, cfg);
  const realProgress = isProgressReal({ history: ratingHistory }, cfg);

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
    rating: latestRating
      ? {
          platform: latestRating.platform,
          format: latestRating.format,
          capturedAt: new Date(latestRating.at),
          latestStable,
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
              latestRating.rating,
              latestRating.rd,
              ciMultiplier,
            ),
            rd: latestRating.rd,
          },
          realProgress,
          plateau,
          expectation,
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
