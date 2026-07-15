// Pure session assembly. Methodology supplies every graded choice; the Engine only
// routes inputs and packs activities into the user's time budget.

import type { Clock } from "@/lib/clock";
import {
  allocationUnitForActivity,
  mapWeaknessToActivities,
  practiceStructure,
  prioritizeDailyMix,
  rationaleFor,
  targetPuzzleRating,
  useWorkedExample,
  type Band,
  type Confidence,
  type DueItem,
  type Grade,
  type GradedFlag,
  type MethodologyConfig,
  type CandidateBookResource,
  type MixPreferences,
  type PracticeStructureKind,
  type Tier,
  type Track,
  type WeaknessSignal,
} from "@/methodology";
import { packToBudget, type Divisible } from "@/engine/math/packing";

export type ProgramBookResource = CandidateBookResource;

export interface ProgramItemParams {
  theme: string | null;
  track: Track | null;
  targetRating?: number;
  successTarget?: number;
  count?: number;
  structure?: PracticeStructureKind;
  workedExample?: boolean;
  formats?: string[];
  gameCount?: number;
  dueItemRefs?: string[];
  bookResource?: ProgramBookResource;
  studyMinutes?: number;
  fitExplanation?: {
    text: string;
    evidenceGrade: Grade;
    evidenceTier: Tier;
    citationKey: string;
    flag?: GradedFlag;
    soften: boolean;
  };
}

/** One activity with its rationale snapshot preserved across config changes. */
export interface ProgramItemDraft {
  orderIndex: number;
  activityId: string;
  activityType: string;
  label: string;
  resourceTheme: string | null;
  params: ProgramItemParams;
  dimensionsTargeted: string[];
  estMinutes: number;
  rationaleKey: string;
  rationaleText: string;
  evidenceGrade: Grade;
  evidenceTier: Tier;
  citationKey: string;
  confidence: Confidence;
  soften: boolean;
}

export interface GenerateProgramInput {
  band: Band;
  tacticalRating: number;
  libraryBand?: Band;
  weaknessSignals: readonly WeaknessSignal[];
  dueItems: readonly DueItem[];
  focusAreas?: readonly string[];
  constraints: {
    minutesPerDay: number;
    formats?: readonly string[];
    ownedRefs?: readonly string[];
    depthVsBreadth?: MixPreferences["depthVsBreadth"];
    activityFit?: Readonly<Record<string, number>>;
    resourceFit?: Readonly<Record<string, number>>;
  };
  recentSuccessByTrack?: { pattern?: number; calculation?: number };
  clock: Clock;
  config: MethodologyConfig;
}

export interface GenerateProgramResult {
  items: ProgramItemDraft[];
  band: Band;
  generatedAt: number;
}

/** Route due items by renderable activity type. */
function dueItemsForActivity(
  activityType: string,
  dueItems: readonly DueItem[],
): DueItem[] {
  if (activityType === "blunder_drill") {
    return dueItems.filter((d) => d.itemType === "blunder_drill");
  }
  if (activityType === "endgame_drill") {
    return dueItems.filter((d) => d.itemType === "endgame");
  }
  if (activityType === "spaced_review") {
    // Skip legacy item types that the solving surface cannot render.
    return dueItems.filter(
      (d) => d.itemType === "puzzle" || d.itemType === "puzzle_theme",
    );
  }
  return [];
}

/** Use the longest selected format so the game count remains within budget. */
function gameMinutesFor(
  formats: readonly string[],
  cfg: MethodologyConfig,
): number | null {
  const map = cfg.prioritization.volume.minutesPerGameByFormat;
  if (!map) return null;
  const played = formats
    .map((f) => map[f]?.value)
    .filter((v): v is number => v != null);
  if (played.length > 0) return Math.max(...played);
  return map.rapid?.value ?? Object.values(map)[0]?.value ?? null;
}

