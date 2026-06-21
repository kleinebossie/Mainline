import { afterEach, describe, expect, it, vi } from "vitest";

import {
  DEFAULT_BACKOFF,
  backoffDelayMs,
  politeFetch,
} from "@/integrations/http";

// M2: rate-limit middleware. The back-off schedule is a pure function (golden); the
// fetch wrapper retries 429s and gives up after maxRetries with a typed error.

afterEach(() => vi.unstubAllGlobals());

describe("backoffDelayMs", () => {
  const policy = { maxRetries: 3, baseMs: 1000, capMs: 30_000 };

  it("grows exponentially and respects the cap", () => {
    expect(backoffDelayMs(1, policy)).toBe(1000);
    expect(backoffDelayMs(2, policy)).toBe(2000);
    expect(backoffDelayMs(3, policy)).toBe(4000);
    expect(backoffDelayMs(99, policy)).toBe(30_000); // capped
  });

  it("honours a larger Retry-After (seconds), still capped", () => {
    expect(backoffDelayMs(1, policy, 5)).toBe(5000);
    expect(backoffDelayMs(1, policy, 999)).toBe(30_000);
  });
});

describe("politeFetch", () => {
  it("adds a User-Agent and returns a non-429 response immediately", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(new Response("{}", { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);

    const res = await politeFetch("lichess", "https://x/y");
    expect(res.status).toBe(200);
    const headers = (fetchMock.mock.calls[0]?.[1] as RequestInit)
      .headers as Record<string, string>;
    expect(headers["User-Agent"]).toBeTruthy();
  });

  it("retries on 429 then succeeds", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        new Response("", { status: 429, headers: { "retry-after": "0" } }),
      )
      .mockResolvedValueOnce(new Response("{}", { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);

    const res = await politeFetch(
      "lichess",
      "https://x/y",
      {},
      DEFAULT_BACKOFF,
    );
    expect(res.status).toBe(200);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("gives up after maxRetries with a typed rate_limited error", async () => {
    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockResolvedValue(
          new Response("", { status: 429, headers: { "retry-after": "0" } }),
        ),
    );
    await expect(
      politeFetch(
        "chesscom",
        "https://x/y",
        {},
        {
          maxRetries: 2,
          baseMs: 0,
          capMs: 0,
        },
      ),
    ).rejects.toMatchObject({ code: "rate_limited" });
  });
});
