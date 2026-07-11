// Polite outbound HTTP for platform calls (BUILD.md §6.2/§6.3): a descriptive
// User-Agent on every request, serial pacing, and exponential back-off on HTTP 429.
// "Respect the platform" (VISION §6) is an infrastructure concern, so the numbers
// here (retry count, base delay, cap) are infra constants — NOT methodology. The
// back-off schedule is a pure function so it can be golden-tested without timers.

import { PlatformError, type Platform } from "@/integrations/adapter";
import { PLATFORM_USER_AGENT } from "@/integrations/user-agent";

export interface BackoffPolicy {
  maxRetries: number; // attempts after the first try
  baseMs: number; // first back-off
  capMs: number; // upper bound per wait
  totalTimeoutMs?: number; // whole request including retries and waits
}

// Conservative defaults — single concurrent request, gentle growth. Tunable per
// deployment but never derived from chess/learning config.
export const DEFAULT_BACKOFF: BackoffPolicy = {
  maxRetries: 3,
  baseMs: 1000,
  capMs: 30_000,
  totalTimeoutMs: 5_000,
};

/**
 * The wait (ms) before retry attempt `n` (1-based): `base * 2^(n-1)`, capped. A
 * `Retry-After` header (seconds) from the server overrides the schedule when larger.
 * Pure — no timers, no clock — so the policy is unit-testable.
 */
export function backoffDelayMs(
  attempt: number,
  policy: BackoffPolicy,
  retryAfterSec?: number,
): number {
  const exp = Math.min(policy.baseMs * 2 ** (attempt - 1), policy.capMs);
  const retryAfter =
    retryAfterSec && retryAfterSec > 0 ? retryAfterSec * 1000 : 0;
  return Math.min(Math.max(exp, retryAfter), policy.capMs);
}

function parseRetryAfter(res: Response): number | undefined {
  const raw = res.headers.get("retry-after");
  if (!raw) return undefined;
  const sec = Number(raw);
  return Number.isFinite(sec) ? sec : undefined;
}

function abortableSleep(ms: number, signal: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal.aborted) {
      reject(signal.reason);
      return;
    }
    const onAbort = () => {
      clearTimeout(timer);
      reject(signal.reason);
    };
    const timer = setTimeout(() => {
      signal.removeEventListener("abort", onAbort);
      resolve();
    }, ms);
    signal.addEventListener("abort", onAbort, { once: true });
  });
}

function withAbort<T>(promise: Promise<T>, signal: AbortSignal): Promise<T> {
  if (signal.aborted) return Promise.reject(signal.reason);
  return new Promise((resolve, reject) => {
    const onAbort = () => reject(signal.reason);
    signal.addEventListener("abort", onAbort, { once: true });
    void promise.then(
      (value) => {
        signal.removeEventListener("abort", onAbort);
        resolve(value);
      },
      (error: unknown) => {
        signal.removeEventListener("abort", onAbort);
        reject(error);
      },
    );
  });
}

/**
 * Fetch with a descriptive User-Agent and bounded 429 back-off. Maps the platform's
 * non-OK statuses to typed `PlatformError`s (§6) so callers can branch on cause.
 * `platform` is only used to tag errors. Serial by construction — callers await each
 * call before the next.
 */
export async function politeFetch(
  platform: Platform,
  url: string,
  init: RequestInit = {},
  policy: BackoffPolicy = DEFAULT_BACKOFF,
  beforeAttempt?: () => Promise<void>,
): Promise<Response> {
  const headers = {
    "User-Agent": PLATFORM_USER_AGENT, // Chess.com 403s without it (§6.3)
    Accept: "application/json",
    ...(init.headers as Record<string, string> | undefined),
  };

  const timeoutSignal = AbortSignal.timeout(
    policy.totalTimeoutMs ?? DEFAULT_BACKOFF.totalTimeoutMs ?? 5_000,
  );
  const signal = init.signal
    ? AbortSignal.any([init.signal, timeoutSignal])
    : timeoutSignal;

  try {
    for (let attempt = 0; ; attempt++) {
      if (beforeAttempt) await withAbort(beforeAttempt(), signal);
      const res = await fetch(url, { ...init, headers, signal });
      if (res.status !== 429) return res;

      if (attempt >= policy.maxRetries) {
        throw new PlatformError(
          "rate_limited",
          platform,
          `${platform} rate limit hit (gave up after ${policy.maxRetries} retries)`,
        );
      }
      await abortableSleep(
        backoffDelayMs(attempt + 1, policy, parseRetryAfter(res)),
        signal,
      );
    }
  } catch (error) {
    if (timeoutSignal.aborted && !init.signal?.aborted) {
      throw new PlatformError(
        "network",
        platform,
        `${platform} request timed out`,
      );
    }
    throw error;
  }
}
