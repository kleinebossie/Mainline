import { test, expect } from "@playwright/test";

// Settings is auth-gated (edit-your-plan + data export/erase). Unauthenticated → sign-in.
// The signed-in round-trip (edit constraints → regenerate Today) needs a session + DB and
// is verified manually with a Lichess test account (BUILD.md §13.5).
test("/settings redirects to sign-in when unauthenticated", async ({ page }) => {
  await page.goto("/settings");
  await expect(page).toHaveURL(/\/signin/);
  await expect(
    page.getByRole("button", { name: /Continue with Lichess/i }),
  ).toBeVisible();
});
