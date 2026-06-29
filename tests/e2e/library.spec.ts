import { test, expect } from "@playwright/test";

// M14 e2e (the part that needs no live OAuth/DB). /library is auth-gated, so it redirects to
// sign-in when unauthenticated. The full signed-in journey — see band-appropriate book
// recommendations + the book-study protocol, get physical-board / tournament-simulation
// guidance when OTB-focused, and log a book session that feeds the next session — needs a
// session + DB and is verified manually with a Lichess test account (BUILD.md §13.5), as in
// M1/M2/M4/M5 and the M11–M13 authenticated flows. The book-session loop, the ResourceProgress
// roll-up, the per-band recommendation block rule, and the targetFocus gating are pinned by the
// deterministic unit/server tests instead.
test("/library redirects to sign-in when unauthenticated", async ({ page }) => {
  await page.goto("/library");
  await expect(page).toHaveURL(/\/signin/);
  await expect(
    page.getByRole("button", { name: /Continue with Lichess/i }),
  ).toBeVisible();
});
