import { test, expect } from "@playwright/test";

// M1 e2e (the parts that need no live OAuth/DB). Lichess login requires no secret,
// so the sign-in option always renders. The full OAuth round-trip + connection
// creation is verified manually with a Lichess test account (BUILD.md §13.5).

test("sign-in page offers Lichess", async ({ page }) => {
  await page.goto("/signin");
  await expect(page.getByText(/closed beta/i)).toBeVisible();
  await expect(page.getByLabel(/invite code/i).first()).toBeVisible();
  await expect(
    page.getByRole("button", { name: /Continue with Lichess/i }),
  ).toBeVisible();
});

test("sign-in callback errors explain what the user can do next", async ({
  page,
}) => {
  await page.goto("/signin?error=AccessDenied");
  const errorNotice = page
    .getByRole("alert")
    .filter({ hasText: "Beta access not granted" });
  await expect(errorNotice).toContainText("Beta access not granted");
  await expect(errorNotice).toContainText("Check the code and try again");
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

test("home starts onboarding and offers sign-in directly", async ({ page }) => {
  await page.goto("/");
  await expect(
    page.getByRole("heading", { name: /Stop guessing what to train/i }),
  ).toBeVisible();
  await expect(page.getByRole("link", { name: /Get started/i })).toBeVisible();
  await expect(page.getByText(/invite required/i)).toBeVisible();
  await expect(page.getByLabel(/^Invite code$/i)).toBeVisible();
  await expect(
    page.getByRole("button", { name: /Continue with Lichess/i }),
  ).toBeVisible();
});
