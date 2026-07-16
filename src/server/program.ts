// Program persistence and DTO shaping. Engine and methodology own graded decisions.
// Generation uses an injected clock for reproducibility.

import type { Prisma, PrismaClient } from "@prisma/client";

import {
  bandForRating,
  interpretGameFeatures,
  loadMethodology,
  rationaleFor,
  type MethodologyConfig,
} from "@/methodology";
import { generateProgram, type ProgramItemParams } from "@/engine/generator";
import { systemClock, type Clock } from "@/lib/clock";
import type { RecommendationExposureDraft } from "@/lib/recommendation-exposure";
import {
  rawGameFeaturesSchema,
  type RawGameFeatures,
} from "@/lib/raw-features";
import { lichessThemeUrl, platformPlayUrl } from "@/integrations/catalog";
import { humanizeTheme } from "@/integrations/puzzles/themes";
import { platformLabel } from "@/lib/format-game";
import {
  ratingFromSnapshot,
  playingRatingFromSnapshot,
  highestLiveRatingFromSnapshot,
} from "@/server/assessment";
import {
  getActiveProgram,
  saveProgram,
  type SaveProgramInput,
  type ActiveProgram,
} from "@/db/program";
import { captureOperationalEvent } from "@/server/observability";
import { findRecentPuzzleAttempts } from "@/db/tracker";
import { ensureEndgameDrills } from "@/server/practice";
import { assembleProgramDecisionInput } from "@/server/decision-input";
import { ensureWeeklyFocus } from "@/server/weekly-focus";
import { programWeeklyFocusSnapshotSchema } from "@/lib/weekly-focus";
import {
  refreshForecast,
  type ForecastSource,
} from "@/server/program-forecast";

type Db = Pick<
  PrismaClient,
  | "user"
  | "assessment"
  | "chessProfileSnapshot"
  | "analysisResult"
  | "constraintSet"
  | "resourceRef"
  | "program"
  | "practiceItem"
  | "scheduleState"
  | "activityEvent"
  | "lichessPuzzle"
  | "skillState"
  | "skillStateSnapshot"
  | "trainingPreferenceState"
  | "weeklyFocus"
  | "$transaction"
>;

function comparableParams(raw: unknown): string {
  if (!raw || typeof raw !== "object") return "{}";
  const {
    estMinutes: _estMinutes,
    dueItemRefs: _dueItemRefs,
    count: _count,
    ...rest
  } = raw as Record<string, unknown>;
  void _estMinutes;
  void _dueItemRefs;
  void _count;
  const normalize = (value: unknown): unknown => {
    if (Array.isArray(value)) return value.map(normalize);
    if (value && typeof value === "object") {
      return Object.fromEntries(
        Object.entries(value as Record<string, unknown>)
          .sort(([left], [right]) => left.localeCompare(right))
          .map(([key, nested]) => [key, normalize(nested)]),
      );
    }
    return value;
  };
  return JSON.stringify(normalize(rest));
}

export function preserveUnfinishedActivities<
  T extends {
    activityId: string;
    activityType: string;
    params: ProgramItemParams;
    estMinutes: number;
  },
>(
  generated: readonly T[],
  completed: readonly {
    activityId: string;
    activityType: string;
    params: unknown;
  }[],
): T[] {
  const completedDueRefs = new Set(
    completed.flatMap((item) => {
      const refs = (item.params as { dueItemRefs?: unknown } | null)
        ?.dueItemRefs;
      return Array.isArray(refs)
        ? refs.filter((ref): ref is string => typeof ref === "string")
        : [];
    }),
  );
  const completedCounts = new Map<string, number>();
  for (const item of completed) {
    const key = `${item.activityId}\u0000${item.activityType}\u0000${comparableParams(item.params)}`;
    completedCounts.set(key, (completedCounts.get(key) ?? 0) + 1);
  }
  return generated.flatMap((item) => {
    const dueItemRefs = item.params.dueItemRefs;
    if (dueItemRefs && dueItemRefs.length > 0) {
      const remainingRefs = dueItemRefs.filter(
        (ref) => !completedDueRefs.has(ref),
      );
      if (remainingRefs.length === 0) return [];
      if (remainingRefs.length === dueItemRefs.length) return [item];
      return [
        {
          ...item,
          estMinutes: Math.max(
            1,
            Math.round(
              (item.estMinutes * remainingRefs.length) / dueItemRefs.length,
            ),
          ),
          params: {
            ...item.params,
            dueItemRefs: remainingRefs,
            count: remainingRefs.length,
          },
        },
      ];
    }
    const key = `${item.activityId}\u0000${item.activityType}\u0000${comparableParams(item.params)}`;
    const remaining = completedCounts.get(key) ?? 0;
    if (remaining === 0) return [item];
    completedCounts.set(key, remaining - 1);
    return [];
  });
}

