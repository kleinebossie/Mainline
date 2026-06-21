// The root tRPC router — one sub-router per domain (BUILD.md §4). `AppRouter` is the
// single type the client imports for end-to-end safety.

import { assessmentRouter } from "@/server/routers/assessment";
import { connectionsRouter } from "@/server/routers/connections";
import { constraintsRouter } from "@/server/routers/constraints";
import { importRouter } from "@/server/routers/import";
import { router } from "@/server/trpc";

export const appRouter = router({
  connections: connectionsRouter,
  import: importRouter,
  assessment: assessmentRouter,
  constraints: constraintsRouter,
});

export type AppRouter = typeof appRouter;
