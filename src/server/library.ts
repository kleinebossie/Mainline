// External resources are recommended and logged, never hosted. Progress is derived from
// immutable book-session events; methodology owns recommendations.

import type { PrismaClient } from "@prisma/client";

import {
  bandForRating,
  loadMethodology,
  modalityRecommendation,
  rationaleFor,
  recommendBooks,
  woodpeckerSchedule,
  type Band,
  type BookRecommendation,
  type Grade,
  type MethodologyConfig,
  type ModalityRecommendation,
  type Tier,
  type TargetFocus,
  type WoodpeckerCycle,
} from "@/methodology";
import {
  bookPositionSchema,
  bookSelfReportSchema,
  type BookPosition,
} from "@/lib/tracker";
import type { GradedFlag } from "@/methodology";

export interface GradedCopy {
  text: string;
  grade: Grade;
  tier: Tier;
  citationKey: string;
  citationSource: string | null;
  soften: boolean;
  flag?: GradedFlag;
}

export interface ResourceProgressView {
  resourceRefId: string;
  title: string | null;
  studyUnit: "exercises" | "games" | null;
  position: BookPosition | null;
  lastSuccessRate: number | null;
  woodpeckerCycle: number | null;
  sessions: number;
  totalMinutes: number;
  lastSessionAt: number;
}

export interface BookView extends BookRecommendation {
  citationSource: string | null;
}

export interface LibraryView {
  band: Band;
  bandLabel: string;
  targetFocus: TargetFocus;
  books: BookView[];
  protocol: {
    activeRecall: GradedCopy & { timeLimitMin: number };
    calibration: GradedCopy & {
      targetPct: number;
      lowerPct: number;
      upperPct: number;
    };
    woodpecker: GradedCopy & {
      cycles: WoodpeckerCycle[];
      recommendedMinCycles: number;
    };
  };
  modality: {
    digitalPct: number;
    physicalPct: number;
    surfacePhysical: boolean;
    otbCadence: string;
    physicalBoardAdvice: string;
    split: GradedCopy;
    otb: GradedCopy;
  };
  progress: ResourceProgressView[];
}

function gradedCopy(
  key: string,
  cfg: MethodologyConfig,
  ledger: Map<string, string>,
): GradedCopy {
  const r = rationaleFor(key, cfg);
  return {
    text: r.value,
    grade: r.grade,
    tier: r.tier,
    citationKey: r.citationKey,
    citationSource: ledger.get(r.citationKey) ?? null,
    soften: r.soften,
    flag: r.flag,
  };
}

function parseBookSession(payload: unknown): {
  resourceRefId: string | null;
  position: BookPosition | null;
  successRate: number | null;
  woodpeckerCycle: number | null;
  durationMin: number;
} | null {
  if (!payload || typeof payload !== "object") return null;
  const p = payload as Record<string, unknown>;
  const resourceRefId =
    typeof p.resourceRefId === "string" ? p.resourceRefId : null;
  const pos = bookPositionSchema.safeParse(p.position);
  const sr = bookSelfReportSchema.safeParse(p.selfReport);
  return {
    resourceRefId,
    position: pos.success ? pos.data : null,
    successRate: sr.success ? (sr.data.successRate ?? null) : null,
    woodpeckerCycle: sr.success ? (sr.data.woodpeckerCycle ?? null) : null,
    durationMin: typeof p.durationMin === "number" ? p.durationMin : 0,
  };
}

