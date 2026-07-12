// The single server-side decision-state assembler (FEATURE_ROADMAP P4). The roadmap
// requires ONE typed assembler so routes never independently reconstruct partial decision
// state. This module pulls every longitudinal input the generator MIGHT consume, builds a
// `ProgramDecisionInput` (lib/decision-input), and exposes a helper to derive the narrow
// `GenerateProgramInput` slice the pure generator already uses.
//
// L1: this module ORCHESTRATES. It makes no graded chess decision — every recommendation
// lives in the methodology provider. The weaknessSignals it attaches are produced by the
// pure `interpretGameFeatures` (Seam 3); recency/adherence are generic descriptive
// statistics. Determinism (L2): the snapshot is a pure function of persisted rows + the
// injected Clock; same persisted state + same clock + same config → identical snapshot.

import type { Prisma, PrismaClient } from "@prisma/client";

import {
  bandForRating,
  interpretGameFeatures,
  type Band,
  type MethodologyConfig,
  type WeaknessSignal,
} from "@/methodology";
import { type Clock } from "@/lib/clock";
import { EMPTY_CONSTRAINTS } from "@/lib/constraints";
import {
  EMPTY_TRAINING_PREFERENCES,
  programDecisionInputSchema,
  type DecisionDueItem,
  type ProgramDecisionInput,
} from "@/lib/decision-input";
import { findSkillStates, findDueScheduleStates } from "@/db/tracker";
import {
  findActivityRecency,
  findRecentSkillStateSnapshots,
  findTrainingPreferenceState,
} from "@/db/decision-input";
import { getCurrentConstraints } from "@/server/constraints";
import {
  gatherFeatures,
  gatherRecentSuccessByTrack,
  resolveLibraryRating,
  resolveTacticalRating,
} from "@/server/program";

// The Db type mirrors the `Db` declared in `src/server/program.ts` plus the new P4
// tables whose helpers we now call (`skillState`, `skillStateSnapshot`,
// `trainingPreferenceState`). Helpers in `program.ts` take their own narrower `Db`,
// whose structure this type satisfies, so the assembler can pass itself through.
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

/** Snapshot schema version — bump only if the shape changes (additive, never breaking). */
export const PROGRAM_DECISION_INPUT_SCHEMA_VERSION = 1 as const;

export interface AssembledSnapshot {
  /** The validated, typed snapshot — persists onto `Program.generationInput`. */
  snapshot: ProgramDecisionInput;
  /** The narrow slice the pure generator consumes (kept here so the server is the only
   *  constructor — routes never reach into the snapshot's structure, P4 invariant). */
  generateInput: {
    band: Band;
    tacticalRating: number;
    libraryBand: Band;
    weaknessSignals: readonly WeaknessSignal[];
    dueItems: ReadonlyArray<{ itemRef: string; itemType: string }>;
    constraints: {
      minutesPerDay: number;
      formats: readonly string[];
      ownedRefs: readonly string[];
      depthVsBreadth: "depth" | "balanced" | "breadth" | undefined;
    };
    recentSuccessByTrack: { pattern?: number; calculation?: number };
  };
}

/**
 * Assemble the full typed ProgramDecisionInput for a user. Pure read of persisted state +
 * the injected Clock; no writes, no graded decisions. Routes call this — they never
 * reconstruct decision state from partial reads (P4 invariant).
 */
