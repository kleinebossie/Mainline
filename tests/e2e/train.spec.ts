import { test, expect } from "@playwright/test";

const GUEST_STORAGE_KEY = "mainline_guest_session_data";

function createGuestSessionFixture() {
  return {
    baseline: {
      tacticalRatingEstimate: 1400,
      uncertainty: 150,
      platform: "lichess",
      username: "testguest",
    },
    constraints: {
      minutesPerDay: 20,
      daysPerWeek: 5,
      formatPrefs: {
        formats: ["rapid"],
        preferredVariety: false,
        targetFocus: "online",
      },
      goals: [],
      ownedResources: [],
    },
    program: {
      id: "guest-test-program",
      createdAt: new Date().toISOString(),
      scheduledDate: new Date().toISOString(),
      methodologyVersion: "v1",
      items: [
        {
          id: "guest-block-1",
          orderIndex: 0,
          activityId: "blunder_drill",
          activityType: "blunder_drill",
          label: "Blunder defense",
          estMinutes: 5,
          params: {},
          dimensionsTargeted: ["defense"],
          rationaleKey: "blunder_defense",
          rationaleText: "Drilling blunders prevents repeat tactical mistakes.",
          evidenceGrade: "A",
          evidenceTier: 1,
          citationKey: "de_groot_1965",
          confidence: "high",
          soften: false,
          status: "pending",
        },
        {
          id: "guest-block-2",
          orderIndex: 1,
          activityId: "tactics_drill",
          activityType: "tactics_drill",
          label: "Tactics practice",
          estMinutes: 10,
          params: {},
          dimensionsTargeted: ["calculation"],
          rationaleKey: "tactics_practice",
          rationaleText: "Tactics drills sharpen pattern recognition.",
          evidenceGrade: "A",
          evidenceTier: 1,
          citationKey: "ericsson_1993",
          confidence: "high",
          soften: false,
          status: "pending",
        },
      ],
    },
    activityEvents: [],
    updatedAt: new Date().toISOString(),
  };
}

