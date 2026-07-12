"use client";

import { useEffect } from "react";

import { trpc } from "@/lib/trpc/react";

export function NavigationDataPrefetch() {
  const utils = trpc.useUtils();

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void Promise.all([
        utils.program.getToday.prefetch(),
        utils.analysis.suggestions.prefetch(),
        utils.analysis.library.prefetch(),
        utils.library.get.prefetch(),
        utils.progress.summary.prefetch(),
      ]);
    }, 750);

    return () => window.clearTimeout(timer);
  }, [utils]);

  return null;
}