/** Keep the served exposure dose aligned with the final item after replan preservation. */
export function exposureForPersistedItem(item: {
  estMinutes: number;
  exposure: RecommendationExposureDraft;
}): RecommendationExposureDraft {
  return {
    servedRecommendation: {
      ...item.exposure.servedRecommendation,
      allocatedMinutes: item.estMinutes,
    },
    eligibleAlternatives: item.exposure.eligibleAlternatives,
  };
}

function startOfDayUTC(epoch: number): Date {
  const d = new Date(epoch);
  return new Date(
    Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()),
  );
}

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

const themeRefId = (theme: string): string => `lichess_theme_${theme}`;

export interface PreparedProgram {
  saveInput: SaveProgramInput;
  forecastSource: ForecastSource;
}

export async function prepareProgram(
  db: Db,
  userId: string,
  clock: Clock = systemClock,
  preserveCompletedToday = false,
): Promise<PreparedProgram> {
  const cfg = loadMethodology();

  // Seed due endgames before snapshot assembly so they can enter this session.
  const tacticalRatingSeed = await resolveTacticalRating(db, userId, cfg);
  const bandSeed = bandForRating(tacticalRatingSeed, cfg);
  const endgameRecommended = cfg.activities.some(
    (a) =>
      a.activityType === "endgame_drill" &&
      (a.priorityByBand[bandSeed]?.value ?? 0) > 0,
  );
  if (endgameRecommended) {
    await ensureEndgameDrills(db, userId, bandSeed, cfg, clock);
  }

  const { snapshot, generateInput } = await assembleProgramDecisionInput(
    db,
    userId,
    clock,
    cfg,
  );
  const {
    band,
    tacticalRating,
    libraryBand,
    weaknessSignals,
    dueItems,
    constraints,
    recentSuccessByTrack,
  } = generateInput;
  const weeklyFocus = await ensureWeeklyFocus(db, userId, snapshot, cfg);

  const result = generateProgram({
    band,
    tacticalRating,
    libraryBand,
    weaknessSignals,
    focusAreas: weeklyFocus.focusAreas,
    dueItems,
    constraints,
    recentSuccessByTrack,
    clock,
    config: cfg,
  });

  // Replanning keeps closed work on the prior program and regenerates only pending work.
  const completedRows = preserveCompletedToday
    ? await db.program.findFirst({
        where: { userId, status: "active" },
        orderBy: { createdAt: "desc" },
        select: {
          items: {
            where: { status: { in: ["done", "skipped"] } },
            select: { activityId: true, activityType: true, params: true },
          },
        },
      })
    : null;
  const itemsToPersist = preserveUnfinishedActivities(
    result.items,
    completedRows?.items ?? [],
  );

  const wantedRefIds = [
    ...new Set(
      itemsToPersist
        .map((it) => it.resourceTheme)
        .filter((t): t is string => t !== null)
        .map(themeRefId),
    ),
  ];
  const seeded =
    wantedRefIds.length > 0
      ? await db.resourceRef.findMany({
          where: { id: { in: wantedRefIds } },
          select: { id: true },
        })
      : [];
  const seededIds = new Set(seeded.map((r) => r.id));

  // Persist the validated snapshot exactly; the schema is strict.
  const generationInput = {
    ...snapshot,
    weeklyFocus: programWeeklyFocusSnapshotSchema.parse(weeklyFocus),
  } as unknown as Prisma.InputJsonValue;

  const saveInput: SaveProgramInput = {
    userId,
    methodologyVersion: cfg.version,
    generationInput,
    date: startOfDayUTC(result.generatedAt),
    exposedAt: new Date(result.generatedAt),
    items: itemsToPersist.map((it) => ({
      orderIndex: it.orderIndex,
      activityId: it.activityId,
      activityType: it.activityType,
      resourceRefId:
        it.resourceTheme && seededIds.has(themeRefId(it.resourceTheme))
          ? themeRefId(it.resourceTheme)
          : null,
      // Display-only packing input stored with the item parameters.
      params: {
        ...it.params,
        estMinutes: it.estMinutes,
      } as unknown as Prisma.InputJsonValue,
      dimensionsTargeted: it.dimensionsTargeted,
      rationaleKey: it.rationaleKey,
      rationaleText: it.rationaleText,
      evidenceGrade: it.evidenceGrade,
      evidenceTier: it.evidenceTier,
      citationKey: it.citationKey,
      confidence: it.confidence,
      soften: it.soften,
      exposure: exposureForPersistedItem(it),
    })),
  };
  return {
    saveInput,
    forecastSource: {
      methodologyVersion: cfg.version,
      generationInput,
      items: saveInput.items.map((item) => ({
        activityId: item.activityId,
        activityType: item.activityType,
        params: item.params,
        dimensionsTargeted: item.dimensionsTargeted,
        rationaleKey: item.rationaleKey,
        rationaleText: item.rationaleText,
        evidenceGrade: item.evidenceGrade,
        evidenceTier: item.evidenceTier,
        citationKey: item.citationKey,
        confidence: item.confidence,
        soften: item.soften,
      })),
    },
  };
}

