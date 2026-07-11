import { describe, expect, it, vi } from "vitest";

import {
  scrubMonitoringBreadcrumb,
  scrubMonitoringEvent,
} from "@/lib/monitoring-privacy";

const sentry = vi.hoisted(() => ({
  init: vi.fn(),
  captureRouterTransitionStart: vi.fn(),
}));

vi.mock("@sentry/nextjs", () => sentry);

describe("monitoring runtime configuration", () => {
  it("installs the privacy scrubbers and disables tracing in every runtime", async () => {
    await import("../../../sentry.server.config");
    await import("../../../sentry.edge.config");
    await import("@/instrumentation-client");

    expect(sentry.init).toHaveBeenCalledTimes(3);
    for (const [options] of sentry.init.mock.calls) {
      expect(options).toMatchObject({
        sendDefaultPii: false,
        beforeSend: scrubMonitoringEvent,
        beforeBreadcrumb: scrubMonitoringBreadcrumb,
      });
      expect(options).not.toHaveProperty("tracesSampleRate");
      expect(options).not.toHaveProperty("tracesSampler");
    }
  });
});
