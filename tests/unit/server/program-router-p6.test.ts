import { beforeEach, describe, expect, it, vi } from "vitest";

const program = vi.hoisted(() => ({
  generateAndSaveProgram: vi.fn(),
  getGameSignals: vi.fn(),
  getTodayProgram: vi.fn(),
  prepareProgram: vi.fn(),
  toTodayItem: vi.fn(),
}));
const profile = vi.hoisted(() => ({
  resolveTacticalRating: vi.fn(),
}));
const focus = vi.hoisted(() => ({
  getWeeklyFocus: vi.fn(),
  recommendationForPersistedFocus: vi.fn(),
  selectPersistedFocusChoice: vi.fn(),
}));
const forecast = vi.hoisted(() => ({
  getAvailabilityOverrides: vi.fn(),
  getForecast: vi.fn(),
  getProgramRevisions: vi.fn(),
  getWeeklyAvailability: vi.fn(),
  hasStartedToday: vi.fn(),
  refreshForecast: vi.fn(),
  removeAvailabilityOverride: vi.fn(),
  saveAvailabilityOverride: vi.fn(),
  saveWeeklyAvailability: vi.fn(),
}));

vi.mock("@/server/program", () => program);
vi.mock("@/server/profile", () => profile);
vi.mock("@/server/weekly-focus", () => focus);
vi.mock("@/server/program-forecast", () => forecast);

import { programRouter } from "@/server/routers/program";

function caller() {
  return programRouter.createCaller({
    session: { user: { id: "u1" }, expires: "2099-01-01" },
    prisma: {
      user: {
        findUnique: vi.fn().mockResolvedValue({
          deletedAt: null,
          betaAccessGrantedAt: new Date("2026-07-01T00:00:00Z"),
        }),
      },
    },
  } as never);
}

describe("P6 program router orchestration", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    program.getTodayProgram.mockResolvedValue({ id: "today" });
    forecast.refreshForecast.mockResolvedValue([]);
    forecast.getAvailabilityOverrides.mockResolvedValue([]);
    forecast.hasStartedToday.mockResolvedValue(true);
    program.prepareProgram.mockResolvedValue({
      forecastSource: { methodologyVersion: "research-1.1.0", items: [] },
    });
    focus.selectPersistedFocusChoice.mockResolvedValue({
      id: "focus-2",
      focusAreas: ["calculation"],
    });
    focus.recommendationForPersistedFocus.mockReturnValue({
      focusAreas: ["time_mgmt"],
      supportingSignals: [],
      rationale: {
        text: "Provisional recommendation.",
        grade: "C",
        tier: 1,
        citationKey: "weakness_diagnosis",
        soften: true,
      },
    });
  });

  it("delegates ordinary Generate to the transactionally guarded save", async () => {
    await expect(caller().generate()).resolves.toEqual({ id: "today" });
    expect(program.generateAndSaveProgram).toHaveBeenCalledWith(
      expect.anything(),
      "u1",
      undefined,
      {
        preventStartedReplacement: true,
        reuseExistingDate: true,
        forecast: { trigger: "generation", preserveCommittedToday: false },
      },
    );
  });

  it.each([
    {
      action: "availability",
      run: () =>
        caller().saveAvailability({
          mode: "flexible",
          preferredWeekdays: [],
          defaultMinutesByDay: {},
        }),
    },
    {
      action: "override",
      run: () =>
        caller().saveAvailabilityOverride({
          date: Date.parse("2026-07-13T00:00:00Z"),
          minutes: null,
          unavailable: true,
        }),
    },
    {
      action: "override removal",
      run: () =>
        caller().removeAvailabilityOverride({
          date: Date.parse("2026-07-13T00:00:00Z"),
        }),
    },
  ])("preserves committed Today for $action changes", async ({ run }) => {
    await run();
    expect(program.generateAndSaveProgram).not.toHaveBeenCalled();
    expect(forecast.refreshForecast).toHaveBeenCalledWith(
      expect.anything(),
      "u1",
      undefined,
      expect.any(String),
      true,
    );
  });

  it("defers a focus alternative from replacing started Today", async () => {
    await caller().selectFocus({
      weeklyFocusId: "focus-1",
      focusAreas: ["calculation"],
    });
    expect(focus.selectPersistedFocusChoice).toHaveBeenCalled();
    expect(program.generateAndSaveProgram).not.toHaveBeenCalled();
    expect(forecast.refreshForecast).toHaveBeenCalledWith(
      expect.anything(),
      "u1",
      undefined,
      "focus_choice",
      true,
      expect.objectContaining({ methodologyVersion: "research-1.1.0" }),
    );
  });

  it("allows only explicit Replan to replace committed Today", async () => {
    await caller().replan();
    expect(program.generateAndSaveProgram).toHaveBeenCalledWith(
      expect.anything(),
      "u1",
      undefined,
      {
        preserveCompletedToday: true,
        forecast: {
          trigger: "explicit_replan",
          preserveCommittedToday: false,
        },
      },
    );
  });

  it("exposes the typed append-only revision read side", async () => {
    forecast.getProgramRevisions.mockResolvedValue({
      revisions: [],
      nextCursor: null,
    });
    await expect(caller().revisions({ limit: 12 })).resolves.toEqual({
      revisions: [],
      nextCursor: null,
    });
    expect(forecast.getProgramRevisions).toHaveBeenCalledWith(
      expect.anything(),
      "u1",
      { limit: 12 },
    );
  });

  it("accepts the forward direction added by tRPC infinite queries", async () => {
    forecast.getProgramRevisions.mockResolvedValue({
      revisions: [],
      nextCursor: null,
    });
    await expect(
      caller().revisions({ limit: 20, direction: "forward" }),
    ).resolves.toEqual({ revisions: [], nextCursor: null });
    expect(forecast.getProgramRevisions).toHaveBeenCalledWith(
      expect.anything(),
      "u1",
      { limit: 20, direction: "forward" },
    );
  });

  it("returns methodology-owned display labels for focus ids", async () => {
    focus.getWeeklyFocus.mockResolvedValue({
      id: "focus-1",
      methodologyVersion: "research-1.3.0",
      focusAreas: ["time_mgmt"],
    });

    await expect(caller().weeklyFocus()).resolves.toMatchObject({
      focusLabels: { time_mgmt: "Time management" },
      recommendation: { focusAreas: ["time_mgmt"] },
    });
  });

  it("reports a saved focus separately from a failed forecast refresh", async () => {
    forecast.refreshForecast.mockRejectedValueOnce(
      new Error("forecast failed"),
    );

    await expect(
      caller().selectFocus({
        weeklyFocusId: "focus-1",
        focusAreas: ["calculation"],
      }),
    ).resolves.toMatchObject({
      focus: { id: "focus-2" },
      forecastUpdated: false,
    });
  });
});
