import { describe, expect, it } from "vitest";

import { manualImportJobKey } from "@/server/routers/import";

describe("manual import job keys", () => {
  it("coalesces retries within one API budget window", () => {
    expect(
      manualImportJobKey("user-1", new Date("2026-07-16T12:05:00.000Z")),
    ).toBe(manualImportJobKey("user-1", new Date("2026-07-16T12:59:59.999Z")));
  });

  it("allows a fresh import in the next API budget window", () => {
    expect(
      manualImportJobKey("user-1", new Date("2026-07-16T12:59:59.999Z")),
    ).not.toBe(
      manualImportJobKey("user-1", new Date("2026-07-16T13:00:00.000Z")),
    );
  });
});
