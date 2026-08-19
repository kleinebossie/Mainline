import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { trackFunnelEvent } from "@/lib/telemetry";
import * as analytics from "@vercel/analytics";

vi.mock("@vercel/analytics", () => ({
  track: vi.fn(),
}));

describe("trackFunnelEvent", () => {
  beforeEach(() => {
    vi.stubGlobal("window", {});
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("tracks event when window is defined", () => {
    const trackSpy = vi.spyOn(analytics, "track");
    trackFunnelEvent("landing_view", { referrer: "reddit" });
    expect(trackSpy).toHaveBeenCalledWith("landing_view", {
      referrer: "reddit",
    });
  });

  it("handles events without properties", () => {
    const trackSpy = vi.spyOn(analytics, "track");
    trackFunnelEvent("day1_session_started");
    expect(trackSpy).toHaveBeenCalledWith("day1_session_started");
  });
});
