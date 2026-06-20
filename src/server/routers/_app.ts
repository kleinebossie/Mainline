// The root tRPC router — one sub-router per domain (BUILD.md §4). `AppRouter` is the
// single type the client imports for end-to-end safety.

import { connectionsRouter } from "@/server/routers/connections";
import { router } from "@/server/trpc";

export const appRouter = router({
  connections: connectionsRouter,
});

export type AppRouter = typeof appRouter;
