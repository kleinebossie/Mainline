import { describe, expect, it } from "vitest";

import { shouldPersistPrimaryPlatform } from "@/lib/primary-platform";

describe("primary platform persistence", () => {
  it("does not persist a fallback when the saved preference failed to load", () => {
    expect(
      shouldPersistPrimaryPlatform({
        explicitSelection: null,
        effectivePlatform: "lichess",
        savedPlatform: undefined,
        savedPlatformLoaded: false,
      }),
    ).toBe(false);
  });

  it("persists an explicit choice even when the saved preference is unavailable", () => {
    expect(
      shouldPersistPrimaryPlatform({
        explicitSelection: "chesscom",
        effectivePlatform: "chesscom",
        savedPlatform: undefined,
        savedPlatformLoaded: false,
      }),
    ).toBe(true);
  });

  it("keeps inferred defaults when the saved preference loaded successfully", () => {
    expect(
      shouldPersistPrimaryPlatform({
        explicitSelection: null,
        effectivePlatform: "lichess",
        savedPlatform: null,
        savedPlatformLoaded: true,
      }),
    ).toBe(true);
  });
});
