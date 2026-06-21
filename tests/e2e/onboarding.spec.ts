import { test, expect } from "@playwright/test";

// M4 e2e (the parts that need no live OAuth/DB). The onboarding steps are all
// auth-gated, so they redirect to sign-in when unauthenticated. The full signed-in
// flow — complete calibration + save constraints — needs a session + DB and is verified
// manually with a Lichess test account (BUILD.md §13.5), as in M1/M2.
const GATED = [
  "/onboarding",
  "/onboarding/calibration",
  "/onboarding/constraints",
  "/onboarding/reveal",
];

for (const path of GATED) {
  test(`${path} redirects to sign-in when unauthenticated`, async ({ page }) => {
    await page.goto(path);
    await expect(page).toHaveURL(/\/signin/);
    await expect(
      page.getByRole("button", { name: /Continue with Lichess/i }),
    ).toBeVisible();
  });
}