export async function generateAndSaveProgram(
  db: Db,
  userId: string,
  clock: Clock = systemClock,
  options: {
    preserveCompletedToday?: boolean;
    preventStartedReplacement?: boolean;
    reuseExistingDate?: boolean;
    forecast?: {
      trigger: string;
      preserveCommittedToday: boolean;
    };
  } = {},
): Promise<{ programId: string; reusedStartedProgram: boolean }> {
  const prepared = await prepareProgram(
    db,
    userId,
    clock,
    options.preserveCompletedToday ?? false,
  );
  const saved = await saveProgram(db, prepared.saveInput, {
    preventStartedReplacement: options.preventStartedReplacement ?? false,
    reuseExistingDate: options.reuseExistingDate ?? false,
    afterSave: options.forecast
      ? async (tx) => {
          await refreshForecast(
            tx,
            userId,
            clock,
            options.forecast!.trigger,
            options.forecast!.preserveCommittedToday,
            prepared.forecastSource,
          );
        }
      : undefined,
  });
  const programId = saved.programId;
  captureOperationalEvent({
    operation: "program_generation",
    status: "success",
    count: saved.reusedStartedProgram ? 0 : prepared.saveInput.items.length,
  });
  return { programId, reusedStartedProgram: saved.reusedStartedProgram };
}

export interface TodayItem {
  id: string;
  orderIndex: number;
  label: string;
  activityType: string;
  dimensionLabels: string[];
  estMinutes: number | null;
  params: Omit<ProgramItemParams, "dueItemRefs">;
  /** Display tags only; raw due references remain private. */
  reviewThemes: string[];
  externalUrl: string | null;
  externalLabel: string | null;
  url: string | null;
  delivery: "internal" | "external";
  bookResource: ProgramItemParams["bookResource"] | null;
  rationaleText: string;
  evidenceGrade: string;
  evidenceTier: number;
  citationKey: string;
  citationSource: string | null;
  confidence: string;
  soften: boolean;
  status: string;
}

export interface HonestyEvidence {
  evidenceGrade: string;
  evidenceTier: number;
  citationKey: string;
  citationSource: string | null;
  confidence: string;
  soften: boolean;
  flag?: string;
}

export interface TodayProgram {
  id: string;
  createdAt: Date;
  scheduledDate: Date;
  methodologyVersion: string;
  honesty: {
    expectations: string;
    processGoal: string;
    expectationsEvidence: HonestyEvidence;
    processGoalEvidence: HonestyEvidence;
  };
  items: TodayItem[];
}

function paramsOf(raw: unknown): ProgramItemParams & { estMinutes?: number } {
  if (raw && typeof raw === "object") {
    return raw as ProgramItemParams & { estMinutes?: number };
  }
  return { theme: null, track: null };
}

function publicParams(
  params: ProgramItemParams & { estMinutes?: number },
  theme: string | null,
): Omit<ProgramItemParams, "dueItemRefs"> {
  const publicFacing = { ...params };
  delete publicFacing.dueItemRefs;
  return { ...publicFacing, theme };
}

