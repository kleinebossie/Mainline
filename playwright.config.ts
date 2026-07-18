import { defineConfig } from "@playwright/test";

import {
  requireDisposablePlaywrightDatabaseUrl,
  SEEDED_USERS,
} from "./tests/e2e/setup/database";

const port = Number(process.env.PLAYWRIGHT_PORT ?? "3000");
const baseURL = `http://localhost:${port}`;
const playwrightDatabaseUrl = requireDisposablePlaywrightDatabaseUrl();

export default defineConfig({
  testDir: "./tests/e2e",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  globalSetup: "./tests/e2e/setup/global.ts",
  projects: [
    {
      name: "unauthenticated",
      testIgnore: "**/authenticated/**/*.spec.ts",
      use: { storageState: { cookies: [], origins: [] } },
    },
    {
      name: "authenticated",
      testMatch: "**/authenticated/**/*.spec.ts",
      // Authenticated acceptance specs share one disposable database. A single
      // worker keeps destructive lifecycle and recovery drills isolated by file.
      workers: 1,
      use: { storageState: SEEDED_USERS.primary.storageStatePath },
    },
  ],
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
      AUTH_URL: baseURL,
      DATABASE_URL: playwrightDatabaseUrl,
    },
  },
});
