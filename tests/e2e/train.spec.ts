import { test, expect } from "@playwright/test";

test("train page demo solves mate in 1 puzzle", async ({ page }) => {
  // Go to the training demo page
  await page.goto("/train");

  // Verify header exists
  await expect(
    page.getByRole("heading", { name: "Practice board" }),
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

test("train page plays a known endgame drill to a winning result", async ({
  page,
}) => {
  await page.goto("/train");

  // Switch to the M13 endgame-drill demo (King + Queen vs King, mate in 1).
  await page.getByRole("button", { name: "Endgame drill" }).click();

  const status = page.locator("#endgame-status");
  await expect(status).toHaveText("Playing… your move");

  // 1. Qa7# — select the queen on g7, then play to a7 (checkmate ends the play-out).
  await page.locator('[data-square="g7"]').click();
  await page.locator('[data-square="a7"]').click();

  // The position is played out vs the engine and judged against the "win" objective.
  await expect(status).toHaveText("✓ Endgame won!");
});
