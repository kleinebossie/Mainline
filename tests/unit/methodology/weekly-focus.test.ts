import { describe, expect, it } from "vitest";

import {
  loadMethodology,
  selectWeeklyFocus,
  shouldReviseWeeklyFocus,
} from "@/methodology";

const cfg = loadMethodology("research-1.1.0");
const base = {
  latestSkillState: [
    {
      dimension: "calculation",
      estimate: 0.6,
      uncertainty: 0.2,
      sampleSize: 10,
    },
  ],
  weaknessSignals: [],
  dueWork: [],
  goals: [{ kind: "rating" as const, label: "Reach 1800" }],
  constraints: { minutesPerDay: 30, daysPerWeek: 5 },
  ownedResources: [],
  activityRecency: { lastEventAtByType: {}, skipsByType: {} },
  trainingPreferences: { preferences: { enjoyment: {}, frictionTags: [] } },
};

describe("weekly focus methodology", () => {
  it("is deterministic and translates rating goals into bounded process focuses", () => {
    const first = selectWeeklyFocus(base, cfg);
    expect(selectWeeklyFocus(base, cfg)).toEqual(first);
    expect(first.focusAreas).not.toContain("rating");
    expect(
      first.focusAreas.every((id) => cfg.dimensions.some((d) => d.id === id)),
    ).toBe(true);
    expect(
      first.alternatives.every((a) =>
        cfg.dimensions.some((d) => d.id === a.focusArea),
      ),
    ).toBe(true);
  });

  it("ignores one low-confidence signal but responds to a confidence crossing", () => {
    const low = {
      ...base,
      weaknessSignals: [
        {
          dimension: "endgames",
          severity: 1,
          confidence: "low" as const,
          sampleSize: 2,
          evidenceGrade: "C" as const,
          evidenceTier: 1 as const,
          citationKey: "weakness_diagnosis",
          rationaleKey: "endgame",
        },
      ],
    };
    expect(selectWeeklyFocus(low, cfg).focusAreas).toEqual(
      selectWeeklyFocus(base, cfg).focusAreas,
    );
    const medium = {
      ...low,
      weaknessSignals: low.weaknessSignals.map((s) => ({
        ...s,
        confidence: "medium" as const,
        sampleSize: 20,
      })),
    };
    expect(selectWeeklyFocus(medium, cfg).focusAreas[0]).toBe("endgames");
  });

  it("offers only unselected structural goal candidates with snapshotted support", () => {
    const selection = selectWeeklyFocus(
      {
        ...base,
        goals: [{ kind: "openings" as const, label: "Anything" }],
        latestSkillState: [
          {
            dimension: "tactics",
            estimate: 0,
            uncertainty: 0.2,
            sampleSize: 10,
          },
        ],
        weaknessSignals: [
          {
            dimension: "endgames",
            severity: 1,
            confidence: "high" as const,
            sampleSize: 30,
            evidenceGrade: "C" as const,
            evidenceTier: 1 as const,
            citationKey: "weakness_diagnosis",
            rationaleKey: "endgame",
          },
        ],
      },
      cfg,
    );
    expect(selection.alternatives).toEqual([
      expect.objectContaining({
        focusArea: "openings",
        score: expect.any(Number),
        supportingSources: expect.arrayContaining(["process goal:openings"]),
      }),
    ]);
  });

  it("offers no alternative when there is no configured goal-aligned candidate", () => {
    expect(selectWeeklyFocus({ ...base, goals: [] }, cfg).alternatives).toEqual(
      [],
    );
    expect(
      selectWeeklyFocus(
        { ...base, goals: [{ kind: "fun" as const, label: "Enjoy it" }] },
        cfg,
      ).alternatives,
    ).toEqual([]);
  });

  it("revises for meaningful changes but not isolated noise", () => {
    const stable = {
      ageDays: 1,
      previousConstraints: base.constraints,
      nextConstraints: base.constraints,
      previousSignals: [],
      nextSignals: [],
      previousSkillState: [{ dimension: "tactics", estimate: 0.5 }],
      nextSkillState: [{ dimension: "tactics", estimate: 0.51 }],
    };
    expect(shouldReviseWeeklyFocus(stable, cfg).revise).toBe(false);
    expect(
      shouldReviseWeeklyFocus(
        {
          ...stable,
          nextConstraints: { ...base.constraints, minutesPerDay: 40 },
        },
        cfg,
      ).reason,
    ).toBe("constraints");
  });
});
