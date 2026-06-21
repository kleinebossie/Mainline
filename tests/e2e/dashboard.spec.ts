import { test, expect } from "@playwright/test";

// M2 e2e (the parts that need no live OAuth/DB). The full import → dashboard
// round-trip is verified manually with a real connection (BUILD.md §13.5 / M2 DoD),
// since CI has no platform credentials.

test("dashboard redirects to sign-in when unauthenticated", async ({
  page,
}) => {
  await page.goto("/dashboard");
  await expect(page).toHaveURL(/\/signin/);
  await expect(
    page.getByRole("button", { name: /Continue with Lichess/i }),
  ).toBeVisible();
});
