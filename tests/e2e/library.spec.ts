import { test, expect } from "@playwright/test";

// Phase 1 library e2e: unauthenticated visitors can view /library in guest mode.
test("/library opens for unauthenticated visitors in guest mode", async ({
  page,
}) => {
  await page.goto("/library");
  await expect(page).toHaveURL(/\/library/);
  await expect(page.getByRole("heading", { name: /Library/i })).toBeVisible();
});
