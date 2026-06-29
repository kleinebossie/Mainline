// Library orchestration (BUILD.md M14 · §4.2–4.4). The deliberately-EXTERNAL layer: books,
// courses, and real games are recommended + logged, never hosted (VISION §6). The graded
// DECISIONS live in the pure provider functions (recommendBooks / woodpeckerSchedule /
// bookDifficultyFeedback / modalityRecommendation); this module only gathers DB state, calls
// them, and rolls up progress (L1: server orchestrates, it does not decide). ResourceProgress
// (§5.5) is ROLLED UP from book_session ActivityEvents — there is no ResourceProgress table
// (no schema change, M14); the "current position" is the latest session per resource.

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

/** One graded "why" line resolved for the UI (Seam 8) — copy + how strong its evidence is. */
export interface GradedCopy {
  text: string;
  grade: Grade;
  tier: Tier;
  citationKey: string;
  citationSource: string | null;
  soften: boolean;
  flag?: GradedFlag;
}

/** The current position in one external resource (M14), rolled up from book_session events. */
export interface ResourceProgressView {
  resourceRefId: string;
  /** Resolved from the book catalog when the resource is a known book; else null. */
  title: string | null;
  position: BookPosition | null;
  lastSuccessRate: number | null;
  woodpeckerCycle: number | null;
  sessions: number;
  totalMinutes: number;
  /** Epoch ms of the most recent session (the list is sorted newest-first). */
  lastSessionAt: number;
}

/** A book recommendation with its citation source resolved for display. */
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

/** Defensively parse a book_session payload's M14 fields (the column is untyped JSON). */
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

/**
 * Roll up the user's external-resource progress from the immutable book_session log (§5.5):
 * one entry per resource, the latest session's position/success/cycle, plus session count and
 * total minutes. Read-only — needs only the ActivityEvent table, so it is cheaply testable.
 */
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
  const byRef = new Map<string, ResourceProgressView>();
  for (const row of rows) {
    const parsed = parseBookSession(row.payload);
    if (!parsed?.resourceRefId) continue;
    const id = parsed.resourceRefId;
    const acc: ResourceProgressView = byRef.get(id) ?? {
      resourceRefId: id,
      title: titleById.get(id) ?? null,
      position: null,
      lastSuccessRate: null,
      woodpeckerCycle: null,
      sessions: 0,
      totalMinutes: 0,
      lastSessionAt: 0,
    };
    acc.sessions += 1;
    acc.totalMinutes += parsed.durationMin;
    // Rows are ascending, so the last write wins → the latest session's state.
    if (parsed.position) acc.position = parsed.position;
    if (parsed.successRate !== null) acc.lastSuccessRate = parsed.successRate;
    if (parsed.woodpeckerCycle !== null)
      acc.woodpeckerCycle = parsed.woodpeckerCycle;
    acc.lastSessionAt = row.occurredAt.getTime();
    byRef.set(id, acc);
  }
  return [...byRef.values()].sort((a, b) => b.lastSessionAt - a.lastSessionAt);
}

/**
 * Assemble the /library view from the resolved (band, play medium, owned resources, progress).
 * PURE given those inputs + config — the DB reads happen in the router around it. Every line
 * carries its graded evidence (L3); the cognitive-load block rule lives in recommendBooks.
 */
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

/**
 * The /library view for a user: resolve their band (from tactical rating), play medium, owned
 * resources, and rolled-up progress, then assemble. Orchestration only (L1).
 */
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
