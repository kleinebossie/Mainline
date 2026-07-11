import { expect, test } from "@playwright/test";

test("PWA manifest and service worker are installable without caching private routes", async ({
  page,
  request,
}) => {
  const manifestResponse = await request.get("/manifest.webmanifest");
  expect(manifestResponse.ok()).toBe(true);
  const manifest = await manifestResponse.json();
  expect(manifest).toMatchObject({
    name: "Mainline: the honest chess training program",
    short_name: "Mainline",
    start_url: "/today",
    display: "standalone",
  });
  expect(manifest.icons).toEqual(
    expect.arrayContaining([
      expect.objectContaining({ sizes: "192x192", type: "image/png" }),
      expect.objectContaining({ sizes: "512x512", type: "image/png" }),
    ]),
  );

  const workerResponse = await request.get("/sw.js");
  expect(workerResponse.ok()).toBe(true);
  expect(workerResponse.headers()["cache-control"]).toContain("no-cache");
  expect(workerResponse.headers()["service-worker-allowed"]).toBe("/");
  const worker = await workerResponse.text();
  expect(worker).toContain('"/_next/static/"');
  expect(worker).not.toContain('"/api/"');

  await page.goto("/");
  await expect
    .poll(() =>
      page.evaluate(async () => {
        const registration = await navigator.serviceWorker.getRegistration();
        return registration?.scope ?? null;
      }),
    )
    .toContain("/");
});

test("Stockfish cross-origin isolation headers remain enabled", async ({
  request,
}) => {
  const response = await request.get("/train");
  expect(response.headers()["cross-origin-opener-policy"]).toBe("same-origin");
  expect(response.headers()["cross-origin-embedder-policy"]).toBe(
    "require-corp",
  );
});

test("daily operations fail closed without the cron secret", async ({
  request,
}) => {
  const response = await request.get("/api/cron/daily");
  expect(response.status()).toBe(401);
});
