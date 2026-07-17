import { describe, expect, it } from "vitest";

import {
  allottedTrainingMs,
  formatTrainingCountdown,
  trainingDeadlineMs,
  trainingTimeRemainingMs,
} from "@/lib/training-timer";

describe("training timer", () => {
  it("uses the allocated program minutes as the session cap", () => {
    expect(allottedTrainingMs(5)).toBe(300_000);
    expect(trainingDeadlineMs(10_000, 5)).toBe(310_000);
  });

  it("omits a countdown when no positive allocation exists", () => {
    expect(allottedTrainingMs(null)).toBeNull();
    expect(allottedTrainingMs(0)).toBeNull();
    expect(allottedTrainingMs(Number.NaN)).toBeNull();
  });

  it("catches up after a delayed browser tick and stops at zero", () => {
    expect(trainingTimeRemainingMs(310_000, 70_000)).toBe(240_000);
    expect(trainingTimeRemainingMs(310_000, 400_000)).toBe(0);
  });

  it("formats partial seconds without showing zero too early", () => {
    expect(formatTrainingCountdown(300_000)).toBe("5:00");
    expect(formatTrainingCountdown(299_001)).toBe("5:00");
    expect(formatTrainingCountdown(299_000)).toBe("4:59");
    expect(formatTrainingCountdown(1)).toBe("0:01");
    expect(formatTrainingCountdown(0)).toBe("0:00");
  });
});
