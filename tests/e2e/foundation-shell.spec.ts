import { test, expect, type Page } from "@playwright/test";

async function setupGuestSession(page: Page) {
  await page.context().addCookies([
    {
      name: "mainline_guest",
      value: "1",
      domain: "localhost",
      path: "/",
    },
  ]);

  await page.addInitScript(() => {
    const guestData = {
      baseline: {
        tacticalRatingEstimate: 1450,
        uncertainty: 350,
        username: "Guest",
      },
      constraints: {
        minutesPerDay: 20,
        daysPerWeek: 5,
        formatPrefs: {
          formats: ["rapid", "blitz"],
          preferredVariety: false,
          targetFocus: "online",
        },
        goals: ["improve_tactics"],
        ownedResources: [],
      },
      program: {
        id: "guest_program_foundation_test",
        createdAt: new Date().toISOString(),
        scheduledDate: new Date().toISOString(),
        methodologyVersion: "1.1",
        items: [
          {
            id: "guest_item_0",
            orderIndex: 0,
            activityId: "puzzle_session",
            activityType: "puzzle_session",
            label: "Tactical Pattern Recognition",
            estMinutes: 10,
            params: {},
            dimensionsTargeted: ["tactics"],
            rationaleKey: "puzzle_difficulty",
            rationaleText:
              "We target roughly 80-85% success as a starting point.",
            evidenceGrade: "A",
            evidenceTier: 1,
            citationKey: "charness1981",
            citationSource: "Charness (1981)",
            confidence: "high",
            soften: false,
            status: "pending",
          },
        ],
      },
      activityEvents: [],
      updatedAt: new Date().toISOString(),
    };
    window.localStorage.setItem(
      "mainline_guest_session_data",
      JSON.stringify(guestData),
    );
  });
}

async function expectNoHorizontalOverflow(page: Page) {
  const hasNoOverflow = await page.evaluate(
    () => document.documentElement.scrollWidth <= window.innerWidth + 1,
  );
  expect(hasNoOverflow).toBe(true);
}

test.describe("Foundation App Shell and Visual Systems", () => {
  test("desktop layout renders top bar and hides phone bottom nav", async ({
    page,
  }) => {
    await setupGuestSession(page);
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto("/today");

    // Wordmark accessible name verification
    const wordmark = page.getByRole("link", { name: "Mainline" });
    await expect(wordmark).toBeVisible();

    // Primary navigation tabs on desktop
    const desktopNav = page.getByRole("navigation", {
      name: "Primary navigation",
    });
    await expect(desktopNav).toBeVisible();
    await expect(desktopNav.getByRole("link", { name: "Today" })).toBeVisible();
    await expect(
      desktopNav.getByRole("link", { name: "Analysis" }),
    ).toBeVisible();
    await expect(
      desktopNav.getByRole("link", { name: "Library" }),
    ).toBeVisible();
    await expect(
      desktopNav.getByRole("link", { name: "Progress" }),
    ).toBeVisible();

    // Phone bottom tab bar must be hidden on desktop
    const mobileNav = page.getByRole("navigation", {
      name: "Mobile navigation",
    });
    await expect(mobileNav).toBeHidden();

    // Verify zero horizontal overflow
    await expectNoHorizontalOverflow(page);
  });

  test("phone layout renders bottom tab bar and hides desktop tabs", async ({
    page,
  }) => {
    await setupGuestSession(page);
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/today");

    // Wordmark in mobile top bar
    const wordmark = page.getByRole("link", { name: "Mainline" });
    await expect(wordmark).toBeVisible();

    // Desktop nav must be hidden on phone
    const desktopNav = page.getByRole("navigation", {
      name: "Primary navigation",
    });
    await expect(desktopNav).toBeHidden();

    // Mobile navigation tab bar must be visible with 4 primary tabs
    const mobileNav = page.getByRole("navigation", {
      name: "Mobile navigation",
    });
    await expect(mobileNav).toBeVisible();
    await expect(mobileNav.getByRole("link", { name: "Today" })).toBeVisible();
    await expect(
      mobileNav.getByRole("link", { name: "Analysis" }),
    ).toBeVisible();
    await expect(
      mobileNav.getByRole("link", { name: "Library" }),
    ).toBeVisible();
    await expect(
      mobileNav.getByRole("link", { name: "Progress" }),
    ).toBeVisible();

    // Verify zero horizontal overflow
    await expectNoHorizontalOverflow(page);
  });

  test("theme switching toggles light and dark mode classes", async ({
    page,
  }) => {
    await setupGuestSession(page);
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto("/today");

    // Open account menu
    const accountButton = page.getByRole("button", { name: "Account menu" });
    await expect(accountButton).toBeVisible();
    await accountButton.click();

    // Select Dark theme
    const darkOption = page.getByRole("menuitem", { name: "Dark theme" });
    await expect(darkOption).toBeVisible();
    await darkOption.click();

    await expect(page.locator("html")).toHaveClass(/dark/);
    await expectNoHorizontalOverflow(page);

    // Select Light theme
    await accountButton.click();
    const lightOption = page.getByRole("menuitem", { name: "Light theme" });
    await expect(lightOption).toBeVisible();
    await lightOption.click();

    await expect(page.locator("html")).toHaveClass(/light/);
    await expectNoHorizontalOverflow(page);
  });

  test("why button opens sheet with rationale and evidence chip", async ({
    page,
  }) => {
    await setupGuestSession(page);
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto("/today");

    // Find and click the Why button / sheet trigger
    const whyButton = page
      .getByRole("button", { name: /Why this\?|Inspect evidence/i })
      .first();
    await expect(whyButton).toBeVisible();
    await whyButton.click();

    // Verify sheet opens as a modal dialog
    const sheetDialog = page.getByRole("dialog");
    await expect(sheetDialog).toBeVisible();
    await expect(
      page.getByRole("heading", {
        name: /Why this recommendation\?|Recommendation rationale/i,
      }),
    ).toBeVisible();

    // Close sheet
    const closeButton = sheetDialog.getByRole("button", { name: "Close" });
    await expect(closeButton).toBeVisible();
    await closeButton.click();

    await expect(sheetDialog).toBeHidden();
  });
});
