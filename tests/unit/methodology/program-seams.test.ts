import { describe, expect, it } from "vitest";

import { loadMethodology } from "@/methodology/loader";
import {
  bandForRating,
  confidenceFromSampleSize,
  interpretGameFeatures,
  mapWeaknessToActivities,
  practiceStructure,
  prioritizeDailyMix,
  rationaleFor,
  targetPuzzleRating,
  useWorkedExample,
  type CandidateActivity,
  type WeaknessSignal,
} from "@/methodology/provider";
import type { RawGameFeatures } from "@/lib/raw-features";

// Golden tests for the M6 program-engine seams (BUILD.md §13.1): fixed inputs + a pinned
// config version → exact output, including evidence grades + rationale keys (L3).
const cfg = loadMethodology("stub-0.1.0");

/** A RawGameFeatures with only the fields Seam 3 reads filled in (others are zeroed). */
function game(moves: { cpBefore: number; cpLoss: number }[]): RawGameFeatures {
  return {
    acplOverall: 0,
    acplByPhase: { opening: 0, middlegame: 0, endgame: 0 },
    phaseBoundaries: { openingEndsPly: 0, endgameStartsPly: 0 },
    moveEvals: moves.map((m, i) => ({
      ply: i,
      cpBefore: m.cpBefore,
      cpAfter: m.cpBefore - m.cpLoss,
      cpLoss: m.cpLoss,
    })),
    blunders: [],
    errorCounts: {
      inaccuracies: 0,
      mistakes: 0,
      blunders: 0,
      grossBlunders: 0,
    },
  };
}

const repeat = <T>(n: number, v: T): T[] => Array.from({ length: n }, () => v);
// 3 blunders (≥150cp) + 2 clean moves per game → blunder rate 0.6 over considered moves.
const blunderyGame = game([
  { cpBefore: 0, cpLoss: 200 },
  { cpBefore: 0, cpLoss: 200 },
  { cpBefore: 0, cpLoss: 200 },
  { cpBefore: 0, cpLoss: 0 },
  { cpBefore: 0, cpLoss: 0 },
]);
const cleanGame = game(repeat(5, { cpBefore: 0, cpLoss: 0 }));

describe("bandForRating", () => {
  it("maps a rating to the band whose [min, max) contains it", () => {
    expect(bandForRating(799, cfg)).toBe("u800");
    expect(bandForRating(800, cfg)).toBe("b800_1200");
    expect(bandForRating(1300, cfg)).toBe("b1200_1600");
    expect(bandForRating(2199, cfg)).toBe("b2000_2200");
    expect(bandForRating(2200, cfg)).toBe("b2200plus");
  });
});

describe("confidenceFromSampleSize (blunderRate gates 20/35/50)", () => {
  it("steps insufficient → low → medium → high", () => {
    expect(confidenceFromSampleSize(10, "blunderRate", cfg)).toBe(
      "insufficient",
    );
    expect(confidenceFromSampleSize(20, "blunderRate", cfg)).toBe("low");
    expect(confidenceFromSampleSize(40, "blunderRate", cfg)).toBe("medium");
    expect(confidenceFromSampleSize(60, "blunderRate", cfg)).toBe("high");
  });
});

describe("interpretGameFeatures (blunder-rate signal)", () => {
  it("emits nothing below the sample-size gate (insufficient data is honest)", () => {
    expect(
      interpretGameFeatures(
        { features: repeat(10, blunderyGame), band: "b800_1200" },
        cfg,
      ),
    ).toEqual([]);
  });

  it("emits nothing when the rate is within the band baseline×multiplier", () => {
    expect(
      interpretGameFeatures(
        { features: repeat(20, cleanGame), band: "b800_1200" },
        cfg,
      ),
    ).toEqual([]);
  });

  it("flags board_vision with the grade from its rationale entry (L3)", () => {
    const signals = interpretGameFeatures(
      { features: repeat(20, blunderyGame), band: "b800_1200" },
      cfg,
    );
    // rate 0.6 vs threshold 0.15×1.2=0.18 → severity clamp(0.6/0.18−1)=1.
    expect(signals).toEqual([
      {
        dimension: "board_vision",
        severity: 1,
        confidence: "low", // 20 games → low
        sampleSize: 20,
        evidenceGrade: "C",
        evidenceTier: 1,
        citationKey: "smith_tikkanen2018",
        rationaleKey: "blunder_focus",
      },
    ]);
  });

  it("excludes already-decided positions from the rate", () => {
    // Every move is a 300cp drop but in a position already won (cpBefore 700 > 600) →
    // excluded → no considered moves → no weakness.
    const decided = game(repeat(5, { cpBefore: 700, cpLoss: 300 }));
    expect(
      interpretGameFeatures(
        { features: repeat(20, decided), band: "b800_1200" },
        cfg,
      ),
    ).toEqual([]);
  });
});

