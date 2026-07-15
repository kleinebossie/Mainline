import { describe, expect, it } from "vitest";

import {
  loadMethodology,
  prioritizeDailyMix,
  rollUpTrainingPreferences,
  selectTrainingFitPrompt,
  selectWeeklyFocus,
  type CandidateActivity,
  type TrainingFitObservation,
} from "@/methodology";
import { DAY_MS } from "@/lib/clock";

const cfg = loadMethodology("research-1.4.0");

function observation(
  id: string,
  overrides: Partial<TrainingFitObservation> = {},
): TrainingFitObservation {
  return {
    id,
    activityType: "calculation",
    resourceKey: "resource-1",
    relevance: "neutral",
    enjoyment: "neutral",
    timeFit: "fits",
    frictionTags: [],
    occurredAt: Number(id),
    ...overrides,
  };
}

function candidate(
  activityId: string,
  activityType: string,
  priority = 1,
): CandidateActivity {
  return {
    activityId,
    activityType,
    label: activityId,
    resourceTheme: null,
    dimensionsTargeted: ["calculation"],
    track: null,
    estMinutes: 10,
    priority,
    formats: null,
    rationaleKey: "play_games",
    drivingSignal: null,
  };
}

describe("P8 training fit methodology", () => {
  it("rolls up positive evidence deterministically without turning dislike into a penalty", () => {
    const inputs = [
      observation("2", {
        relevance: "not_relevant",
        enjoyment: "not_enjoyed",
        frictionTags: ["setup"],
        occurredAt: 2,
      }),
      observation("1", {
        relevance: "relevant",
        enjoyment: "enjoyed",
        occurredAt: 1,
      }),
    ];
    const first = rollUpTrainingPreferences(inputs, cfg);
    expect(rollUpTrainingPreferences([...inputs].reverse(), cfg)).toEqual(
      first,
    );
    expect(first.enjoyment).toEqual({ calculation: 1 });
    expect(first.resourceAffinity).toEqual({ "resource-1": 1 });
    expect(first.frictionTags).toEqual(["setup"]);
    expect(first.evidenceCount).toBe(2);

    const negativeOnly = rollUpTrainingPreferences([inputs[0]!], cfg);
    expect(negativeOnly.enjoyment).toEqual({});
    expect(negativeOnly.resourceAffinity).toEqual({});
  });

  it("uses positive fit only after the methodology score and snapshots an explanation", () => {
    const inputs = {
      candidates: [
        candidate("a-calculation", "calculation"),
        candidate("b-pattern", "pattern"),
        candidate("c-stronger", "analysis", 2),
      ],
      dueItems: [],
    };
    const ranked = prioritizeDailyMix(
      {
        ...inputs,
        preferences: { activityFit: { pattern: 1, calculation: 0 } },
      },
      cfg,
    );
    expect(ranked.map((item) => item.activityId)).toEqual([
      "c-stronger",
      "b-pattern",
      "a-calculation",
    ]);
    expect(ranked[0]!.fitExplanation).toBeUndefined();
    expect(ranked[1]!.fitExplanation).toEqual(
      expect.objectContaining({ citationKey: "deci1999", soften: true }),
    );

    const negative = prioritizeDailyMix(
      { ...inputs, preferences: { activityFit: { pattern: 0 } } },
      cfg,
    );
    expect(negative.map((item) => item.activityId)).toEqual([
      "c-stronger",
      "a-calculation",
      "b-pattern",
    ]);
    expect(negative.every((item) => !item.fitExplanation)).toBe(true);
  });

  it("does not use fit across focus eligibility or due-status boundaries", () => {
    const focusOnly = prioritizeDailyMix(
      {
        candidates: [
          candidate("a-focus", "calculation"),
          {
            ...candidate("b-outside-focus", "analysis"),
            dimensionsTargeted: ["tactics"],
          },
          candidate("c-focus", "pattern"),
        ],
        dueItems: [],
        preferences: {
          resourceFit: { "c-focus": 1, "b-outside-focus": 1 },
          fitEligibleActivityIds: ["a-focus", "c-focus"],
        },
      },
      cfg,
    );
    expect(focusOnly.map((item) => item.activityId)).toEqual([
      "a-focus",
      "b-outside-focus",
      "c-focus",
    ]);
    expect(focusOnly.every((item) => !item.fitExplanation)).toBe(true);

    const sameScoreDifferentDueStatus = prioritizeDailyMix(
      {
        candidates: [
          candidate("a-not-due", "calculation", 3),
          candidate("b-due", "spaced_review", 1),
        ],
        dueItems: [{ itemRef: "review-1", itemType: "puzzle" }],
        preferences: {
          resourceFit: { "b-due": 1 },
          fitEligibleActivityIds: ["a-not-due", "b-due"],
        },
      },
      cfg,
    );
    expect(sameScoreDifferentDueStatus.map((item) => item.activityId)).toEqual([
      "a-not-due",
      "b-due",
    ]);
    expect(
      sameScoreDifferentDueStatus.every((item) => !item.fitExplanation),
    ).toBe(true);
  });

  it("keeps weekly focus identical when subjective enjoyment changes", () => {
    const base = {
      latestSkillState: [
        {
          dimension: "calculation",
          estimate: 0.2,
          uncertainty: 0.1,
          sampleSize: 20,
        },
      ],
      weaknessSignals: [],
      dueWork: [],
      goals: [{ kind: "rating" as const, label: "Improve" }],
      constraints: { minutesPerDay: 30, daysPerWeek: 5 },
      ownedResources: [],
      activityRecency: { lastEventAtByType: {}, skipsByType: {} },
      trainingPreferences: {
        preferences: { enjoyment: {}, frictionTags: [] },
      },
    };
    const disliked = {
      ...base,
      trainingPreferences: {
        preferences: {
          enjoyment: { calculation: -100, tactics: 100 },
          frictionTags: ["setup"],
        },
      },
    };
    expect(selectWeeklyFocus(disliked, cfg)).toEqual(
      selectWeeklyFocus(base, cfg),
    );
  });

  it("preserves the historic focus-fit rule while P8 disables it by config", () => {
    const historic = loadMethodology("research-1.1.0");
    const activityRecency = Object.fromEntries(
      historic.activities.map((activity) => [activity.activityType, 1]),
    );
    const base = {
      latestSkillState: [],
      weaknessSignals: [],
      dueWork: [],
      goals: [],
      constraints: { minutesPerDay: 30, daysPerWeek: 5 },
      ownedResources: [],
      activityRecency: {
        lastEventAtByType: activityRecency,
        skipsByType: {},
      },
      trainingPreferences: {
        preferences: { enjoyment: {}, frictionTags: [] },
      },
    };
    const enjoyedEndgames = {
      ...base,
      trainingPreferences: {
        preferences: { enjoyment: { study: 1 }, frictionTags: [] },
      },
    };

    const historicSelection = selectWeeklyFocus(enjoyedEndgames, historic);
    expect(historicSelection.focusAreas).toEqual(["endgames"]);
    expect(historicSelection.supportingSignals[0]!.sources).toContain(
      "bounded fit preference",
    );
    expect(selectWeeklyFocus(enjoyedEndgames, cfg)).toEqual(
      selectWeeklyFocus(base, cfg),
    );
    expect(cfg.weeklyFocus?.weights.fitPreference.value).toBe(0);
  });

  it("prompts sparsely and treats prompt exposure without a response as cooldown", () => {
    const now = 21 * DAY_MS;
    const weekly = selectTrainingFitPrompt(
      {
        now,
        trainingStartedAt: 0,
        lastWeeklyFeedbackAt: null,
        lastWeeklyPromptAt: null,
        lastContextPromptAt: null,
        contextualCandidate: null,
      },
      cfg,
    );
    expect(weekly?.kind).toBe("weekly");
    expect(
      selectTrainingFitPrompt(
        {
          now,
          trainingStartedAt: 0,
          lastWeeklyFeedbackAt: null,
          lastWeeklyPromptAt: now - DAY_MS,
          lastContextPromptAt: null,
          contextualCandidate: null,
        },
        cfg,
      ),
    ).toBeNull();
    expect(
      selectTrainingFitPrompt(
        {
          now,
          trainingStartedAt: 0,
          lastWeeklyFeedbackAt: null,
          lastWeeklyPromptAt: null,
          lastContextPromptAt: now - DAY_MS,
          contextualCandidate: null,
        },
        cfg,
      ),
    ).toBeNull();

    const repeated = selectTrainingFitPrompt(
      {
        now,
        trainingStartedAt: 0,
        lastWeeklyFeedbackAt: null,
        lastWeeklyPromptAt: now - 8 * DAY_MS,
        lastContextPromptAt: null,
        contextualCandidate: {
          activityType: "calculation",
          novel: false,
          problemCount: 2,
        },
      },
      cfg,
    );
    expect(repeated?.kind).toBe("repeated_problem");
    expect(repeated?.soften).toBe(true);
  });
});
