import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  clearGuestSession,
  generateGuestProgram,
  getGuestSession,
  hasGuestData,
  recordGuestActivityEvent,
  saveGuestBaseline,
  saveGuestConstraints,
  updateGuestProgramItemStatus,
  DEFAULT_GUEST_CONSTRAINTS,
  DEFAULT_GUEST_BASELINE,
} from "@/lib/guest-session";

describe("guest-session", () => {
  let store: Record<string, string> = {};

  beforeEach(() => {
    store = {};
    const mockStorage = {
      getItem: vi.fn((key: string) => store[key] ?? null),
      setItem: vi.fn((key: string, val: string) => {
        store[key] = String(val);
      }),
      removeItem: vi.fn((key: string) => {
        delete store[key];
      }),
      clear: vi.fn(() => {
        store = {};
      }),
    };
    vi.stubGlobal("localStorage", mockStorage);
    vi.stubGlobal("window", { localStorage: mockStorage });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("returns default empty session when storage is empty", () => {
    const session = getGuestSession();
    expect(session.baseline).toBeNull();
    expect(session.constraints).toBeNull();
    expect(session.program).toBeNull();
    expect(hasGuestData()).toBe(false);
  });

  it("saves baseline and marks guest data present", () => {
    saveGuestBaseline({
      username: "testplayer",
      platform: "lichess",
      tacticalRatingEstimate: 1520,
    });
    expect(hasGuestData()).toBe(true);
    const session = getGuestSession();
    expect(session.baseline?.username).toBe("testplayer");
    expect(session.baseline?.tacticalRatingEstimate).toBe(1520);
  });

  it("saves constraints and generates guest program", () => {
    saveGuestConstraints(DEFAULT_GUEST_CONSTRAINTS);
    const program = generateGuestProgram();
    expect(program.id).toBeDefined();
    expect(program.items.length).toBeGreaterThan(0);
    expect(program.items[0]?.status).toBe("pending");
  });

  it("updates item status and records activity event", () => {
    saveGuestConstraints(DEFAULT_GUEST_CONSTRAINTS);
    const program = generateGuestProgram();
    const firstItemId = program.items[0]?.id ?? "item1";

    recordGuestActivityEvent({
      type: "drill_done",
      programItemId: firstItemId,
      payload: { correct: true, solveTimeMs: 4200 },
    });

    const session = getGuestSession();
    expect(session.activityEvents.length).toBe(1);
    expect(session.program?.items[0]?.status).toBe("done");

    updateGuestProgramItemStatus(firstItemId, "skipped");
    const updated = getGuestSession();
    expect(updated.program?.items[0]?.status).toBe("skipped");
  });

  it("clears guest session completely", () => {
    saveGuestBaseline(DEFAULT_GUEST_BASELINE);
    expect(hasGuestData()).toBe(true);
    clearGuestSession();
    expect(hasGuestData()).toBe(false);
  });

  it("detects guest session from storage or cookies", async () => {
    const { isGuestSession } = await import("@/lib/guest-session");
    expect(isGuestSession()).toBe(false);

    saveGuestBaseline(DEFAULT_GUEST_BASELINE);
    expect(isGuestSession()).toBe(true);

    clearGuestSession();
    expect(isGuestSession()).toBe(false);

    vi.stubGlobal("document", { cookie: "mainline_guest=1" });
    expect(isGuestSession()).toBe(true);
  });
});
