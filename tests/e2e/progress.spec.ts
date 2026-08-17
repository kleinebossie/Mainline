import { test, expect } from "@playwright/test";

// Phase 1 progress e2e: unauthenticated visitors can view /progress in guest mode.
test("progress opens for unauthenticated visitors in guest mode", async ({ page }) => {
  await page.goto("/progress");
  await expect(page).toHaveURL(/\/progress/);
  await expect(page.getByRole("heading", { name: /Progress/i })).toBeVisible();
});
