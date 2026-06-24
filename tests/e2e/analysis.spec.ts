import { test, expect } from "@playwright/test";

// M10 game analysis e2e (unauthenticated path). Like other pages in this codebase,
// full signed-in flow requires active database session + OAuth configuration,
// so unauthenticated redirect to the Lichess login page is checked in CI.
test("/analysis redirects to sign-in when unauthenticated", async ({ page }) => {
  await page.goto("/analysis");
  await expect(page).toHaveURL(/\/signin/);
  await expect(
    page.getByRole("button", { name: /Continue with Lichess/i }),
  ).toBeVisible();
});

test("/analysis/[gameId] redirects to sign-in when unauthenticated", async ({ page }) => {
  await page.goto("/analysis/game-1234");
  await expect(page).toHaveURL(/\/signin/);
  await expect(
    page.getByRole("button", { name: /Continue with Lichess/i }),
  ).toBeVisible();
});

// M12 — the interactive game review (eval graph + blunder drills) is auth-gated too.
test("/analysis/[gameId]/review redirects to sign-in when unauthenticated", async ({
  page,
}) => {
  await page.goto("/analysis/game-1234/review");
  await expect(page).toHaveURL(/\/signin/);
  await expect(
    page.getByRole("button", { name: /Continue with Lichess/i }),
  ).toBeVisible();
});
