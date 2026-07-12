import { test, expect } from "@playwright/test";

test("home page loads and shows the app name", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("link", { name: "Mainline" })).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Stop guessing what to train." }),
  ).toBeVisible();
});

test("sign-in submission acknowledges the click within 500ms", async ({
  page,
}) => {
  await page.goto("/");
  await page.route("**/*", async (route) => {
    if (route.request().method() !== "POST") {
      await route.continue();
      return;
    }
    await new Promise((resolve) => setTimeout(resolve, 1_000));
    await route.abort();
  });

  const submit = page.locator('button[name="provider"][value="lichess"]');
  await submit.click({ noWaitAfter: true });
  await expect(submit).toHaveText("Opening Lichess…", { timeout: 500 });
});
