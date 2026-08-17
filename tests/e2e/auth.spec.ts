import { test, expect } from "@playwright/test";

// M1 e2e (the parts that need no live OAuth/DB). Lichess login requires no secret,
// so the sign-in option always renders. The full OAuth round-trip + connection
// creation is verified manually with a Lichess test account (BUILD.md §13.5).

test("sign-in page offers Lichess", async ({ page }) => {
  await page.goto("/signin");
  await expect(page.getByText(/open beta/i)).toBeVisible();
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
    .filter({ hasText: "Access denied" });
  await expect(errorNotice).toContainText("Access denied");
  await expect(errorNotice).toContainText(
    "This account could not be signed in",
  );
  await expect(
    page.getByRole("button", { name: /Continue with Lichess/i }),
  ).toBeVisible();
});

test("connections page opens for unauthenticated visitors in guest mode", async ({
  page,
}) => {
  await page.goto("/connections");
  await expect(page).toHaveURL(/\/connections/);
  await expect(
    page.getByRole("heading", { name: "Connections" }),
  ).toBeVisible();
});

test("home starts onboarding and offers sign-in directly", async ({ page }) => {
  await page.goto("/");
  await expect(
    page.getByRole("heading", { name: /Stop guessing what to train/i }),
  ).toBeVisible();
  await expect(page.getByRole("link", { name: /Get started/i })).toBeVisible();
  await expect(page.getByText(/open beta/i).first()).toBeVisible();
  await expect(
    page.getByRole("button", { name: /Continue with Lichess/i }),
  ).toBeVisible();
});
