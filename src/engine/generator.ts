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
import { packToBudget, type Divisible } from "@/engine/math/packing";

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
  /** For a play_game item: how many games fit the time budget (Goal 1, hard time limit). */
  gameCount?: number;
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

/** Minutes per puzzle for a track, from config (Goal 1 — the hard-time-limit unit cost).
 *  Null when unconfigured, so the packer falls back to the activity's whole estMinutes. */
function puzzleMinutesFor(
  track: string,
  cfg: MethodologyConfig,
): number | null {
  const g = cfg.prioritization.volume.secondsPerPuzzleByTrack?.[track];
  return g ? g.value / 60 : null;
}

/** The due items that belong to a review-type activity (Engine itemType routing, not a
 *  graded choice): blunder_drill takes the personal blunder positions; spaced_review takes
 *  everything else (themed puzzle reviews). Other activities own no due queue. */
function dueItemsForActivity(
  activityType: string,
  dueItems: readonly DueItem[],
): DueItem[] {
  if (activityType === "blunder_drill") {
    return dueItems.filter((d) => d.itemType === "blunder_drill");
  }
  if (activityType === "endgame_drill") {
    // M13: the due curated endgame positions (itemType "endgame", seeded from Seam-4 config).
    return dueItems.filter((d) => d.itemType === "endgame");
  }
  if (activityType === "spaced_review") {
    // Only renderable puzzle reviews — a legacy itemType the solving surface can't render
    // (e.g. an orphaned mistake_puzzle) is skipped rather than shown as an empty card.
    return dueItems.filter(
      (d) => d.itemType === "puzzle" || d.itemType === "puzzle_theme",
    );
  }
  return [];
}

/** Minutes per game for the user's formats, from config — the LONGEST format they play, so
 *  the game count stays conservatively under the time budget. Null when unconfigured. */
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

  // Goal 1 — hard time limit: tag each candidate with its time-divisibility so the packer
  // sizes adjustable work (puzzles, games) to the remaining minute budget and keeps fixed
  // work whole only if it fits. The per-unit costs/caps come from config (L1); the Engine
  // only does the fit arithmetic (§7.1 step 5).
  const vol = cfg.prioritization.volume;
  const dose = vol.dailyPuzzleDose.value;
  const enriched = ordered.map((c) => {
    let divisible: Divisible | undefined;
    if (
      c.activityType === "spaced_review" ||
      c.activityType === "blunder_drill" ||
      c.activityType === "endgame_drill"
    ) {
      // Review-type activities solve/play one position per unit; blunder_drill/endgame_drill
      // have no track, so they borrow the pattern per-puzzle cost. Sized to their due queue.
      const due = dueItemsForActivity(c.activityType, input.dueItems);
      const per = puzzleMinutesFor(c.track ?? "pattern", cfg);
      if (per != null && due.length > 0) {
        divisible = { perUnitMinutes: per, maxUnits: due.length };
      }
    } else if (c.track) {
      const per = puzzleMinutesFor(c.track, cfg);
      if (per != null) divisible = { perUnitMinutes: per, maxUnits: dose };
    } else if (c.activityType === "play_game") {
      const per = gameMinutesFor(input.constraints.formats ?? [], cfg);
      const maxGames = vol.maxGamesPerSession?.value;
      if (per != null && maxGames != null) {
        divisible = { perUnitMinutes: per, maxUnits: maxGames };
      }
    }
    return divisible ? { ...c, divisible } : c;
  });

  const packed = packToBudget(enriched, input.constraints.minutesPerDay);

  const items = packed.map((p, index): ProgramItemDraft => {
    const candidate = p.item;
    // Time the item is actually allotted (its packed contribution) — the binding metric.
    const estMinutes = p.allocatedMinutes;

    // Seam 5: difficulty params for puzzle activities (track !== null).
    let params: ProgramItemParams;
    if (
      candidate.activityType === "spaced_review" ||
      candidate.activityType === "blunder_drill" ||
      candidate.activityType === "endgame_drill"
    ) {
      // Seam 6 (M7/M12/M13): a review-type item carries the due refs to redo — as many as fit
      // the budget (Goal 1), no fresh servo target (the redo flow, §7.5). spaced_review pulls
      // due puzzle reviews; blunder_drill pulls due personal blunder positions; endgame_drill
      // pulls due curated endgame positions (itemType "endgame").
      const due = dueItemsForActivity(candidate.activityType, input.dueItems);
      const count = p.units ?? due.length;
      params = {
        theme: candidate.resourceTheme,
        track: candidate.track,
        dueItemRefs: due.slice(0, count).map((d) => d.itemRef),
        count,
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
        // Count derived from the time that fit (Goal 1); falls back to the dose cap when
        // per-puzzle timing is unconfigured.
        count: p.units ?? dose,
        structure: practiceStructure({ band }, cfg),
        workedExample: useWorkedExample({ band }, cfg),
      };
    } else {
      // Non-puzzle activity. A "play games" item is told which formats the user actually
      // plays (Seam-7 personalisation) and how many games fit the budget (Goal 1).
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
      };
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
