// The program generator + daily-session builder (BUILD.md §7.1). PURE (L2) and
// science-free (L1): it orchestrates the Methodology provider functions and the generic
// Engine math, but contains no chess/learning constant of its own. Every graded choice is
// a call across the `@/methodology` surface; the only thing the Engine itself "decides" is
// fit/packing to the time budget (§7.1 step 5).
//
// Flow (§7.1): map weakness signals + band → candidate activities (Seam 4) → prioritise
// (Seam 7) → set difficulty per item (Seam 5) → pack to the minute budget (Engine math) →
// attach the graded "why" (Seam 8) and snapshot it onto each draft (L3). The band and the
// weakness signals are computed upstream by the server (bandForRating + interpretGameFeatures)
// and passed in, keeping this function a pure function of (state, clock, config).

import type { Clock } from "@/lib/clock";
import {
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
  type MethodologyConfig,
  type MixPreferences,
  type PracticeStructureKind,
  type Tier,
  type Track,
  type WeaknessSignal,
} from "@/methodology";
import { packToBudget } from "@/engine/math/packing";

/** The params blob persisted on a ProgramItem (§5.5) — how to run the external resource. */
export interface ProgramItemParams {
  theme: string | null;
  track: Track | null;
  targetRating?: number;
  successTarget?: number;
  count?: number;
  structure?: PracticeStructureKind;
  workedExample?: boolean;
  /** For a play_game item: the formats the user actually plays (personalisation, Seam 7). */
  formats?: string[];
  /** For a spaced-review item: the due item refs to redo (Seam 6 / the redo flow, M7). */
  dueItemRefs?: string[];
}

/** One activity in the generated day, with its L3 transparency snapshot denormalised on
 *  it (so a later config bump never silently rewrites a persisted "why"). */
export interface ProgramItemDraft {
  orderIndex: number;
  activityId: string;
  activityType: string;
  label: string;
  resourceTheme: string | null;
  params: ProgramItemParams;
  dimensionsTargeted: string[];
  estMinutes: number;
  // Transparency snapshot (L3, §5.5).
  rationaleKey: string;
  rationaleText: string;
  evidenceGrade: Grade;
  evidenceTier: Tier;
  citationKey: string;
  confidence: Confidence;
  soften: boolean;
}

export interface GenerateProgramInput {
  /** The band, precomputed by the server via bandForRating (a prior; data overrides it). */
  band: Band;
  /** The user's tactical/puzzle rating — drives Seam-5 difficulty targets. */
  tacticalRating: number;
  /** Graded weakness signals from Seam 3 (may be empty / insufficient-data). */
  weaknessSignals: readonly WeaknessSignal[];
  /** Spaced-review items due today (Seam 6, M7); M6 passes none. */
  dueItems: readonly DueItem[];
  /** The user's reality: the minute budget the Engine packs to, plus the stated preferences
   *  that reshape the mix (Seam 7). Preferences are optional — absent ⇒ un-personalised. */
  constraints: {
    minutesPerDay: number;
    formats?: readonly string[];
    ownedRefs?: readonly string[];
    depthVsBreadth?: MixPreferences["depthVsBreadth"];
  };
  /** Rolling success rate per track for the servo (M7+); absent → seed offset only. */
  recentSuccessByTrack?: { pattern?: number; calculation?: number };
  clock: Clock;
  config: MethodologyConfig;
}

export interface GenerateProgramResult {
  items: ProgramItemDraft[];
  band: Band;
  /** From the injected Clock (L2) — the server stamps the Program/date with the same clock. */
  generatedAt: number;
}

/**
 * Generate today's ordered, time-budget-fitted session. Deterministic: same
 * (inputs, config) → same program, including the rationale keys and grades (golden-tested,
 * §13.1).
 */
export function generateProgram(
  input: GenerateProgramInput,
): GenerateProgramResult {
  const { config: cfg, band } = input;

  // Seam 4 → Seam 7: gather candidates for the band, elevate weaknesses, order them.
  const candidates = mapWeaknessToActivities(
    { signals: input.weaknessSignals, band },
    cfg,
  );
  const ordered = prioritizeDailyMix(
    {
      candidates,
      dueItems: input.dueItems,
      preferences: {
        formats: input.constraints.formats,
        ownedRefs: input.constraints.ownedRefs,
        depthVsBreadth: input.constraints.depthVsBreadth,
      },
    },
    cfg,
  );

  // Engine math: pack to the minute budget (the only place the Engine decides — fit only).
  const packed = packToBudget(ordered, input.constraints.minutesPerDay);

  const items = packed.map((candidate, index): ProgramItemDraft => {
    // Seam 5: difficulty params for puzzle activities (track !== null).
    let params: ProgramItemParams;
    if (candidate.activityType === "spaced_review") {
      // Seam 6 (M7): a spaced-review item carries the due misses to redo — no fresh servo
      // target; these are prior items coming back spaced (the redo flow, §7.5).
      params = {
        theme: candidate.resourceTheme,
        track: candidate.track,
        dueItemRefs: input.dueItems.map((d) => d.itemRef),
        count: input.dueItems.length,
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
        count: cfg.prioritization.volume.dailyPuzzleDose.value,
        structure: practiceStructure({ band }, cfg),
        workedExample: useWorkedExample({ band }, cfg),
      };
    } else {
      // Non-puzzle activity. A "play games" item is told which formats the user actually
      // plays (Seam-7 personalisation), so the recommendation fits their real games.
      const formats =
        candidate.activityType === "play_game" &&
        input.constraints.formats &&
        input.constraints.formats.length > 0
          ? [...input.constraints.formats]
          : undefined;
      params = { theme: candidate.resourceTheme, track: null, formats };
    }

    // Seam 8: attach the graded "why" and snapshot it (L3). Confidence comes from the
    // driving weakness signal when one elevated this item; otherwise it is a band prior
    // (not the user's own data), surfaced honestly as "low".
    const r = rationaleFor(candidate.rationaleKey, cfg);
    return {
      orderIndex: index,
      activityId: candidate.activityId,
      activityType: candidate.activityType,
      label: candidate.label,
      resourceTheme: candidate.resourceTheme,
      params,
      dimensionsTargeted: candidate.dimensionsTargeted,
      estMinutes: candidate.estMinutes,
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
