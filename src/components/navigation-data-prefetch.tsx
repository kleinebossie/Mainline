"use client";

import { useCallback } from "react";

import { trpc } from "@/lib/trpc/react";

export type NavigationDataTarget =
  | "today"
  | "analysis"
  | "library"
  | "progress";

interface NavigationPrefetchers {
  readonly today: () => Promise<unknown>;
  readonly analysisSuggestions: () => Promise<unknown>;
  readonly analysisLibrary: () => Promise<unknown>;
  readonly library: () => Promise<unknown>;
  readonly progress: () => Promise<unknown>;
}

export function navigationDataTarget(
  href: string,
): NavigationDataTarget | null {
  switch (href) {
    case "/today":
      return "today";
    case "/analysis":
      return "analysis";
    case "/library":
      return "library";
    case "/progress":
      return "progress";
    default:
      return null;
  }
}

export function prefetchNavigationData(
  target: NavigationDataTarget,
  prefetchers: NavigationPrefetchers,
): Promise<unknown> {
  switch (target) {
    case "today":
      return prefetchers.today();
    case "analysis":
      return Promise.all([
        prefetchers.analysisSuggestions(),
        prefetchers.analysisLibrary(),
      ]);
    case "library":
      return prefetchers.library();
    case "progress":
      return prefetchers.progress();
  }
}

export function useNavigationDataPrefetch() {
  const utils = trpc.useUtils();

  return useCallback(
    (href: string) => {
      const target = navigationDataTarget(href);
      if (!target) return;

      void prefetchNavigationData(target, {
        today: () => utils.program.getToday.prefetch(),
        analysisSuggestions: () => utils.analysis.suggestions.prefetch(),
        analysisLibrary: () => utils.analysis.library.prefetch(),
        library: () => utils.library.get.prefetch(),
        progress: () => utils.progress.summary.prefetch(),
      });
    },
    [utils],
  );
}
