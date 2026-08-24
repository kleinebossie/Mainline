import { Suspense } from "react";

import { AnalysisQueueSession } from "@/app/analysis/session/analysis-session";
import { StatusMessage } from "@/components/ui/status-message";

// The guided analysis queue session (TEMP_ANALYSIS_QUEUE_PLAN §6.3). Auth-gated.
// Reads `?item=<programItemId>`; the review flow returns here between games.
export default function AnalysisSessionPage() {
  return (
    <Suspense fallback={<StatusMessage tone="loading">Loading…</StatusMessage>}>
      <AnalysisQueueSession />
    </Suspense>
  );
}
