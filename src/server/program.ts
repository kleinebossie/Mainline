// Program orchestration (BUILD.md M6 · §7.1). The graded DECISIONS live in the pure
// generator + provider functions; this module only gathers DB state, calls them, and
// persists/reads the result (L1: server orchestrates, it does not decide). The injected
// Clock keeps generation reproducible (L2) — the router passes the system clock; tests
// pass a fixed one.

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
import { getCurrentConstraints } from "@/server/constraints";
import {
  getActiveProgram,
  saveProgram,
  type ActiveProgram,
} from "@/db/program";
import { findDueScheduleStates, findRecentPuzzleAttempts } from "@/db/tracker";
import { ensureEndgameDrills } from "@/server/practice";
import { EMPTY_CONSTRAINTS } from "@/lib/constraints";

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
  | "$transaction"
>;

/** Start-of-day (UTC) for an epoch — the day a generated session belongs to. */
function startOfDayUTC(epoch: number): Date {
  const d = new Date(epoch);
  return new Date(
    Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()),
  );
}

/** The rating that drives Seam-5 difficulty: the behavioural calibration estimate first,
 *  then a platform puzzle/rapid rating, else the config's no-data start (Seam 2 rule). */
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

/** The rating that drives the GAME-ANALYSIS band (the "bad move" / RPL cp thresholds): the
 *  user's PLAYING strength, NOT their puzzle rating. Prefers the rating they actually had in
 *  THIS game (`gameRating`), then a recent playing-format snapshot, then falls back to the
 *  tactical/calibration estimate. (`resolveTacticalRating`, which leans on the inflated
 *  puzzle rating, still seeds Seam-5 puzzle DIFFICULTY — only the analysis band differs, so
 *  a 930-rapid player lands in 800–1200 (200cp) instead of 1600–2000 (50cp).) */
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

/** The rating that drives book-catalog BAND selection (Seam 4 §4.2): the user's highest
 *  actual live-game rating (bullet/blitz/rapid — never puzzle) on their PRIMARY platform.
 *  Puzzle rating runs far above playing strength (`resolveTacticalRating`'s job is puzzle
 *  DIFFICULTY, not this), and the catalog is pitched at playing strength. Falls back to the
 *  tactical estimate when the user has no live-game rating on record. */
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