const REVIEW_THEME_DISPLAY_LIMIT = 3;

function rankedReviewThemes(
  puzzleThemes: readonly (readonly string[])[],
  fallbackTheme: string | null,
): string[] {
  const counts = new Map<string, { count: number; firstSeen: number }>();
  let firstSeen = 0;
  for (const themes of puzzleThemes) {
    for (const theme of themes) {
      const existing = counts.get(theme);
      if (existing) {
        existing.count += 1;
      } else {
        counts.set(theme, { count: 1, firstSeen });
        firstSeen += 1;
      }
    }
  }
  if (counts.size === 0 && fallbackTheme) {
    counts.set(fallbackTheme, { count: 1, firstSeen: 0 });
  }
  return [...counts.entries()]
    .sort((a, b) => b[1].count - a[1].count || a[1].firstSeen - b[1].firstSeen)
    .slice(0, REVIEW_THEME_DISPLAY_LIMIT)
    .map(([theme]) => humanizeTheme(theme));
}

async function reviewThemesByItemId(
  db: Db,
  items: readonly ActiveProgram["items"][number][],
): Promise<Map<string, string[]>> {
  const reviewItems = items.filter(
    (item) => item.activityType === "spaced_review",
  );
  const refs = [
    ...new Set(
      reviewItems.flatMap((item) => {
        const dueItemRefs = paramsOf(item.params).dueItemRefs ?? [];
        return dueItemRefs.filter((ref) => typeof ref === "string");
      }),
    ),
  ];
  const puzzles =
    refs.length > 0
      ? await db.lichessPuzzle.findMany({
          where: { puzzleId: { in: refs } },
          select: { puzzleId: true, themes: true },
        })
      : [];
  const puzzleById = new Map(puzzles.map((p) => [p.puzzleId, p]));

  return new Map(
    reviewItems.map((item) => {
      const params = paramsOf(item.params);
      const dueItemRefs = params.dueItemRefs ?? [];
      const puzzleThemes = dueItemRefs
        .map((ref) => puzzleById.get(ref)?.themes)
        .filter((themes): themes is string[] => Array.isArray(themes));
      return [item.id, rankedReviewThemes(puzzleThemes, params.theme ?? null)];
    }),
  );
}

function internalActivityUrl(
  activityType: string,
  programItemId: string,
): string | null {
  if (activityType === "analyse") return "/analysis";
  if (
    activityType === "puzzle_theme" ||
    activityType === "spaced_review" ||
    activityType === "blunder_drill" ||
    activityType === "endgame_drill"
  ) {
    return `/train/${programItemId}`;
  }
  return null;
}

export function toTodayItem(
  item: ActiveProgram["items"][number],
  cfg: MethodologyConfig,
  dimLabels: Map<string, string>,
  ledger: Map<string, string>,
  primaryPlatform: string | null,
  reviewThemes: readonly string[] = [],
): TodayItem {
  const params = paramsOf(item.params);
  const def = cfg.activities.find((a) => a.id === item.activityId);
  const theme = params.theme ?? null;
  const delivery =
    params.bookResource || item.activityType === "book"
      ? "external"
      : def?.delivery?.value === "internal"
        ? "internal"
        : "external";
  const isPlayGame = item.activityType === "play_game";
  const externalUrl = isPlayGame
    ? platformPlayUrl(primaryPlatform)
    : (item.resourceRef?.externalUrl ??
      (theme ? lichessThemeUrl(theme) : null));
  const externalLabel = isPlayGame
    ? `Play on ${platformLabel(primaryPlatform)} ↗`
    : externalUrl
      ? "Open on Lichess ↗"
      : null;
  const url =
    delivery === "internal"
      ? internalActivityUrl(item.activityType, item.id)
      : externalUrl;
  return {
    id: item.id,
    orderIndex: item.orderIndex,
    label: params.bookResource
      ? `Study ${params.bookResource.title}`
      : (def?.label ?? item.activityId),
    activityType: item.activityType,
    dimensionLabels: item.dimensionsTargeted.map((d) => dimLabels.get(d) ?? d),
    estMinutes:
      typeof params.estMinutes === "number" ? params.estMinutes : null,
    params: publicParams(params, theme),
    reviewThemes: [...reviewThemes],
    externalUrl,
    externalLabel,
    url,
    delivery,
    bookResource: params.bookResource ?? null,
    rationaleText: item.rationaleText,
    evidenceGrade: item.evidenceGrade,
    evidenceTier: item.evidenceTier,
    citationKey: item.citationKey,
    citationSource: ledger.get(item.citationKey) ?? null,
    confidence: item.confidence,
    soften: item.soften,
    status: item.status,
  };
}

