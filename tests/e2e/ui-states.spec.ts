import { execFileSync } from "node:child_process";
import { resolve } from "node:path";

import { expect, test, type Page, type TestInfo } from "@playwright/test";

type UiState =
  | "today-progress"
  | "today-done"
  | "today-mixed"
  | "setup"
  | "first-session-ready"
  | "first-session-pending"
  | "first-session-error"
  | "history-grouped"
  | "error-notices"
  | "unexpected-error"
  | "unavailable-training-block";

function renderState(state: UiState): string {
  return execFileSync(
    resolve("node_modules/.bin/tsx"),
    [resolve("tests/e2e/fixtures/render-ui-state.tsx"), state],
    { encoding: "utf8" },
  );
}

async function mountWithAppStyles(page: Page, markup: string) {
  await page.goto("/");
  const assets = await page
    .locator('link[rel="stylesheet"]')
    .evaluateAll((links) =>
      links.map((link) => (link as HTMLLinkElement).href),
    );
  const rootClass = await page.locator("html").getAttribute("class");
  await page.setContent(
    `<!doctype html><html class="${rootClass ?? ""}"><head>${assets
      .map((href) => `<link rel="stylesheet" href="${href}">`)
      .join(
        "",
      )}</head><body class="bg-paper min-h-screen text-ink antialiased">${markup}</body></html>`,
    { waitUntil: "networkidle" },
  );
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.evaluate(() => document.fonts.ready);
}

async function expectNoPageOverflow(page: Page) {
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth + 1,
    ),
  ).toBe(true);
}

async function capture(page: Page, testInfo: TestInfo, name: string) {
  await page.screenshot({
    path: testInfo.outputPath(`${name}.png`),
    fullPage: true,
  });
}

test("Today states stay clear and responsive", async ({ page }, testInfo) => {
  await page.setViewportSize({ width: 1365, height: 900 });
  await mountWithAppStyles(page, renderState("today-progress"));

  await expect(page.getByText("Session in progress").first()).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Update plan" }),
  ).toBeDisabled();
  await expect(page.getByRole("button", { name: "Undo skip" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "History" })).toBeVisible();
  await expect(page.getByText("Next 7 days", { exact: true })).toHaveCount(0);
  await expect(page.getByText("Plan settings", { exact: true })).toHaveCount(0);
  await expect(page.getByText("No training history yet.")).toBeVisible();
  await expect(
    page.getByText("Positive fit feedback broke an equal methodology tie."),
  ).toBeVisible();
  await expect(
    page.getByText(
      "Best-guess delivery rule, not evidence that this activity works better.",
    ),
  ).toBeVisible();
  await expectNoPageOverflow(page);
  await capture(page, testInfo, "today-desktop");

  await page.setViewportSize({ width: 390, height: 844 });
  await expectNoPageOverflow(page);
  await expect(page.getByRole("heading", { name: "History" })).toBeVisible();
  await capture(page, testInfo, "today-mobile");

  await mountWithAppStyles(page, renderState("today-done"));
  await expect(
    page.getByText("All training complete", { exact: true }),
  ).toBeVisible();

  await mountWithAppStyles(page, renderState("today-mixed"));
  await expect(
    page.getByText("Session finished with skips", { exact: true }),
  ).toBeVisible();
});

test("Setup separates overall and required progress", async ({
  page,
}, testInfo) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await mountWithAppStyles(page, renderState("setup"));

  await expect(
    page.getByText("3 of 5 steps done", { exact: true }),
  ).toBeVisible();
  await expect(
    page.getByText("Your first daily training session is ready", {
      exact: true,
    }),
  ).toBeVisible();
  await expect(
    page.getByText("See where you stand", { exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("link", { name: "Start Today's session →" }),
  ).toBeVisible();
  await expectNoPageOverflow(page);
  await capture(page, testInfo, "setup-mobile");
});

test("First-session activation matches its promised action", async ({
  page,
}, testInfo) => {
  await page.setViewportSize({ width: 1365, height: 900 });
  await mountWithAppStyles(page, renderState("first-session-ready"));

  await expect(
    page.getByRole("button", { name: "Build my first session" }),
  ).toBeEnabled();
  await expect(
    page.getByRole("link", { name: "Build my first session" }),
  ).toHaveCount(0);
  await expectNoPageOverflow(page);
  await capture(page, testInfo, "first-session-ready-desktop");

  await mountWithAppStyles(page, renderState("first-session-pending"));
  const pending = page.getByRole("button", {
    name: "Building your session...",
  });
  await expect(pending).toBeDisabled();
  await expect(pending).toHaveAttribute("aria-busy", "true");

  await mountWithAppStyles(page, renderState("first-session-error"));
  await expect(
    page.getByText("First session not built", { exact: true }),
  ).toBeVisible();
  await expect(page.getByText("Your setup is saved.")).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Try building again" }),
  ).toBeEnabled();
  await expectNoPageOverflow(page);

  await page.setViewportSize({ width: 390, height: 844 });
  await expectNoPageOverflow(page);
  await expect(
    page.getByRole("button", { name: "Try building again" }),
  ).toBeVisible();
  await capture(page, testInfo, "first-session-error-mobile");
});

