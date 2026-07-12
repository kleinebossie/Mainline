// P4 — ProgramDecisionInput schema (lib/decision-input). The single typed snapshot of
// longitudinal state the assembler persists onto `Program.generationInput`. Validating at
// the boundary is what makes a historic program reproducible end-to-end (L2).

import { describe, expect, it } from "vitest";

import {
  EMPTY_TRAINING_PREFERENCES,
  programDecisionInputSchema,
  trainingPreferencesSchema,
  type ProgramDecisionInput,
} from "@/lib/decision-input";

describe("programDecisionInputSchema", () => {
  it("parses a minimal snapshot, filling TrainingPreferences + activityRecency defaults", () => {
    const snapshot: ProgramDecisionInput = {
      schemaVersion: 1,
      methodologyVersion: "research-1.0.0",
      assembledAt: 1_700_000_000_000,
      userId: "u1",
      band: "band1200_1600",
      tacticalRating: 1300,
      libraryBand: "band1200_1600",
      constraints: {
        minutesPerDay: 30,
        daysPerWeek: 5,
        goals: [],
        ownedResources: [],
        formatPrefs: {
          formats: [],
          preferredVariety: false,
          targetFocus: "online",
        },
        sessionStyle: { depthVsBreadth: "balanced", interleave: true },
        ifThenPlan: null,
      },
      goals: [],
      ownedResources: [],
      latestSkillState: [],
      skillHistory: [],
      dueWork: [],
      activityRecency: {
        lastEventAtByType: {},
        completionsByType: {},
        skipsByType: {},
        durationMinutesByType: {},
        activeDays: 0,
        totalEvents: 0,
      },
      recentSuccessByTrack: {},
      weaknessSignals: [],
      trainingPreferences: {
        preferences: EMPTY_TRAINING_PREFERENCES,
        userOverride: null,
        resetAt: null,
        updatedAt: 1_700_000_000_000,
      },
    };
    const parsed = programDecisionInputSchema.parse(snapshot);
    expect(parsed.schemaVersion).toBe(1);
    expect(parsed.trainingPreferences.preferences.enjoyment).toEqual({});
    expect(parsed.trainingPreferences.preferences.evidenceCount).toBe(0);
    expect(parsed.activityRecency.activeDays).toBe(0);
  });

  it("round-trips through JSON.stringify -> parse exactly (reproducibility)", () => {
    const snapshot: ProgramDecisionInput = {
      schemaVersion: 1,
      methodologyVersion: "research-1.0.0",
      assembledAt: 1_700_000_000_000,
      userId: "u-history",
      band: "band800_1200",
      tacticalRating: 950,
      libraryBand: "band800_1200",
      constraints: {
        minutesPerDay: 25,
        daysPerWeek: 6,
        goals: [{ kind: "rating", label: "Reach 1600" }],
        ownedResources: [{ kind: "book", label: "polgar_5334" }],
        formatPrefs: {
          formats: ["rapid"],
          preferredVariety: true,
          targetFocus: "hybrid",
        },
        sessionStyle: { depthVsBreadth: "depth", interleave: false },
        ifThenPlan: { cue: "after coffee", plan: "30 min tactics" },
      },
      goals: [{ kind: "rating", label: "Reach 1600" }],
      ownedResources: [{ kind: "book", label: "polgar_5334" }],
      latestSkillState: [
        {
          dimension: "tactics",
          estimate: 0.7,
          uncertainty: 0.05,
          sampleSize: 42,
        },
      ],
      skillHistory: [
        {
          dimension: "tactics",
          estimate: 0.6,
          uncertainty: 0.1,
          sampleSize: 20,
          methodologyVersion: "research-1.0.0",
          runAt: 1_700_000_000_000 - 86_400_000,
          capturedAt: 1_700_000_000_000 - 86_400_000,
        },
      ],
      dueWork: [
        {
          itemRef: "puzzle-1",
          itemType: "puzzle",
          due: 1_700_000_000_000 - 3_600_000,
        },
      ],
      activityRecency: {
        lastEventAtByType: { puzzle_attempt: 1_700_000_000_000 - 600_000 },
        completionsByType: { puzzle_attempt: 25 },
        skipsByType: {},
        durationMinutesByType: { puzzle_attempt: 18 },
        activeDays: 7,
        totalEvents: 25,
      },
      recentSuccessByTrack: { pattern: 0.83 },
      weaknessSignals: [
        {
          dimension: "board_vision",
          severity: 0.6,
          confidence: "medium",
          sampleSize: 28,
          evidenceGrade: "B",
          evidenceTier: 1,
          citationKey: "example_citation",
          rationaleKey: "blunder_focus",
        },
      ],
      trainingPreferences: {
        preferences: {
          enjoyment: { puzzle_theme: 0.7 },
          resourceAffinity: {},
          frictionTags: ["too_long"],
          evidenceCount: 3,
          methodologyVersion: "research-1.0.0",
        },
        userOverride: null,
        resetAt: null,
        updatedAt: 1_700_000_000_000,
      },
    };
    const json = JSON.parse(JSON.stringify(snapshot));
    const parsed = programDecisionInputSchema.parse(json);
    expect(parsed).toEqual(snapshot);
  });

  it("rejects a snapshot with a wrong schemaVersion (fail-closed on shape drift)", () => {
    const bad = {
      schemaVersion: 2, // future / unsupported
      methodologyVersion: "x",
      assembledAt: 0,
      userId: "u1",
      band: "x",
      tacticalRating: 0,
      libraryBand: "x",
      constraints: {
        minutesPerDay: 20,
        daysPerWeek: 5,
        goals: [],
        ownedResources: [],
        formatPrefs: {
          formats: [],
          preferredVariety: false,
          targetFocus: "online",
        },
        sessionStyle: { depthVsBreadth: "balanced", interleave: true },
        ifThenPlan: null,
      },
      goals: [],
      ownedResources: [],
      latestSkillState: [],
      skillHistory: [],
      dueWork: [],
      recentSuccessByTrack: {},
      weaknessSignals: [],
      trainingPreferences: {
        preferences: EMPTY_TRAINING_PREFERENCES,
        userOverride: null,
        resetAt: null,
        updatedAt: 0,
      },
    };
    expect(() => programDecisionInputSchema.parse(bad)).toThrow();
  });

  it("rejects a skill estimate slipping into TrainingPreferences (boundary)", () => {
    // TrainingPreferences must NEVER carry a skill estimate (roadmap-wide invariant, §9).
    const bad = {
      enjoyment: { puzzle_theme: 0.7 },
      resourceAffinity: {},
      frictionTags: [],
      evidenceCount: 0,
      // a sneaky "skill" field — must be stripped by strict()
      skill_estimate: 0.8,
    };
    expect(() =>
      // strict() schema must reject the extra key — a sneaky "skill" field on a
      // TRAINING preferences object must never slip through (roadmap-wide invariant, §9).
      trainingPreferencesSchema.parse(bad),
    ).toThrow();
  });
});
