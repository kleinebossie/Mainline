import { expect, test } from "../fixtures/authenticated";

test("session authenticates a beta user", async ({
  page,
  request,
  primaryUser,
}) => {
  const sessionResponse = await request.get("/api/auth/session");
  expect(sessionResponse.ok()).toBe(true);
  await expect(sessionResponse.json()).resolves.toMatchObject({
    user: { id: primaryUser.id, email: primaryUser.email },
  });

  await page.goto("/settings");
  await expect(page).toHaveURL(/\/settings$/);
  await expect(page.getByRole("heading", { name: "Settings" })).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Privacy and your data" }),
  ).toBeVisible();
  await expect(page.getByText(/Status: not consented/i)).toBeVisible();
});

test("one user cannot load another user's training block", async ({
  page,
  secondaryPage,
  secondaryUser,
}) => {
  const path = `/train/${secondaryUser.programItemId}`;

  await page.goto(path);
  const unavailable = page.getByRole("alert").filter({
    hasText:
      "This training block is no longer in your plan. Return to Today for the latest session.",
  });
  await expect(unavailable).toContainText("No longer available");
  await expect(unavailable).toContainText(
    "This training block is no longer in your plan. Return to Today for the latest session.",
  );
  await expect(
    page.getByRole("heading", {
      name: "This block has no positions left to train.",
    }),
  ).toHaveCount(0);

  await secondaryPage.goto(path);
  await expect(
    secondaryPage.getByRole("heading", {
      name: "This block has no positions left to train.",
    }),
  ).toBeVisible();
});
