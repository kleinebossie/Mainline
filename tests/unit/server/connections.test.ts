import { beforeEach, describe, expect, it, vi } from "vitest";

const db = vi.hoisted(() => ({
  upsert: vi.fn(),
}));

vi.mock("@/db/client", () => ({
  prisma: { platformConnection: { upsert: db.upsert } },
}));

import {
  replacesOAuthUsername,
  upsertPlatformConnection,
} from "@/server/connections";

describe("platform connection persistence", () => {
  beforeEach(() => {
    db.upsert.mockReset();
    db.upsert.mockResolvedValue({ id: "connection-1" });
  });

  it("preserves Lichess OAuth columns when a username link omits tokens", async () => {
    await upsertPlatformConnection({
      userId: "user-1",
      platform: "lichess",
      externalUsername: "thibault",
    });

    const input = db.upsert.mock.calls[0]?.[0];
    expect(input.create).toMatchObject({
      accessToken: null,
      refreshToken: null,
      scopes: null,
    });
    expect(input.update).not.toHaveProperty("accessToken");
    expect(input.update).not.toHaveProperty("refreshToken");
    expect(input.update).not.toHaveProperty("scopes");
  });

  it("updates explicitly supplied Lichess OAuth columns", async () => {
    await upsertPlatformConnection({
      userId: "user-1",
      platform: "lichess",
      externalUsername: "thibault",
      tokens: {
        accessToken: "access",
        refreshToken: "refresh",
        scopes: "preference:read",
      },
    });

    expect(db.upsert.mock.calls[0]?.[0].update).toMatchObject({
      accessToken: "access",
      refreshToken: "refresh",
      scopes: "preference:read",
    });
  });

  it("continues clearing token columns for Chess.com", async () => {
    await upsertPlatformConnection({
      userId: "user-1",
      platform: "chesscom",
      externalUsername: "hikaru",
    });

    expect(db.upsert.mock.calls[0]?.[0].update).toMatchObject({
      accessToken: null,
      refreshToken: null,
      scopes: null,
    });
  });
});

describe("OAuth username replacement", () => {
  it("blocks changing an OAuth-backed connection to a different account", () => {
    expect(
      replacesOAuthUsername(
        { externalUsername: "thibault", accessToken: "token" },
        "DrNykterstein",
      ),
    ).toBe(true);
  });

  it("allows the same canonical username and tokenless connections", () => {
    expect(
      replacesOAuthUsername(
        { externalUsername: "Thibault", accessToken: "token" },
        "thibault",
      ),
    ).toBe(false);
    expect(
      replacesOAuthUsername(
        { externalUsername: "thibault", accessToken: null },
        "DrNykterstein",
      ),
    ).toBe(false);
  });
});
