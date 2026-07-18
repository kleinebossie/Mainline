import { expect, test as base, type Page } from "@playwright/test";

import {
  SEEDED_USERS,
  type PrimarySeededUser,
  type SecondarySeededUser,
} from "../setup/database";

interface AuthenticatedFixtures {
  primaryUser: PrimarySeededUser;
  secondaryUser: SecondarySeededUser;
  secondaryPage: Page;
}

export const test = base.extend<AuthenticatedFixtures>({
  primaryUser: async ({}, provide) => {
    await provide(SEEDED_USERS.primary);
  },
  secondaryUser: async ({}, provide) => {
    await provide(SEEDED_USERS.secondary);
  },
  secondaryPage: async ({ browser, baseURL }, provide) => {
    const context = await browser.newContext({
      baseURL,
      storageState: SEEDED_USERS.secondary.storageStatePath,
    });
    const page = await context.newPage();
    await provide(page);
    await context.close();
  },
});

export { expect };