/** All client-computed raw features for the user's analysed games (defensively parsed). */
async function gatherFeatures(
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

/** Rolling success rate per Seam-5 track from recent puzzle-attempt outcomes (servo input,
 *  M7). Plumbing only — the servo decision lives in targetPuzzleRating (Seam 5). */
async function gatherRecentSuccessByTrack(
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

/**
 * Generate today's program from current state and persist it (superseding any prior active
 * program). Pure decisions inside generateProgram; everything here is plumbing.
 */
export async function generateAndSaveProgram(
  db: Db,
  userId: string,
  clock: Clock = systemClock,
): Promise<string> {
  const cfg = loadMethodology();
  const tacticalRating = await resolveTacticalRating(db, userId, cfg);
  const band = bandForRating(tacticalRating, cfg);

  // M13: seed the band's curated endgame curriculum (Seam-4 config) as spaced PracticeItems
  // BEFORE reading due items, so the endgame_drill activity (due-gated) can surface them this
  // session. Only when endgames are recommended for the band (positive ROI prior) — and
  // idempotent, so it never re-seeds or resets an in-flight drill.
  const endgameRecommended = cfg.activities.some(
    (a) =>
      a.activityType === "endgame_drill" &&
      (a.priorityByBand[band]?.value ?? 0) > 0,
  );
  if (endgameRecommended) {
    await ensureEndgameDrills(db, userId, band, cfg, clock);
  }

  const features = await gatherFeatures(db, userId);
  const weaknessSignals = interpretGameFeatures({ features, band }, cfg);
  const constraints = await getCurrentConstraints(db, userId);
  const minutesPerDay =
    constraints?.minutesPerDay ?? EMPTY_CONSTRAINTS.minutesPerDay;
  // Stated preferences that reshape the daily mix (Seam 7). The generator passes these to
  // the methodology; absent ones leave the un-personalised order untouched.
  const formats = constraints?.formatPrefs.formats ?? [];
  const ownedRefs =
    constraints?.ownedResources.flatMap((r) =>
      r.externalRef ? [r.externalRef, r.label] : [r.label],
    ) ?? [];
  const depthVsBreadth = constraints?.sessionStyle.depthVsBreadth;

  // M7: the loop's feedback — spaced reviews due now + the rolling success that nudges
  // difficulty. Reading these here is what makes a regenerated session reflect adaptation.
  const dueRows = await findDueScheduleStates(
    db,
    userId,
    new Date(clock.now()),
  );
  const dueItems = dueRows.map((d) => ({
    itemRef: d.itemRef,
    itemType: d.itemType,
  }));
  const recentSuccessByTrack = await gatherRecentSuccessByTrack(db, userId);

  const libraryRating = await resolveLibraryRating(db, userId, cfg);
  const libraryBand = bandForRating(libraryRating, cfg);

  const result = generateProgram({
    band,
    tacticalRating,
    libraryBand,
    weaknessSignals,
    dueItems,
    constraints: { minutesPerDay, formats, ownedRefs, depthVsBreadth },
    recentSuccessByTrack,
    clock,
    config: cfg,
  });

  // Link each puzzle-theme item to its catalog ResourceRef when one has been seeded.
  const wantedRefIds = [
    ...new Set(
      result.items
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

  const generationInput = {
    band,
    tacticalRating,
    libraryBand,
    minutesPerDay,
    daysPerWeek: constraints?.daysPerWeek ?? null,
    formats,
    ownedRefs,
    depthVsBreadth: depthVsBreadth ?? null,
    weaknessSignals,
    dueItems,
    recentSuccessByTrack,
    methodologyVersion: cfg.version,
    generatedAt: result.generatedAt,
  } as unknown as Prisma.InputJsonValue;

  return saveProgram(db, {
    userId,
    methodologyVersion: cfg.version,
    generationInput,
    date: startOfDayUTC(result.generatedAt),
    items: result.items.map((it) => ({
      orderIndex: it.orderIndex,
      activityId: it.activityId,
      activityType: it.activityType,
      resourceRefId:
        it.resourceTheme && seededIds.has(themeRefId(it.resourceTheme))
          ? themeRefId(it.resourceTheme)
          : null,
      // estMinutes rides along in params for display; it is a packing input, not a column.
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
    })),
  });
}

// --- Read side: the shaped DTO the /today screen renders -------------------

export interface TodayItem {
  id: string;
  orderIndex: number;
  label: string;
  activityType: string;
  dimensionLabels: string[];
  estMinutes: number | null;
  params: Omit<ProgramItemParams, "dueItemRefs">;
  /** Human-readable display tags for due review work; raw due refs stay server/internal. */
  reviewThemes: string[];
  externalUrl: string | null;
  /** The label for the external-link button (e.g. "Play on Lichess ↗"). */
  externalLabel: string | null;
  url: string | null;
  delivery: "internal" | "external";
  /** Concrete owned book/course selected for a scheduled external book-study item. */
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

export interface TodayProgram {
  id: string;
  createdAt: Date;
  methodologyVersion: string;
  /** Always-on honesty copy (Seam 8) shown above the session. */
  honesty: { expectations: string; processGoal: string };
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
  // "Play a game" resolves to a one-click deep link to the user's preferred platform
  // (Goal 3); themed puzzles keep their Lichess training-page link.
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

// --- Read side: the honest "reveal" — what the user's games actually show -----------

export interface GameSignal {
  dimension: string;
  dimensionLabel: string;
  /** 0..1 — how far the measured rate exceeds the band threshold. */
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

/** The graded weakness signals from the user's analysed games (Seam 3), shaped for the
 *  reveal. Pure decisions stay in interpretGameFeatures; this only gathers + maps (L1). */
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

/** The active program shaped for the UI, or null if none has been generated yet. */
export async function getTodayProgram(
  db: Db,
  userId: string,
): Promise<TodayProgram | null> {
  const cfg = loadMethodology();
  const program = await getActiveProgram(db, userId);
  if (!program) return null;

  const user = await db.user.findUnique({
    where: { id: userId },
    select: { primaryPlatform: true },
  });
  const primaryPlatform = user?.primaryPlatform ?? null;

  const dimLabels = new Map(cfg.dimensions.map((d) => [d.id, d.label]));
  const ledger = new Map(cfg.evidenceLedger.map((a) => [a.key, a.source]));
  const reviewThemes = await reviewThemesByItemId(db, program.items);

  return {
    id: program.id,
    createdAt: program.createdAt,
    methodologyVersion: program.methodologyVersion,
    honesty: {
      expectations: rationaleFor("expectations", cfg).value,
      processGoal: rationaleFor("process_goal", cfg).value,
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
