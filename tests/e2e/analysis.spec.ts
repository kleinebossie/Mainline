import { test, expect } from "@playwright/test";

// Phase 1 game analysis e2e: unauthenticated visitors can access /analysis in guest mode.
test("/analysis opens for unauthenticated visitors in guest mode", async ({
  page,
}) => {
  await page.goto("/analysis");
  await expect(page).toHaveURL(/\/analysis/);
  await expect(
    page.getByRole("heading", { name: /Review your games/i }),
  ).toBeVisible();
});
