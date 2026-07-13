import { afterEach, describe, expect, it, vi } from "vitest";

import {
  DEFAULT_BACKOFF,
  backoffDelayMs,
  politeFetch,
} from "@/integrations/http";

afterEach(() => vi.unstubAllGlobals());

const NO_DELAY_BACKOFF = { ...DEFAULT_BACKOFF, baseMs: 0, capMs: 0 };

function pendingUntilAbort(
  _url: string,
  init?: RequestInit,
): Promise<Response> {
  return new Promise<Response>((_resolve, reject) => {
    if (init?.signal?.aborted) {
      reject(init.signal.reason);
      return;
    }
    init?.signal?.addEventListener("abort", () => reject(init.signal?.reason), {
      once: true,
    });
  });
}

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

    const beforeAttempt = vi.fn().mockResolvedValue(undefined);
    const res = await politeFetch(
      "lichess",
      "https://x/y",
      {},
      NO_DELAY_BACKOFF,
      beforeAttempt,
    );
    expect(res.status).toBe(200);
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(beforeAttempt).toHaveBeenCalledTimes(2);
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

  it("bounds the whole request and maps its timeout to a network error", async () => {
    vi.stubGlobal("fetch", vi.fn(pendingUntilAbort));

    await expect(
      politeFetch(
        "lichess",
        "https://x/slow",
        {},
        { maxRetries: 0, baseMs: 0, capMs: 0, totalTimeoutMs: 5 },
      ),
    ).rejects.toMatchObject({ code: "network" });
  });

  it("also bounds a stalled per-user budget check", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    await expect(
      politeFetch(
        "lichess",
        "https://x/budget",
        {},
        { maxRetries: 0, baseMs: 0, capMs: 0, totalTimeoutMs: 5 },
        () => new Promise<void>(() => undefined),
      ),
    ).rejects.toMatchObject({ code: "network" });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("preserves an earlier caller abort instead of reporting a timeout", async () => {
    const controller = new AbortController();
    const callerError = new Error("caller_cancelled");
    vi.stubGlobal("fetch", vi.fn(pendingUntilAbort));

    const request = politeFetch(
      "lichess",
      "https://x/cancel",
      { signal: controller.signal },
      { maxRetries: 0, baseMs: 0, capMs: 0, totalTimeoutMs: 1_000 },
    );
    controller.abort(callerError);
    await expect(request).rejects.toBe(callerError);
  });
});
