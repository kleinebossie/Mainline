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
