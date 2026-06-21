// The root tRPC router — one sub-router per domain (BUILD.md §4). `AppRouter` is the
// single type the client imports for end-to-end safety.

import { analysisRouter } from "@/server/routers/analysis";
import { assessmentRouter } from "@/server/routers/assessment";
import { connectionsRouter } from "@/server/routers/connections";
import { constraintsRouter } from "@/server/routers/constraints";
import { importRouter } from "@/server/routers/import";
import { programRouter } from "@/server/routers/program";
import { router } from "@/server/trpc";

export const appRouter = router({
  connections: connectionsRouter,
  import: importRouter,
  assessment: assessmentRouter,
  constraints: constraintsRouter,
  analysis: analysisRouter,
  program: programRouter,
});

export type AppRouter = typeof appRouter;