export interface GameSignal {
  dimension: string;
  dimensionLabel: string;
  /** Normalized amount above the band threshold. */
  severity: number;
  confidence: string;
  sampleSize: number;
  evidenceGrade: string;
  evidenceTier: number;
  citationKey: string;
  citationSource: string | null;
  rationaleText: string;
  soften: boolean;
}

export interface GameSignalsResult {
  gamesAnalysed: number;
  signals: GameSignal[];
}

export async function getGameSignals(
  db: Db,
  userId: string,
): Promise<GameSignalsResult> {
  const cfg = loadMethodology();
  const tacticalRating = await resolveTacticalRating(db, userId, cfg);
  const band = bandForRating(tacticalRating, cfg);
  const features = await gatherFeatures(db, userId);
  const signals = interpretGameFeatures({ features, band }, cfg);

  const dimLabels = new Map(cfg.dimensions.map((d) => [d.id, d.label]));
  const ledger = new Map(cfg.evidenceLedger.map((a) => [a.key, a.source]));

  return {
    gamesAnalysed: features.length,
    signals: signals.map((s): GameSignal => {
      const r = rationaleFor(s.rationaleKey, cfg);
      return {
        dimension: s.dimension,
        dimensionLabel: dimLabels.get(s.dimension) ?? s.dimension,
        severity: s.severity,
        confidence: s.confidence,
        sampleSize: s.sampleSize,
        evidenceGrade: s.evidenceGrade,
        evidenceTier: s.evidenceTier,
        citationKey: s.citationKey,
        citationSource: ledger.get(s.citationKey) ?? null,
        rationaleText: r.value,
        soften: r.soften,
      };
    }),
  };
}

export async function getTodayProgram(
  db: Db,
  userId: string,
  methodologyLoader: (version?: string) => MethodologyConfig = loadMethodology,
): Promise<TodayProgram | null> {
  const program = await getActiveProgram(db, userId);
  if (!program) return null;
  const cfg = methodologyLoader(program.methodologyVersion);

  const user = await db.user.findUnique({
    where: { id: userId },
    select: { primaryPlatform: true },
  });
  const primaryPlatform = user?.primaryPlatform ?? null;

  const dimLabels = new Map(cfg.dimensions.map((d) => [d.id, d.label]));
  const ledger = new Map(cfg.evidenceLedger.map((a) => [a.key, a.source]));
  const reviewThemes = await reviewThemesByItemId(db, program.items);

  const expectationsRationale = rationaleFor("expectations", cfg);
  const processGoalRationale = rationaleFor("process_goal", cfg);

  return {
    id: program.id,
    createdAt: program.createdAt,
    scheduledDate:
      program.items[0]?.date ?? startOfDayUTC(program.createdAt.getTime()),
    methodologyVersion: program.methodologyVersion,
    honesty: {
      expectations: expectationsRationale.value,
      processGoal: processGoalRationale.value,
      expectationsEvidence: {
        evidenceGrade: expectationsRationale.grade,
        evidenceTier: expectationsRationale.tier,
        citationKey: expectationsRationale.citationKey,
        citationSource: ledger.get(expectationsRationale.citationKey) ?? null,
        confidence: "low",
        soften: expectationsRationale.soften,
        flag: expectationsRationale.flag,
      },
      processGoalEvidence: {
        evidenceGrade: processGoalRationale.grade,
        evidenceTier: processGoalRationale.tier,
        citationKey: processGoalRationale.citationKey,
        citationSource: ledger.get(processGoalRationale.citationKey) ?? null,
        confidence: "low",
        soften: processGoalRationale.soften,
        flag: processGoalRationale.flag,
      },
    },
    items: program.items.map((it) =>
      toTodayItem(
        it,
        cfg,
        dimLabels,
        ledger,
        primaryPlatform,
        reviewThemes.get(it.id) ?? [],
      ),
    ),
  };
}
