import { Suspense } from "react";

import { GameAnalysisFlow } from "@/app/analysis/[gameId]/game-analysis-flow";
import { StatusMessage } from "@/components/ui/status-message";

// The Game Analysis structured session page (BUILD.md M10). Auth-gated.
// Runs the 5-step structured protocol for the specified game. Suspense bounds the
// client hook that reads queue-return query params.
export default function GameAnalysisPage() {
  return (
    <Suspense fallback={<StatusMessage tone="loading">Loading…</StatusMessage>}>
      <GameAnalysisFlow />
    </Suspense>
  );
}
