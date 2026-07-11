import { describe, expect, it } from "vitest";

import {
  scrubMonitoringBreadcrumb,
  scrubMonitoringEvent,
} from "@/lib/monitoring-privacy";
import { buildOperationalEvent } from "@/server/observability";

describe("monitoring privacy", () => {
  it("removes credentials, payloads, user identity, query strings, and error text", () => {
    const result = scrubMonitoringEvent({
      type: undefined,
      message: "Bearer secret in free text",
      user: { id: "user-1", email: "person@example.com" },
      request: {
        method: "POST",
        url: "https://mainline.test/api/trpc/tracker?input=private",
        headers: { authorization: "Bearer token", cookie: "session=secret" },
        cookies: { session: "secret" },
        data: { pgn: "1. e4 e5", comment: "private feedback" },
        query_string: "input=private",
      },
      exception: {
        values: [
          {
            type: "PlatformError",
            value: "upstream response included a PGN and token",
          },
        ],
      },
      tags: { operation: "import", status: "error", unsafe: "secret" },
      extra: { count: 1, unsafe: "private" },
    });

    expect(result.user).toBeUndefined();
    expect(result.message).toBe("ops.import.error");
    expect(result.request).toEqual({ method: "POST" });
    expect(result.exception?.values?.[0]?.value).toBe("platformerror");
    expect(result.tags).toEqual({ operation: "import", status: "error" });
    expect(result.extra).toEqual({ count: 1 });
    expect(JSON.stringify(result)).not.toMatch(
      /secret|person@example|1\. e4|private feedback|upstream response/i,
    );
  });

  it("drops arbitrary messages and extras when an event is not a typed operation", () => {
    const result = scrubMonitoringEvent({
      type: undefined,
      message: "free text",
      extra: { feedback: "private" },
    });

    expect(result.message).toBeUndefined();
    expect(result.extra).toBeUndefined();
  });

  it("drops console breadcrumbs and strips network breadcrumb details", () => {
    expect(
      scrubMonitoringBreadcrumb({ category: "console", message: "token" }),
    ).toBeNull();
    expect(
      scrubMonitoringBreadcrumb({
        category: "fetch",
        message: "POST /api/trpc?private",
        data: { request_body_size: 100 },
      }),
    ).toEqual({ category: "fetch", type: undefined, level: undefined });
  });
});

describe("operational analytics", () => {
  it("builds an allowlisted aggregate event without user or payload fields", () => {
    expect(
      buildOperationalEvent({
        operation: "job",
        status: "error",
        durationMs: 12.6,
        count: 2,
        jobKind: "adaptation",
      }),
    ).toEqual({
      message: "ops.job.error",
      level: "error",
      tags: {
        operation: "job",
        status: "error",
        job_kind: "adaptation",
      },
      extra: { duration_ms: 13, count: 2 },
    });
  });
});
