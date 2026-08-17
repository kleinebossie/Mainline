import { test, expect } from "@playwright/test";

// Phase 1 train e2e: unauthenticated visitors can view /train in guest mode.
test("/train opens for unauthenticated visitors in guest mode", async ({ page }) => {
  await page.goto("/train");
  await expect(page).toHaveURL(/\/train/);
  await expect(
    page.getByRole("heading", { name: /Practice board/i }),
  ).toBeVisible();
});
