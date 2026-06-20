import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "./tests/e2e",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  use: {
    baseURL: "http://localhost:3000",
    trace: "on-first-retry",
  },
  webServer: {
    // Production server; CI builds first. Locally, `npm run build` then `npm run test:e2e`.
    command: "npm run start",
    url: "http://localhost:3000",
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
    env: {
      AUTH_SECRET: process.env.AUTH_SECRET ?? "e2e-placeholder-secret",
      DATABASE_URL:
        process.env.DATABASE_URL ??
        "postgresql://user:pass@localhost:5432/db?schema=public",
    },
  },
});
