import { test, expect } from "@playwright/test";

// M6 e2e (the part that needs no live OAuth/DB). /today is auth-gated, so it redirects to
// sign-in when unauthenticated. The full signed-in journey — onboarding → generate first
// program → see graded items on /today — needs a session + DB and is verified manually
// with a Lichess test account (BUILD.md §13.5), as in M1/M2/M4/M5.
test("/today redirects to sign-in when unauthenticated", async ({ page }) => {
  await page.goto("/today");
  await expect(page).toHaveURL(/\/signin/);
  await expect(
    page.getByRole("button", { name: /Continue with Lichess/i }),
  ).toBeVisible();
});
