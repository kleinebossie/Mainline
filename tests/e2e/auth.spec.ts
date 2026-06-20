import { test, expect } from "@playwright/test";

// M1 e2e (the parts that need no live OAuth/DB). Lichess login requires no secret,
// so the sign-in option always renders. The full OAuth round-trip + connection
// creation is verified manually with a Lichess test account (BUILD.md §13.5).

test("sign-in page offers Lichess", async ({ page }) => {
  await page.goto("/signin");
  await expect(
    page.getByRole("button", { name: /Continue with Lichess/i }),
  ).toBeVisible();
});

test("connections page redirects to sign-in when unauthenticated", async ({
  page,
}) => {
  await page.goto("/connections");
  await expect(page).toHaveURL(/\/signin/);
  await expect(
    page.getByRole("button", { name: /Continue with Lichess/i }),
  ).toBeVisible();
});

test("home links into the get-started flow", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("link", { name: /Get started/i })).toBeVisible();
});
