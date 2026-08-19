import { test, expect } from "@playwright/test";

// Phase 1 today e2e: unauthenticated visitors can view /today in guest mode.
test("/today opens for unauthenticated visitors in guest mode", async ({
  page,
}) => {
  await page.goto("/today");
  await expect(page).toHaveURL(/\/today/);
  await expect(page.getByRole("heading", { name: /Today/i })).toBeVisible();
});
