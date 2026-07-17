import { describe, expect, it, vi } from "vitest";

import {
  navigationDataTarget,
  prefetchNavigationData,
  type NavigationDataTarget,
} from "@/components/navigation-data-prefetch";

function prefetchers() {
  return {
    today: vi.fn().mockResolvedValue(undefined),
    analysisSuggestions: vi.fn().mockResolvedValue(undefined),
    analysisLibrary: vi.fn().mockResolvedValue(undefined),
    library: vi.fn().mockResolvedValue(undefined),
    progress: vi.fn().mockResolvedValue(undefined),
  };
}

describe("navigation data prefetch", () => {
  it.each([
    ["/today", "today"],
    ["/analysis", "analysis"],
    ["/library", "library"],
    ["/progress", "progress"],
    ["/about", null],
    ["/settings", null],
  ] as const)("maps %s to its data target", (href, expected) => {
    expect(navigationDataTarget(href)).toBe(expected);
  });

  it.each([
    ["today", ["today"]],
    ["analysis", ["analysisSuggestions", "analysisLibrary"]],
    ["library", ["library"]],
    ["progress", ["progress"]],
  ] as const)("prefetches only %s data", async (target, expectedCalls) => {
    const clients = prefetchers();

    await prefetchNavigationData(target as NavigationDataTarget, clients);

    for (const [name, prefetch] of Object.entries(clients)) {
      expect(prefetch).toHaveBeenCalledTimes(
        expectedCalls.includes(name as never) ? 1 : 0,
      );
    }
  });
});
