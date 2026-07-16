// The only assembler for persisted program inputs. It reads graded decisions from
// methodology and is deterministic for the same rows, clock, and config.

import type { PrismaClient } from "@prisma/client";

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
} from "@/server/profile";

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

/** Bump when the persisted snapshot shape changes. */
export const PROGRAM_DECISION_INPUT_SCHEMA_VERSION = 1 as const;

export interface AssembledSnapshot {
  snapshot: ProgramDecisionInput;
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
      activityFit: Readonly<Record<string, number>>;
      resourceFit: Readonly<Record<string, number>>;
    };
    recentSuccessByTrack: { pattern?: number; calculation?: number };
  };
}

/** Assemble the validated snapshot and the generator's narrow input slice. */
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
  const activityFit = { ...trainingPrefRow.preferences.enjoyment };
  const resourceFit = { ...trainingPrefRow.preferences.resourceAffinity };
  for (const [key, value] of Object.entries(
    trainingPrefRow.userOverride?.enjoyment ?? {},
  )) {
    activityFit[key] = Math.max(activityFit[key] ?? 0, value);
  }
  for (const [key, value] of Object.entries(
    trainingPrefRow.userOverride?.resourceAffinity ?? {},
  )) {
    resourceFit[key] = Math.max(resourceFit[key] ?? 0, value);
  }

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
    trainingPreferences: trainingPrefRow,
  };

  // Use parsed output as the canonical snapshot. This fails closed on corrupt columns and
  // keeps persisted data aligned with keys stripped by nested schemas.
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
        activityFit,
        resourceFit,
      },
      recentSuccessByTrack,
    },
  };
}

export function parsePersistedSnapshot(raw: unknown): ProgramDecisionInput {
  return programDecisionInputSchema.parse(raw);
}
