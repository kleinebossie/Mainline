// Rating resolution and game-feature gathering from persisted data. Extracted from
// program.ts to break the program <-> decision-input import cycle. This is a leaf read
// module: no imports from program.ts or decision-input.ts, so both can depend on it
// without creating a cycle.

import type { PrismaClient } from "@prisma/client";

import { type MethodologyConfig } from "@/methodology";
import {
  ratingFromSnapshot,
  playingRatingFromSnapshot,
  highestLiveRatingFromSnapshot,
} from "@/server/assessment";
import {
  rawGameFeaturesSchema,
  type RawGameFeatures,
} from "@/lib/raw-features";
import { findRecentPuzzleAttempts } from "@/db/tracker";

type Db = Pick<
  PrismaClient,
  | "assessment"
  | "chessProfileSnapshot"
  | "user"
  | "analysisResult"
  | "activityEvent"
>;

/** Prefer behavioral calibration when choosing puzzle difficulty. */
export async function resolveTacticalRating(
  db: Db,
  userId: string,
  cfg: MethodologyConfig,
): Promise<number> {
  const a = await db.assessment.findUnique({
    where: { userId },
    select: { tacticalRatingEstimate: true },
  });
  if (a?.tacticalRatingEstimate != null) return a.tacticalRatingEstimate;
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

/** Use playing strength for analysis bands, never puzzle rating. */
export async function resolvePlayingRating(
  db: Db,
  userId: string,
  cfg: MethodologyConfig,
  gameRating?: number | null,
): Promise<number> {
  if (gameRating != null && Number.isFinite(gameRating)) return gameRating;
  const snap = await db.chessProfileSnapshot.findFirst({
    where: { userId },
    orderBy: { capturedAt: "desc" },
    select: { ratings: true },
  });
  return (
    playingRatingFromSnapshot(snap?.ratings) ??
    (await resolveTacticalRating(db, userId, cfg))
  );
}

/** Use the highest live-game rating on the primary platform for library bands. */
export async function resolveLibraryRating(
  db: Db,
  userId: string,
  cfg: MethodologyConfig,
): Promise<number> {
  const user = await db.user.findUnique({
    where: { id: userId },
    select: { primaryPlatform: true },
  });
  const snap = await db.chessProfileSnapshot.findFirst({
    where: user?.primaryPlatform
      ? { userId, platform: user.primaryPlatform }
      : { userId },
    orderBy: { capturedAt: "desc" },
    select: { ratings: true },
  });
  return (
    highestLiveRatingFromSnapshot(snap?.ratings) ??
    (await resolveTacticalRating(db, userId, cfg))
  );
}

export async function gatherFeatures(
  db: Db,
  userId: string,
): Promise<RawGameFeatures[]> {
  const rows = await db.analysisResult.findMany({
    where: { game: { userId } },
    select: { rawFeatures: true },
    orderBy: { analyzedAt: "desc" },
  });
  const features: RawGameFeatures[] = [];
  for (const row of rows) {
    const parsed = rawGameFeaturesSchema.safeParse(row.rawFeatures);
    if (parsed.success) features.push(parsed.data);
  }
  return features;
}

/** Raw recent success rates by puzzle track. */
export async function gatherRecentSuccessByTrack(
  db: Db,
  userId: string,
): Promise<{ pattern?: number; calculation?: number }> {
  const rows = await findRecentPuzzleAttempts(db, userId, 50);
  const agg: Record<"pattern" | "calculation", { s: number; n: number }> = {
    pattern: { s: 0, n: 0 },
    calculation: { s: 0, n: 0 },
  };
  for (const row of rows) {
    const params = (row.programItem?.params ?? null) as {
      track?: unknown;
    } | null;
    const track = params?.track;
    if (track !== "pattern" && track !== "calculation") continue;
    const correct = (row.payload as { correct?: unknown } | null)?.correct;
    if (typeof correct !== "boolean") continue;
    agg[track].n += 1;
    if (correct) agg[track].s += 1;
  }
  const out: { pattern?: number; calculation?: number } = {};
  if (agg.pattern.n > 0) out.pattern = agg.pattern.s / agg.pattern.n;
  if (agg.calculation.n > 0)
    out.calculation = agg.calculation.s / agg.calculation.n;
  return out;
}