describe("targetPuzzleRating (servo)", () => {
  it("uses the band seed offset when there is no measured success", () => {
    const t = targetPuzzleRating(
      { userRating: 1300, track: "pattern", band: "b1200_1600" },
      cfg,
    );
    expect(t).toEqual({
      ratingTarget: 1150, // 1300 + (−150 seed)
      successTarget: 0.8,
      track: "pattern",
      evidenceGrade: "B",
      evidenceTier: 2,
      citationKey: "wilson2019",
      flag: "semi-evidenced",
    });
  });

  it("applies the beginner motivational success target on the pattern track", () => {
    const t = targetPuzzleRating(
      { userRating: 700, track: "pattern", band: "u800" },
      cfg,
    );
    expect(t.successTarget).toBe(0.9);
    expect(t.ratingTarget).toBe(600); // 700 + (−100 seed)
    expect(t.evidenceGrade).toBe("C");
  });

  it("nudges harder when recent success exceeds the target", () => {
    const t = targetPuzzleRating(
      {
        userRating: 1300,
        track: "pattern",
        band: "b1200_1600",
        recentSuccess: 0.9,
      },
      cfg,
    );
    // −150 + (0.9−0.8)×400 = −110 → 1190 (harder than the 1150 seed-only target).
    expect(t.ratingTarget).toBe(1190);
  });
});

describe("practiceStructure / useWorkedExample", () => {
  it("returns the per-band structure, forcing blocked for an unmastered motif", () => {
    expect(practiceStructure({ band: "u800" }, cfg)).toBe("blocked");
    expect(practiceStructure({ band: "b1200_1600" }, cfg)).toBe("clustered");
    expect(practiceStructure({ band: "b1600_2000" }, cfg)).toBe("interleaved");
    expect(
      practiceStructure({ band: "b1600_2000", motifMastery: 0.5 }, cfg),
    ).toBe("blocked");
  });

  it("shows a worked example for beginner bands or high-complexity items", () => {
    expect(useWorkedExample({ band: "u800" }, cfg)).toBe(true);
    expect(useWorkedExample({ band: "b1200_1600", complexity: 0 }, cfg)).toBe(
      false,
    );
    expect(useWorkedExample({ band: "b1200_1600", complexity: 0.8 }, cfg)).toBe(
      true,
    );
  });
});

describe("mapWeaknessToActivities", () => {
  it("gathers band candidates and elevates the activity a weakness rule targets", () => {
    const signal: WeaknessSignal = {
      dimension: "board_vision",
      severity: 1,
      confidence: "medium",
      sampleSize: 40,
      evidenceGrade: "C",
      evidenceTier: 1,
      citationKey: "smith_tikkanen2018",
      rationaleKey: "blunder_focus",
    };
    const candidates = mapWeaknessToActivities(
      { signals: [signal], band: "b1200_1600" },
      cfg,
    );
    const tactics = candidates.find((c) => c.activityId === "themed_tactics")!;
    expect(tactics.resourceTheme).toBe("hangingPiece"); // rule override
    expect(tactics.rationaleKey).toBe("blunder_focus");
    expect(tactics.drivingSignal).toEqual(signal);
    // Non-targeted activities keep their defaults.
    const play = candidates.find((c) => c.activityId === "play_games")!;
    expect(play.drivingSignal).toBeNull();
    expect(play.resourceTheme).toBeNull();
  });

  it("omits activities with zero band priority (none in the stub above u800 baseline)", () => {
    const candidates = mapWeaknessToActivities(
      { signals: [], band: "u800" },
      cfg,
    );
    // At <800 every activity still has priority ≥1 in the stub, so all six appear.
    expect(candidates.map((c) => c.activityId).sort()).toEqual([
      "analyse_own_games",
      "calculation_drill",
      "endgame_study",
      "play_games",
      "spaced_review",
      "themed_tactics",
    ]);
  });
});

describe("prioritizeDailyMix", () => {
  const candidate = (
    activityId: string,
    activityType: string,
    priority: number,
    drivingSignal: WeaknessSignal | null = null,
  ): CandidateActivity => ({
    activityId,
    activityType,
    label: activityId,
    resourceTheme: null,
    dimensionsTargeted: [],
    track: null,
    estMinutes: 10,
    priority,
    rationaleKey: "play_games",
    drivingSignal,
  });

  it("scores ROI prior, drops spaced-review when nothing is due, orders deterministically", () => {
    const ordered = prioritizeDailyMix(
      {
        candidates: [
          candidate("play_games", "play_game", 3),
          candidate("analyse_own_games", "analyse", 3),
          candidate("spaced_review", "spaced_review", 3),
          candidate("endgame_study", "study", 2),
        ],
        dueItems: [],
      },
      cfg,
    );
    expect(ordered.map((c) => c.activityId)).toEqual([
      "analyse_own_games", // tie at 3 → id asc
      "play_games",
      "endgame_study", // spaced_review dropped (nothing due)
    ]);
  });

  it("a weakness severity pulls the elevated activity to the top", () => {
    const signal: WeaknessSignal = {
      dimension: "board_vision",
      severity: 1,
      confidence: "medium",
      sampleSize: 40,
      evidenceGrade: "C",
      evidenceTier: 1,
      citationKey: "smith_tikkanen2018",
      rationaleKey: "blunder_focus",
    };
    const ordered = prioritizeDailyMix(
      {
        candidates: [
          candidate("play_games", "play_game", 3),
          candidate("themed_tactics", "puzzle_theme", 3, signal),
        ],
        dueItems: [],
      },
      cfg,
    );
    // themed_tactics: 1×3 + 3×1 = 6 vs play_games 3.
    expect(ordered[0]!.activityId).toBe("themed_tactics");
    expect(ordered[0]!.score).toBe(6);
  });
});

describe("rationaleFor", () => {
  it("returns the entry and throws (fail-closed) on an unknown key", () => {
    const r = rationaleFor("blunder_focus", cfg);
    expect(r.grade).toBe("C");
    expect(r.soften).toBe(true);
    expect(() => rationaleFor("no_such_key", cfg)).toThrow(/No rationale/);
  });
});
