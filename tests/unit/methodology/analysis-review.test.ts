// Guided analysis queue methodology readers (TEMP_ANALYSIS_QUEUE_PLAN §6.1).
// Pins the rung boundaries, the null-age fail-safe, and the graded shape of every
// prompt leaf. All values come from config (L1); the readers are pure (L2).

import { describe, expect, it } from "vitest";

import { loadMethodology } from "@/methodology/loader";
import {
  analysisPromptFor,
  analysisPromptRungFor,
  analysisRecallWhy,
  analysisReviewThresholds,
} from "@/methodology/provider";
import { isGradedValue } from "@/methodology/schema/graded";

const HOUR_MS = 3_600_000;
const DAY_MS = 24 * HOUR_MS;

describe("analysis review prompt ladder", () => {
  const cfg = loadMethodology();

  it("exposes graded rung boundaries from config", () => {
    const thresholds = analysisReviewThresholds(cfg);
    expect(thresholds.freshWindowMs).toBe(24 * HOUR_MS);
    expect(thresholds.recentWindowMs).toBe(7 * DAY_MS);
  });

  it("assigns rungs by game age: fresh under 24h, recent to 7d, old beyond", () => {
    expect(analysisPromptRungFor(0, cfg)).toBe("fresh");
    expect(analysisPromptRungFor(23 * HOUR_MS, cfg)).toBe("fresh");
    expect(analysisPromptRungFor(24 * HOUR_MS, cfg)).toBe("recent");
    expect(analysisPromptRungFor(6 * DAY_MS, cfg)).toBe("recent");
    expect(analysisPromptRungFor(7 * DAY_MS, cfg)).toBe("old");
    expect(analysisPromptRungFor(30 * DAY_MS, cfg)).toBe("old");
  });

  it("treats an unknown play time as old so recognition aids always appear", () => {
    expect(analysisPromptRungFor(null, cfg)).toBe("old");
  });

  it("returns a distinct graded prompt per rung", () => {
    const prompts = [
      analysisPromptFor("fresh", cfg),
      analysisPromptFor("recent", cfg),
      analysisPromptFor("old", cfg),
    ];
    for (const prompt of prompts) {
      expect(isGradedValue(prompt)).toBe(true);
      expect(prompt.grade).toBe("C");
      expect(prompt.value.length).toBeGreaterThan(0);
    }
    expect(new Set(prompts.map((p) => p.value)).size).toBe(3);
  });

  it("prompts get less specific as the game gets older", () => {
    // The fresh prompt asks for plan and intent; the old prompt only asks for
    // whatever memory remains. Pin that ordering honestly.
    expect(analysisPromptFor("fresh", cfg).value).toMatch(/plan/i);
    expect(analysisPromptFor("old", cfg).value).toMatch(/remember/i);
    // Prompts never point at page positions; the identity card carries the info.
    expect(analysisPromptFor("old", cfg).value).not.toMatch(/below/i);
  });

  it("carries a graded why-this note for the write-first step (retrieval practice)", () => {
    const why = analysisRecallWhy(cfg);
    expect(isGradedValue(why)).toBe(true);
    expect(why.grade).toBe("C");
    expect(why.citationKey).toBe("roediger2006");
    // Honesty: the note states the evidence boundary, never a chess-specific claim.
    expect(why.value).toMatch(/retrieval practice/i);
    expect(why.value).toMatch(/has not been measured/);
  });
});