test.describe("training focus mode", () => {
  test("phone viewport fits within single screen (390 x 844) without scrolling in light and dark mode", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 390, height: 844 });

    // Test in light mode.
    await page.addInitScript(
      ({ storageKey, sessionData, theme }) => {
        window.localStorage.setItem(storageKey, JSON.stringify(sessionData));
        window.localStorage.setItem("mainline_theme", theme);
      },
      {
        storageKey: GUEST_STORAGE_KEY,
        sessionData: createGuestSessionFixture(),
        theme: "light",
      },
    );

    await page.goto("/train/guest-block-1");
    await expect(page.getByRole("heading", { name: /to move/i })).toBeVisible();

    // Verify focus mode hides top bar navigation and bottom tab bar.
    await expect(page.getByRole("navigation")).toHaveCount(0);

    // Verify phone screen fits without vertical or horizontal scroll.
    const lightScrollHeight = await page.evaluate(
      () => document.documentElement.scrollHeight,
    );
    const lightScrollWidth = await page.evaluate(
      () => document.documentElement.scrollWidth,
    );
    expect(lightScrollHeight).toBeLessThanOrEqual(844);
    expect(lightScrollWidth).toBeLessThanOrEqual(390);

    // Test in dark mode.
    await page.evaluate(() => {
      window.localStorage.setItem("mainline_theme", "dark");
      document.documentElement.classList.add("dark");
    });
    await expect(page.locator("html")).toHaveClass(/dark/);

    const darkScrollHeight = await page.evaluate(
      () => document.documentElement.scrollHeight,
    );
    const darkScrollWidth = await page.evaluate(
      () => document.documentElement.scrollWidth,
    );
    expect(darkScrollHeight).toBeLessThanOrEqual(844);
    expect(darkScrollWidth).toBeLessThanOrEqual(390);
  });

  test("desktop layout renders 2-column view with board left and control panel right", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1280, height: 800 });

    await page.addInitScript(
      ({ storageKey, sessionData }) => {
        window.localStorage.setItem(storageKey, JSON.stringify(sessionData));
      },
      {
        storageKey: GUEST_STORAGE_KEY,
        sessionData: createGuestSessionFixture(),
      },
    );

    await page.goto("/train/guest-block-1");
    await expect(page.getByRole("heading", { name: /to move/i })).toBeVisible();

    const boardColumn = page.getByTestId("focus-board-column");
    const panelColumn = page.getByTestId("focus-panel-column");
    await expect(boardColumn).toBeVisible();
    await expect(panelColumn).toBeVisible();

    const boardBox = await boardColumn.boundingBox();
    const panelBox = await panelColumn.boundingBox();
    expect(boardBox).not.toBeNull();
    expect(panelBox).not.toBeNull();

    // Board sits on the left of the panel in desktop view.
    expect(boardBox!.x + boardBox!.width).toBeLessThanOrEqual(panelBox!.x + 10);
  });

  test("timer is hidden by default and toggles on demand", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1280, height: 800 });

    await page.addInitScript(
      ({ storageKey, sessionData }) => {
        window.localStorage.setItem(storageKey, JSON.stringify(sessionData));
        window.localStorage.removeItem("mainline_show_time");
      },
      {
        storageKey: GUEST_STORAGE_KEY,
        sessionData: createGuestSessionFixture(),
      },
    );

    await page.goto("/train/guest-block-1");
    await expect(page.getByRole("heading", { name: /to move/i })).toBeVisible();

    // Progress text is visible.
    await expect(page.getByText(/1 of 2/)).toBeVisible();

    // Timer is hidden by default.
    const timer = page.getByTitle("Elapsed puzzle time");
    await expect(timer).toHaveCount(0);

    // Toggle timer on.
    const toggleButton = page.getByRole("button", { name: "Show timer" });
    await expect(toggleButton).toBeVisible();
    await toggleButton.click();
    await expect(timer).toBeVisible();

    // Toggle timer off.
    const hideButton = page.getByRole("button", { name: "Hide timer" });
    await expect(hideButton).toBeVisible();
    await hideButton.click();
    await expect(timer).toHaveCount(0);
  });

  test("executes move, shows move badge, and advances to in-between screen", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1280, height: 800 });

    await page.addInitScript(
      ({ storageKey, sessionData }) => {
        window.localStorage.setItem(storageKey, JSON.stringify(sessionData));
      },
      {
        storageKey: GUEST_STORAGE_KEY,
        sessionData: createGuestSessionFixture(),
      },
    );

    await page.goto("/train/guest-block-1");
    await expect(page.getByRole("heading", { name: /to move/i })).toBeVisible();

    // First puzzle in blunder drill: move rook from d1 to d8.
    await page.locator("#interactive-board-square-d1").click();
    await page.locator("#interactive-board-square-d8").click();

    // Correct badge appears on destination square.
    await expect(page.getByTestId("board-move-badge-correct")).toBeVisible();
    await expect(page.getByText("Solved", { exact: true })).toBeVisible();

    // Click Next to load the second puzzle.
    const nextButton = page.getByRole("button", { name: /Next/i });
    await expect(nextButton).toBeVisible();
    await nextButton.click();

    // Second puzzle in blunder drill: move pawn from d3 to e4.
    await expect(page.getByText(/2 of 2/)).toBeVisible();
    await page.locator("#interactive-board-square-d3").click();
    await page.locator("#interactive-board-square-e4").click();

    // Correct badge appears.
    await expect(page.getByTestId("board-move-badge-correct")).toBeVisible();
    await expect(page.getByText("Solved", { exact: true })).toBeVisible();

    // Click Continue to finish the block.
    const continueButton = page.getByRole("button", { name: /Continue/i });
    await expect(continueButton).toBeVisible();
    await continueButton.click();

    // In-between screen appears.
    await expect(
      page.getByRole("heading", { name: "Block complete" }),
    ).toBeVisible();
    await expect(page.getByText("Up next")).toBeVisible();
    await expect(page.getByText(/Tactics practice/)).toBeVisible();

    // Advance to the next block directly without visiting /today.
    const continueToNextBlock = page.getByRole("button", {
      name: "Continue",
    });
    await expect(continueToNextBlock).toBeVisible();
    await continueToNextBlock.click();

    await expect(page).toHaveURL(/\/train\/guest-block-2$/);
    await expect(page.getByRole("heading", { name: /to move/i })).toBeVisible();
  });

  test("in-between screen allows returning to Today", async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });

    await page.addInitScript(
      ({ storageKey, sessionData }) => {
        window.localStorage.setItem(storageKey, JSON.stringify(sessionData));
      },
      {
        storageKey: GUEST_STORAGE_KEY,
        sessionData: createGuestSessionFixture(),
      },
    );

    await page.goto("/train/guest-block-1");
    await expect(page.getByRole("heading", { name: /to move/i })).toBeVisible();

    // Solve first puzzle.
    await page.locator("#interactive-board-square-d1").click();
    await page.locator("#interactive-board-square-d8").click();
    await page.getByRole("button", { name: /Next/i }).click();

    // Solve second puzzle.
    await page.locator("#interactive-board-square-d3").click();
    await page.locator("#interactive-board-square-e4").click();
    await page.getByRole("button", { name: /Continue/i }).click();

    // In-between screen appears. Click Back to Today.
    await expect(
      page.getByRole("heading", { name: "Block complete" }),
    ).toBeVisible();
    const backToToday = page.getByRole("button", { name: "Back to Today" });
    await expect(backToToday).toBeVisible();
    await backToToday.click();

    await expect(page).toHaveURL(/\/today$/);
  });
});
