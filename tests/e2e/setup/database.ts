import { resolve } from "node:path";
import { encode } from "next-auth/jwt";

const LOCAL_DATABASE_HOSTS = new Set([
  "127.0.0.1",
  "localhost",
  "::1",
  "[::1]",
]);
const DISPOSABLE_DATABASE_NAME = /(^|[-_])(e2e|playwright)([-_]|$)/i;

export const AUTHJS_SESSION_COOKIE = "authjs.session-token";
export const AUTH_STATE_DIRECTORY = resolve("test-results", "auth");
export const PLAYWRIGHT_AUTH_SECRET =
  process.env.AUTH_SECRET ??
  "e2e-placeholder-secret-must-be-at-least-32-chars-long";

export async function encodePlaywrightSessionToken(
  user: { id: string; email?: string | null; name?: string | null } | string,
): Promise<string> {
  const userId = typeof user === "string" ? user : user.id;
  const email = typeof user === "string" ? undefined : (user.email ?? undefined);
  const name = typeof user === "string" ? undefined : (user.name ?? undefined);
  return encode({
    token: { id: userId, sub: userId, email, name },
    secret: PLAYWRIGHT_AUTH_SECRET,
    salt: AUTHJS_SESSION_COOKIE,
  });
}

export const SEEDED_USERS = {
  primary: {
    id: "playwright-user-primary",
    name: "Playwright Primary",
    email: "primary@mainline.playwright.invalid",
    sessionId: "playwright-session-primary",
    sessionToken: "playwright-database-session-primary",
    allowlistId: "playwright-beta-grant-primary",
    connectionId: "playwright-connection-primary",
    assessmentId: "playwright-assessment-primary",
    constraintId: "playwright-constraints-primary",
    storageStatePath: resolve(AUTH_STATE_DIRECTORY, "primary.json"),
  },
  secondary: {
    id: "playwright-user-secondary",
    name: "Playwright Secondary",
    email: "secondary@mainline.playwright.invalid",
    sessionId: "playwright-session-secondary",
    sessionToken: "playwright-database-session-secondary",
    allowlistId: "playwright-beta-grant-secondary",
    connectionId: "playwright-connection-secondary",
    assessmentId: "playwright-assessment-secondary",
    constraintId: "playwright-constraints-secondary",
    programId: "playwright-program-secondary",
    programItemId: "playwright-program-item-secondary",
    storageStatePath: resolve(AUTH_STATE_DIRECTORY, "secondary.json"),
  },
  coreLoop: {
    id: "playwright-user-core-loop",
    name: "Playwright Core Loop",
    email: "core-loop@mainline.playwright.invalid",
    sessionId: "playwright-session-core-loop",
    sessionToken: "playwright-database-session-core-loop",
    allowlistId: "playwright-beta-grant-core-loop",
    connectionId: "playwright-connection-core-loop",
    puzzleId: "playwright-core-loop-puzzle",
    storageStatePath: resolve(AUTH_STATE_DIRECTORY, "core-loop.json"),
  },
} as const;

export type SeededUser =
  | typeof SEEDED_USERS.primary
  | typeof SEEDED_USERS.secondary
  | typeof SEEDED_USERS.coreLoop;
export type PrimarySeededUser = typeof SEEDED_USERS.primary;
export type SecondarySeededUser = typeof SEEDED_USERS.secondary;
export type CoreLoopSeededUser = typeof SEEDED_USERS.coreLoop;

/**
 * E2E setup performs destructive fixture replacement. Keep it limited to an
 * explicitly named, local PostgreSQL database with an e2e or playwright marker.
 */
export function requireDisposablePlaywrightDatabaseUrl(): string {
  const value = process.env.PLAYWRIGHT_DATABASE_URL;
  if (!value) {
    throw new Error(
      "PLAYWRIGHT_DATABASE_URL is required. Point it at a disposable local PostgreSQL database whose name contains e2e or playwright.",
    );
  }

  let url: URL;
  try {
    url = new URL(value);
  } catch {
    throw new Error("PLAYWRIGHT_DATABASE_URL must be a valid PostgreSQL URL.");
  }

  if (url.protocol !== "postgresql:" && url.protocol !== "postgres:") {
    throw new Error("PLAYWRIGHT_DATABASE_URL must use PostgreSQL.");
  }
  if (!LOCAL_DATABASE_HOSTS.has(url.hostname)) {
    throw new Error(
      "PLAYWRIGHT_DATABASE_URL must target localhost so test setup cannot mutate a remote database.",
    );
  }

  const databaseName = decodeURIComponent(url.pathname.replace(/^\//, ""));
  if (!databaseName || !DISPOSABLE_DATABASE_NAME.test(databaseName)) {
    throw new Error(
      "PLAYWRIGHT_DATABASE_URL must name a disposable database containing e2e or playwright.",
    );
  }

  return value;
}
