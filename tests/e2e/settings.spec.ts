import { test, expect } from "@playwright/test";

// Settings is accessible in guest mode (plan adjustments, feedback, analysis, and local data export).
test("/settings opens for unauthenticated visitors in guest mode", async ({
  page,
}) => {
  await page.goto("/settings");
  await expect(page).toHaveURL(/\/settings$/);
  await expect(page.getByRole("heading", { name: "Settings" })).toBeVisible();
  await expect(page.getByText("Your plan", { exact: true })).toBeVisible();
  await expect(page.getByText("Feedback", { exact: true })).toBeVisible();
  await expect(
    page.getByText("Privacy and your data", { exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: /Export local data/i }),
  ).toBeVisible();
});