/** Generate a deterministic, ordered session that fits the time budget. */
export function generateProgram(
  input: GenerateProgramInput,
): GenerateProgramResult {
  const { config: cfg, band, libraryBand } = input;

  const candidates = mapWeaknessToActivities(
    {
      signals: input.weaknessSignals,
      band,
      libraryBand,
      ownedRefs: input.constraints.ownedRefs,
    },
    cfg,
  );
  const focus = new Set(input.focusAreas ?? []);
  const fitEligibleActivityIds = candidates
    .filter((candidate) =>
      candidate.dimensionsTargeted.some((dimension) => focus.has(dimension)),
    )
    .map((candidate) => candidate.activityId);
  const focusedCandidates =
    focus.size === 0
      ? candidates
      : candidates.filter(
          (candidate) =>
            candidate.dimensionsTargeted.some((dimension) =>
              focus.has(dimension),
            ) ||
            dueItemsForActivity(candidate.activityType, input.dueItems).length >
              0,
        );
  const ordered = prioritizeDailyMix(
    {
      candidates: focusedCandidates.length > 0 ? focusedCandidates : candidates,
      dueItems: input.dueItems,
      preferences: {
        formats: input.constraints.formats,
        ownedRefs: input.constraints.ownedRefs,
        depthVsBreadth: input.constraints.depthVsBreadth,
        activityFit: input.constraints.activityFit,
        resourceFit: input.constraints.resourceFit,
        fitEligibleActivityIds,
      },
    },
    cfg,
  );

  // Methodology owns unit costs and caps; the packer only performs fit arithmetic.
  const vol = cfg.prioritization.volume;
  const dose = vol.dailyPuzzleDose.value;
  const enriched = ordered.map((c) => {
    let divisible: Divisible | undefined;
    if (
      c.activityType === "spaced_review" ||
      c.activityType === "blunder_drill" ||
      c.activityType === "endgame_drill"
    ) {
      // Each due position is one unit, but methodology owns its activity-specific cost.
      const due = dueItemsForActivity(c.activityType, input.dueItems);
      const unit = allocationUnitForActivity(
        { activityType: c.activityType, track: c.track },
        cfg,
      );
      if (unit != null && due.length > 0) {
        divisible = { ...unit, maxUnits: due.length };
      }
    } else if (c.track) {
      const unit = allocationUnitForActivity(
        { activityType: c.activityType, track: c.track },
        cfg,
      );
      if (unit != null) divisible = { ...unit, maxUnits: dose };
    } else if (c.activityType === "book" && c.bookResource) {
      // Book study is minute-flexible up to its methodology-provided estimate.
      divisible = {
        perUnitMinutes: 1,
        maxUnits: Math.max(1, c.estMinutes),
        allocationGranularityMinutes: vol.allocationGranularityMinutes?.value,
      };
    } else if (c.activityType === "play_game") {
      const per = gameMinutesFor(input.constraints.formats ?? [], cfg);
      const maxGames = vol.maxGamesPerSession?.value;
      if (per != null && maxGames != null) {
        divisible = {
          perUnitMinutes: per,
          maxUnits: maxGames,
          allocationGranularityMinutes: vol.allocationGranularityMinutes?.value,
        };
      }
    }
    return divisible ? { ...c, divisible } : c;
  });

  const packed = packToBudget(enriched, input.constraints.minutesPerDay);

  const items = packed.map((p, index): ProgramItemDraft => {
    const candidate = p.item;
    const estMinutes = p.allocatedMinutes;

    let params: ProgramItemParams;
    if (
      candidate.activityType === "spaced_review" ||
      candidate.activityType === "blunder_drill" ||
      candidate.activityType === "endgame_drill"
    ) {
      // Reviews carry only the due positions that fit, with no fresh difficulty target.
      const due = dueItemsForActivity(candidate.activityType, input.dueItems);
      const count = p.units ?? due.length;
      params = {
        theme: candidate.resourceTheme,
        track: candidate.track,
        dueItemRefs: due.slice(0, count).map((d) => d.itemRef),
        count,
        ...(candidate.fitExplanation
          ? {
              fitExplanation: {
                text: candidate.fitExplanation.text,
                evidenceGrade: candidate.fitExplanation.grade,
                evidenceTier: candidate.fitExplanation.tier,
                citationKey: candidate.fitExplanation.citationKey,
                ...(candidate.fitExplanation.flag
                  ? { flag: candidate.fitExplanation.flag }
                  : {}),
                soften: candidate.fitExplanation.soften,
              },
            }
          : {}),
      };
    } else if (candidate.track) {
      const recentSuccess = input.recentSuccessByTrack?.[candidate.track];
      const target = targetPuzzleRating(
        {
          userRating: input.tacticalRating,
          track: candidate.track,
          band,
          recentSuccess,
        },
        cfg,
      );
      params = {
        theme: candidate.resourceTheme,
        track: candidate.track,
        targetRating: target.ratingTarget,
        successTarget: target.successTarget,
        // Fall back to the methodology dose when per-puzzle timing is unconfigured.
        count: p.units ?? dose,
        structure: practiceStructure({ band }, cfg),
        workedExample: useWorkedExample({ band }, cfg),
        ...(candidate.fitExplanation
          ? {
              fitExplanation: {
                text: candidate.fitExplanation.text,
                evidenceGrade: candidate.fitExplanation.grade,
                evidenceTier: candidate.fitExplanation.tier,
                citationKey: candidate.fitExplanation.citationKey,
                ...(candidate.fitExplanation.flag
                  ? { flag: candidate.fitExplanation.flag }
                  : {}),
                soften: candidate.fitExplanation.soften,
              },
            }
          : {}),
      };
    } else {
      const isPlayGame = candidate.activityType === "play_game";
      const formats =
        isPlayGame &&
        input.constraints.formats &&
        input.constraints.formats.length > 0
          ? [...input.constraints.formats]
          : undefined;
      params = {
        theme: candidate.resourceTheme,
        track: null,
        formats,
        ...(isPlayGame && p.units != null ? { gameCount: p.units } : {}),
        ...(candidate.activityType === "book" && candidate.bookResource
          ? {
              bookResource: candidate.bookResource,
              studyMinutes: estMinutes,
            }
          : {}),
        ...(candidate.fitExplanation
          ? {
              fitExplanation: {
                text: candidate.fitExplanation.text,
                evidenceGrade: candidate.fitExplanation.grade,
                evidenceTier: candidate.fitExplanation.tier,
                citationKey: candidate.fitExplanation.citationKey,
                ...(candidate.fitExplanation.flag
                  ? { flag: candidate.fitExplanation.flag }
                  : {}),
                soften: candidate.fitExplanation.soften,
              },
            }
          : {}),
      };
    }

    // Confidence comes from the driving signal; a band prior remains explicitly low.
    const r = rationaleFor(candidate.rationaleKey, cfg);
    return {
      orderIndex: index,
      activityId: candidate.activityId,
      activityType: candidate.activityType,
      label: candidate.label,
      resourceTheme: candidate.resourceTheme,
      params,
      dimensionsTargeted: candidate.dimensionsTargeted,
      estMinutes,
      rationaleKey: candidate.rationaleKey,
      rationaleText: r.value,
      evidenceGrade: r.grade,
      evidenceTier: r.tier,
      citationKey: r.citationKey,
      confidence: candidate.drivingSignal?.confidence ?? "low",
      soften: r.soften,
    };
  });

  return { items, band, generatedAt: input.clock.now() };
}