test("History groups same-day plan versions under one session", async ({
  page,
}, testInfo) => {
  await page.setViewportSize({ width: 1365, height: 900 });
  await mountWithAppStyles(page, renderState("history-grouped"));

  await expect(page.getByText("Sun, Jul 5", { exact: true })).toHaveCount(1);
  await expect(
    page.getByText("4 plan versions", { exact: true }),
  ).toBeVisible();
  await page.getByText("Sun, Jul 5", { exact: true }).click();
  await expect(page.getByText("Earlier plan", { exact: true })).toHaveCount(4);
  await expectNoPageOverflow(page);
  await capture(page, testInfo, "history-grouped-desktop");

  await page.setViewportSize({ width: 390, height: 844 });
  await expect(page.getByText("Sun, Jul 5", { exact: true })).toHaveCount(1);
  await expectNoPageOverflow(page);
  await capture(page, testInfo, "history-grouped-mobile");
});

test("Error notices explain recovery without exposing internal detail", async ({
  page,
}, testInfo) => {
  await page.setViewportSize({ width: 1365, height: 900 });
  await mountWithAppStyles(page, renderState("error-notices"));

  await expect(page.getByRole("alert")).toHaveCount(3);
  await expect(
    page.getByRole("heading", {
      name: "Clear next moves when a line stops",
    }),
  ).toBeVisible();
  await expect(page.getByText("Your saved work is safe.")).toBeVisible();
  await expect(page.getByText("The page changed")).toBeVisible();
  await expect(page.getByText("Connection lost")).toBeVisible();
  await expect(page.getByText(/private database host/i)).toHaveCount(0);
  await expect(
    page.getByRole("button", { name: "Reload session" }),
  ).toBeEnabled();
  await expect(
    page.getByRole("button", { name: "Trying again…" }),
  ).toBeDisabled();
  await page.getByRole("button", { name: "Reload session" }).focus();
  await expect(
    page.getByRole("button", { name: "Reload session" }),
  ).toBeFocused();
  await expectNoPageOverflow(page);
  await capture(page, testInfo, "error-notices-desktop");

  await page.setViewportSize({ width: 390, height: 844 });
  await expect(page.getByRole("alert")).toHaveCount(3);
  await expectNoPageOverflow(page);
  await capture(page, testInfo, "error-notices-mobile");
});

test("Unexpected error page offers retry and a safe way back", async ({
  page,
}, testInfo) => {
  await page.setViewportSize({ width: 1365, height: 900 });
  await mountWithAppStyles(page, renderState("unexpected-error"));

  await expect(
    page.getByText("Line interrupted", { exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", {
      name: "This page could not finish loading.",
    }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Try this page again" }),
  ).toBeVisible();
  await expect(
    page.getByRole("link", { name: "Return to Today" }),
  ).toHaveAttribute("href", "/today");
  await expect(page.getByText("Reference: qa-safe-reference")).toBeVisible();
  await expect(page.getByText(/private exception text/i)).toHaveCount(0);
  await expectNoPageOverflow(page);
  await capture(page, testInfo, "unexpected-error-desktop");

  await page.setViewportSize({ width: 390, height: 844 });
  await expectNoPageOverflow(page);
  await expect(
    page.getByRole("button", { name: "Try this page again" }),
  ).toBeVisible();
  await capture(page, testInfo, "unexpected-error-mobile");
});

test("Unavailable training blocks have an honest recovery path", async ({
  page,
}, testInfo) => {
  await page.setViewportSize({ width: 1365, height: 900 });
  await mountWithAppStyles(page, renderState("unavailable-training-block"));

  await expect(
    page.getByRole("heading", {
      name: "This block has no positions left to train.",
    }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Skip unavailable block" }),
  ).toBeEnabled();
  await expect(
    page.getByRole("link", { name: "Back without changing" }),
  ).toHaveAttribute("href", "/today");
  await expect(
    page.getByText(/without counting as completed training/),
  ).toBeVisible();
  await expectNoPageOverflow(page);
  await capture(page, testInfo, "unavailable-training-block-desktop");

  await page.setViewportSize({ width: 390, height: 844 });
  await expectNoPageOverflow(page);
  await expect(
    page.getByRole("button", { name: "Skip unavailable block" }),
  ).toBeVisible();
  await capture(page, testInfo, "unavailable-training-block-mobile");
});