export async function assembleProgramDecisionInput(
  db: Db,
  userId: string,
  clock: Clock,
  cfg: MethodologyConfig,
): Promise<AssembledSnapshot> {
  const assembledAt = clock.now();

  const tacticalRating = await resolveTacticalRating(db, userId, cfg);
  const band = bandForRating(tacticalRating, cfg);
  const libraryRating = await resolveLibraryRating(db, userId, cfg);
  const libraryBand = bandForRating(libraryRating, cfg);

  const features = await gatherFeatures(db, userId);
  const weaknessSignals = interpretGameFeatures({ features, band }, cfg);

  const constraints = await getCurrentConstraints(db, userId);
  const effectiveConstraints = constraints ?? EMPTY_CONSTRAINTS;
  const minutesPerDay = effectiveConstraints.minutesPerDay;
  const formats = effectiveConstraints.formatPrefs.formats;
  const ownedResources = effectiveConstraints.ownedResources;
  const ownedRefs = ownedResources.flatMap((r) =>
    r.externalRef ? [r.externalRef, r.label] : [r.label],
  );
  const depthVsBreadth = effectiveConstraints.sessionStyle.depthVsBreadth;

  const latestSkillState = await findSkillStates(db, userId);
  const skillHistory = await findRecentSkillStateSnapshots(db, userId);

  const dueRows = await findDueScheduleStates(
    db,
    userId,
    new Date(assembledAt),
  );
  const dueWork: DecisionDueItem[] = dueRows.map((d) => ({
    itemRef: d.itemRef,
    itemType: d.itemType,
    due: d.due.getTime(),
  }));

  const activityRecency = await findActivityRecency(db, userId, assembledAt);

  const recentSuccessByTrack = await gatherRecentSuccessByTrack(db, userId);

  const trainingPrefRow = await findTrainingPreferenceState(db, userId);

  const rawSnapshot: ProgramDecisionInput = {
    schemaVersion: PROGRAM_DECISION_INPUT_SCHEMA_VERSION,
    methodologyVersion: cfg.version,
    assembledAt,
    userId,
    band,
    tacticalRating,
    libraryBand,
    constraints: effectiveConstraints,
    goals: effectiveConstraints.goals,
    ownedResources,
    latestSkillState: latestSkillState.map((s) => ({
      dimension: s.dimension,
      estimate: s.estimate,
      uncertainty: s.uncertainty,
      sampleSize: s.sampleSize,
    })),
    skillHistory,
    dueWork,
    activityRecency,
    recentSuccessByTrack,
    weaknessSignals: weaknessSignals.map((s) => ({
      dimension: s.dimension,
      severity: s.severity,
      confidence: s.confidence,
      sampleSize: s.sampleSize,
      evidenceGrade: s.evidenceGrade,
      evidenceTier: s.evidenceTier,
      citationKey: s.citationKey,
      rationaleKey: s.rationaleKey,
    })),
    // Persist the default-row shape exactly so the snapshot+export both carry the same
    // structure (P4 ships empty; P8 fills). Use the validated empty default.
    trainingPreferences: trainingPrefRow,
  };

  // Validate at the boundary so a corrupted column can never silently become a future
  // program input (L1 fail-closed). Invalid snapshots throw — never fall back.
  // Use the PARSED output as the canonical snapshot so silent key-stripping in nested
  // schemas (e.g. the non-strict `constraints` schema drops the persisted `id`/`version`)
  // cannot leave the snapshot's persisted shape out of sync with its parsed shape.
  const snapshot = programDecisionInputSchema.parse(rawSnapshot);

  return {
    snapshot,
    generateInput: {
      band,
      tacticalRating,
      libraryBand,
      weaknessSignals,
      dueItems: dueWork.map((d) => ({
        itemRef: d.itemRef,
        itemType: d.itemType,
      })),
      constraints: {
        minutesPerDay,
        formats,
        ownedRefs,
        depthVsBreadth,
      },
      recentSuccessByTrack,
    },
  };
}

/** Re-parse a persisted `Program.generationInput` back into the typed snapshot, so any
 *  historic program can be re-derived exactly. Throws on shape drift (fail-closed). */
export function parsePersistedSnapshot(raw: unknown): ProgramDecisionInput {
  return programDecisionInputSchema.parse(raw);
}

/** Convenience for tests / migration: the empty training-preference default so server code
 *  never imports from lib/-internals sideways. */
export const EMPTY_PREFS = EMPTY_TRAINING_PREFERENCES;

/** Persist a fresh training-preference row with the empty default. P4's minimal UI surface
 *  (Settings reset) uses this; P8 will write richer preferences through
 *  `upsertTrainingPreferenceState`. Pure persistence — no graded decision. */
export async function ensureDefaultTrainingPreferenceState(
  db: Pick<PrismaClient, "trainingPreferenceState">,
  userId: string,
) {
  await db.trainingPreferenceState.upsert({
    where: { userId },
    create: {
      userId,
      preferences:
        EMPTY_TRAINING_PREFERENCES as unknown as Prisma.InputJsonValue,
      userOverride: null as unknown as Prisma.InputJsonValue,
      resetAt: null,
    },
    update: {
      preferences:
        EMPTY_TRAINING_PREFERENCES as unknown as Prisma.InputJsonValue,
      userOverride: null as unknown as Prisma.InputJsonValue,
      resetAt: null,
    },
  });
}
