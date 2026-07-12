import { test, expect } from "@playwright/test";

// The /train page is now auth-gated (server component wrapper). The functional
// demo tests (mate-in-1 puzzle, endgame drill) need an authenticated session
// and are verified manually with a Lichess test account (BUILD.md §13.5), as
// with the other signed-in journeys.
test("/train redirects to sign-in when unauthenticated", async ({ page }) => {
  await page.goto("/train");
  await expect(page).toHaveURL(/\/signin/);
  await expect(
    page.getByRole("button", { name: /Continue with Lichess/i }),
  ).toBeVisible();
});
