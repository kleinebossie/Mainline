import { test, expect } from "@playwright/test";

// Phase 1 onboarding e2e: unauthenticated visitors can access onboarding in guest mode.
const GUEST_ROUTES = [
  "/onboarding",
  "/onboarding/calibration",
  "/onboarding/constraints",
  "/onboarding/reveal",
];

for (const path of GUEST_ROUTES) {
  test(`${path} opens for unauthenticated visitors in guest mode`, async ({
    page,
  }) => {
    await page.goto(path);
    await expect(page).toHaveURL(new RegExp(path));
  });
}

test("guest can build first session directly from constraints", async ({
  page,
}) => {
  await page.goto("/onboarding/constraints");
  await page.getByRole("button", { name: "Build my first session →" }).click();
  await expect(page).toHaveURL(/\/today$/);
  await expect(page.getByRole("heading", { name: "Today" })).toBeVisible();
  await expect(page.getByText(/Training as Guest/i)).toBeVisible();
  await expect(page.getByText(/SIGN-IN EXPIRED/i)).not.toBeVisible();
});

test("guest can continue setup through connections to calibration", async ({
  page,
}) => {
  await page.goto("/onboarding/constraints");
  await page.getByRole("button", { name: "Continue setup →" }).click();
  await expect(page).toHaveURL(/\/connections$/);
  await page.getByRole("link", { name: "Continue to calibration →" }).click();
  await expect(page).toHaveURL(/\/onboarding\/calibration$/);
});
