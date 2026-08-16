import { describe, expect, it } from "vitest";
import { decode } from "next-auth/jwt";

import {
  AUTHJS_SESSION_COOKIE,
  encodePlaywrightSessionToken,
  PLAYWRIGHT_AUTH_SECRET,
  SEEDED_USERS,
} from "../../e2e/setup/database";

describe("auth session and token helpers", () => {
  it("encodes onboarded flag into JWT token when specified", async () => {
    const tokenStr = await encodePlaywrightSessionToken({
      id: "user-onboarded",
      email: "onboarded@example.com",
      name: "Onboarded Player",
      onboarded: true,
    });
    const decoded = await decode({
      token: tokenStr,
      secret: PLAYWRIGHT_AUTH_SECRET,
      salt: AUTHJS_SESSION_COOKIE,
    });
    expect(decoded).toMatchObject({
      id: "user-onboarded",
      email: "onboarded@example.com",
      name: "Onboarded Player",
      onboarded: true,
    });
  });

  it("omits onboarded flag when string id is passed", async () => {
    const tokenStr = await encodePlaywrightSessionToken("user-un-onboarded");
    const decoded = await decode({
      token: tokenStr,
      secret: PLAYWRIGHT_AUTH_SECRET,
      salt: AUTHJS_SESSION_COOKIE,
    });
    expect(decoded).toMatchObject({
      id: "user-un-onboarded",
    });
    expect(decoded?.onboarded).toBeUndefined();
  });

  it("marks primary and secondary seeded users as onboarded", () => {
    expect(SEEDED_USERS.primary.onboarded).toBe(true);
    expect(SEEDED_USERS.secondary.onboarded).toBe(true);
    expect(
      (SEEDED_USERS.coreLoop as { onboarded?: boolean }).onboarded,
    ).toBeUndefined();
  });
});
