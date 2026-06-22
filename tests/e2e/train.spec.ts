import { test, expect } from "@playwright/test";

test("train page demo solves mate in 1 puzzle", async ({ page }) => {
  // Go to the training demo page
  await page.goto("/train");

  // Verify header exists
  await expect(
    page.getByRole("heading", { name: "Interactive Substrate Demo" }),
  ).toBeVisible();

  // Verify status is initially pending
  const status = page.locator("#solving-status");
  await expect(status).toHaveText("Pending User Move...");

  // Click on a1 (where the White Rook starts in the mate-in-1 FEN) to select it
  await page.locator('[data-square="a1"]').click();

  // Click on a8 (the correct destination for Ra8#)
  await page.locator('[data-square="a8"]').click();

  // Verify the solving status changes to Solved!
  await expect(status).toHaveText("✓ Solved!");
});
