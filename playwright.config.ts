import { defineConfig } from "@playwright/test";

const port = Number(process.env.PLAYWRIGHT_PORT ?? "3000");
const baseURL = `http://localhost:${port}`;

export default defineConfig({
  testDir: "./tests/e2e",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  use: {
    baseURL,
    trace: "on-first-retry",
  },
  webServer: {
    // Production server; CI builds first. Locally, `npm run build` then `npm run test:e2e`.
    command: `npm run start -- -p ${port}`,
    url: baseURL,
    reuseExistingServer: false,
    timeout: 120_000,
    env: {
      AUTH_SECRET: process.env.AUTH_SECRET ?? "e2e-placeholder-secret",
      DATABASE_URL:
        process.env.DATABASE_URL ??
        "postgresql://user:pass@localhost:5432/db?schema=public",
    },
  },
});
