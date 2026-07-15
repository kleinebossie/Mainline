// The root tRPC router — one sub-router per domain (BUILD.md §4). `AppRouter` is the
// single type the client imports for end-to-end safety.

import { accountRouter } from "@/server/routers/account";
import { analysisRouter } from "@/server/routers/analysis";
import { assessmentRouter } from "@/server/routers/assessment";
import { connectionsRouter } from "@/server/routers/connections";
import { constraintsRouter } from "@/server/routers/constraints";
import { engagementRouter } from "@/server/routers/engagement";
import { feedbackRouter } from "@/server/routers/feedback";
import { importRouter } from "@/server/routers/import";
import { libraryRouter } from "@/server/routers/library";
import { operationsRouter } from "@/server/routers/operations";
import { programRouter } from "@/server/routers/program";
import { progressRouter } from "@/server/routers/progress";
import { trackerRouter } from "@/server/routers/tracker";
import { router } from "@/server/trpc";

export const appRouter = router({
  connections: connectionsRouter,
  import: importRouter,
  assessment: assessmentRouter,
  constraints: constraintsRouter,
  analysis: analysisRouter,
  program: programRouter,
  tracker: trackerRouter,
  engagement: engagementRouter,
  feedback: feedbackRouter,
  account: accountRouter,
  library: libraryRouter,
  progress: progressRouter,
  operations: operationsRouter,
});

export type AppRouter = typeof appRouter;
