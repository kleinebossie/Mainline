import { describe, it, expect } from "vitest";

import { fixedClock, systemClock } from "@/lib/clock";

describe("Clock", () => {
  it("systemClock returns a positive epoch-ms timestamp", () => {
    const t = systemClock.now();
    expect(typeof t).toBe("number");
    expect(t).toBeGreaterThan(0);
  });

  it("fixedClock is deterministic (supports golden tests, L2)", () => {
    const clock = fixedClock(1_700_000_000_000);
    expect(clock.now()).toBe(1_700_000_000_000);
    expect(clock.now()).toBe(1_700_000_000_000);
  });
});
