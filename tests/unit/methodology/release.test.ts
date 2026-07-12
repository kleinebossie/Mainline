import { describe, expect, it } from "vitest";

import {
  ACTIVE_METHODOLOGY_VERSION,
  methodologyReleaseFor,
} from "@/methodology";

describe("methodology release metadata", () => {
  it("describes the active research release and its retained uncertainty", () => {
    const release = methodologyReleaseFor("research-1.3.0");

    expect(release.version).toBe("research-1.3.0");
    expect(release.channel).toBe("research");
    expect(release.sourceDocument).toBe("planning/METHODOLOGY.md");
    expect(release.retainedBestGuesses.length).toBeGreaterThan(0);
    expect(release.deliberateStubs.length).toBeGreaterThan(0);
    expect(release.rollbackVersion).toBe("research-1.2.0");
  });

  it("resolves metadata for the environment-selected active release", () => {
    expect(methodologyReleaseFor(ACTIVE_METHODOLOGY_VERSION).version).toBe(
      ACTIVE_METHODOLOGY_VERSION,
    );
  });

  it("keeps the stub release addressable for historic artifacts", () => {
    const release = methodologyReleaseFor("stub-0.1.0");

    expect(release.channel).toBe("stub");
    expect(release.rollbackVersion).toBeNull();
  });

  it("fails closed for an unknown release", () => {
    expect(() => methodologyReleaseFor("research-9.9.9")).toThrow(
      /Unknown methodology release/,
    );
  });
});