/** Roll up one latest-state view per external resource. */
export async function getResourceProgress(
  db: Pick<PrismaClient, "activityEvent">,
  userId: string,
  cfg: MethodologyConfig,
): Promise<ResourceProgressView[]> {
  const rows = await db.activityEvent.findMany({
    where: { userId, type: "book_session" },
    orderBy: { occurredAt: "asc" },
    select: { occurredAt: true, payload: true },
  });
  const titleById = new Map(
    Object.values(cfg.bookStudy.catalogByBand)
      .flat()
      .map((b) => [b.id, b.title]),
  );
  const studyUnitById = new Map(
    Object.values(cfg.bookStudy.catalogByBand)
      .flat()
      .map((b) => [b.id, b.studyUnit]),
  );

  const byRef = new Map<string, ResourceProgressView>();
  for (const row of rows) {
    const parsed = parseBookSession(row.payload);
    if (!parsed?.resourceRefId) continue;
    const id = parsed.resourceRefId;
    const acc: ResourceProgressView = byRef.get(id) ?? {
      resourceRefId: id,
      title: titleById.get(id) ?? null,
      studyUnit: studyUnitById.get(id) ?? null,
      position: null,
      lastSuccessRate: null,
      woodpeckerCycle: null,
      sessions: 0,
      totalMinutes: 0,
      lastSessionAt: 0,
    };
    acc.sessions += 1;
    acc.totalMinutes += parsed.durationMin;
    // Rows are ascending, so the last write is the latest state.
    if (parsed.position) acc.position = parsed.position;
    if (parsed.successRate !== null) acc.lastSuccessRate = parsed.successRate;
    if (parsed.woodpeckerCycle !== null)
      acc.woodpeckerCycle = parsed.woodpeckerCycle;
    acc.lastSessionAt = row.occurredAt.getTime();
    byRef.set(id, acc);
  }
  return [...byRef.values()].sort((a, b) => b.lastSessionAt - a.lastSessionAt);
}

export function buildLibrary(
  input: {
    band: Band;
    targetFocus: TargetFocus;
    ownedRefs: readonly string[];
    progress: ResourceProgressView[];
  },
  cfg: MethodologyConfig,
): LibraryView {
  const ledger = new Map(cfg.evidenceLedger.map((a) => [a.key, a.source]));
  const bandLabel =
    cfg.bands.find((b) => b.id === input.band)?.label ?? input.band;

  const books: BookView[] = recommendBooks(
    { band: input.band, ownedRefs: input.ownedRefs },
    cfg,
  ).map((b) => ({ ...b, citationSource: ledger.get(b.citationKey) ?? null }));

  const wood = woodpeckerSchedule(cfg);
  const modality: ModalityRecommendation = modalityRecommendation(
    { band: input.band, targetFocus: input.targetFocus },
    cfg,
  );
  const ar = cfg.bookStudy.activeRecall;
  const dc = cfg.bookStudy.difficultyCalibration;

  return {
    band: input.band,
    bandLabel,
    targetFocus: input.targetFocus,
    books,
    protocol: {
      activeRecall: {
        ...gradedCopy(cfg.bookStudy.activeRecallRationaleKey, cfg, ledger),
        timeLimitMin: ar.timeLimitMin.value,
      },
      calibration: {
        ...gradedCopy(cfg.bookStudy.calibrationRationaleKey, cfg, ledger),
        targetPct: Math.round(dc.targetSuccessRate.value * 100),
        lowerPct: Math.round(dc.lowerBound.value * 100),
        upperPct: Math.round(dc.upperBound.value * 100),
      },
      woodpecker: {
        ...gradedCopy(cfg.bookStudy.woodpeckerRationaleKey, cfg, ledger),
        cycles: wood.cycles,
        recommendedMinCycles: wood.recommendedMinCycles,
      },
    },
    modality: {
      digitalPct: modality.digitalPct,
      physicalPct: modality.physicalPct,
      surfacePhysical: modality.surfacePhysical,
      otbCadence: modality.otbCadence,
      physicalBoardAdvice: modality.physicalBoardAdvice,
      split: gradedCopy(modality.modalityRationaleKey, cfg, ledger),
      otb: gradedCopy(modality.otbRationaleKey, cfg, ledger),
    },
    progress: input.progress,
  };
}

export async function getLibrary(
  db: PrismaClient,
  userId: string,
  rating: number,
  targetFocus: TargetFocus,
  ownedRefs: readonly string[],
): Promise<LibraryView> {
  const cfg = loadMethodology();
  const band = bandForRating(rating, cfg);
  const progress = await getResourceProgress(db, userId, cfg);
  return buildLibrary({ band, targetFocus, ownedRefs, progress }, cfg);
}
