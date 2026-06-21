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
import { lichessThemeUrl } from "@/integrations/catalog";
import { ratingFromSnapshot } from "@/server/assessment";
import { getCurrentConstraints } from "@/server/constraints";
import {
  getActiveProgram,
  saveProgram,
  type ActiveProgram,
} from "@/db/program";
import { EMPTY_CONSTRAINTS } from "@/lib/constraints";

type Db = Pick<
  PrismaClient,
  | "assessment"
  | "chessProfileSnapshot"
  | "analysisResult"
  | "constraintSet"
  | "resourceRef"
  | "program"
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
async function resolveTacticalRating(
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
  const features = await gatherFeatures(db, userId);
  const weaknessSignals = interpretGameFeatures({ features, band }, cfg);
  const constraints = await getCurrentConstraints(db, userId);
  const minutesPerDay =
    constraints?.minutesPerDay ?? EMPTY_CONSTRAINTS.minutesPerDay;

  const result = generateProgram({
    band,
    tacticalRating,
    weaknessSignals,
    dueItems: [],
    constraints: { minutesPerDay },
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
    minutesPerDay,
    weaknessSignals,
    dueItems: [],
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
  params: ProgramItemParams;
  externalUrl: string | null;
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

function toTodayItem(
  item: ActiveProgram["items"][number],
  cfg: MethodologyConfig,
  dimLabels: Map<string, string>,
  ledger: Map<string, string>,
): TodayItem {
  const params = paramsOf(item.params);
  const def = cfg.activities.find((a) => a.id === item.activityId);
  const theme = params.theme ?? null;
  const externalUrl =
    item.resourceRef?.externalUrl ?? (theme ? lichessThemeUrl(theme) : null);
  return {
    id: item.id,
    orderIndex: item.orderIndex,
    label: def?.label ?? item.activityId,
    activityType: item.activityType,
    dimensionLabels: item.dimensionsTargeted.map((d) => dimLabels.get(d) ?? d),
    estMinutes:
      typeof params.estMinutes === "number" ? params.estMinutes : null,
    params: { ...params, theme },
    externalUrl,
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

/** The active program shaped for the UI, or null if none has been generated yet. */
export async function getTodayProgram(
  db: Db,
  userId: string,
): Promise<TodayProgram | null> {
  const cfg = loadMethodology();
  const program = await getActiveProgram(db, userId);
  if (!program) return null;

  const dimLabels = new Map(cfg.dimensions.map((d) => [d.id, d.label]));
  const ledger = new Map(cfg.evidenceLedger.map((a) => [a.key, a.source]));

  return {
    id: program.id,
    createdAt: program.createdAt,
    methodologyVersion: program.methodologyVersion,
    honesty: {
      expectations: rationaleFor("expectations", cfg).value,
      processGoal: rationaleFor("process_goal", cfg).value,
    },
    items: program.items.map((it) => toTodayItem(it, cfg, dimLabels, ledger)),
  };
}
