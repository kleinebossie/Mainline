// The tRPC HTTP endpoint (Next.js App Router fetch adapter). All typed procedures
// are served from /api/trpc.

import { fetchRequestHandler } from "@trpc/server/adapters/fetch";

import { createTRPCContext } from "@/server/context";
import { appRouter } from "@/server/routers/_app";
import { captureOperationalEvent } from "@/server/observability";
import { TRPC_MAX_BATCH_SIZE } from "@/lib/trpc-limits";

const handler = (req: Request) =>
  fetchRequestHandler({
    endpoint: "/api/trpc",
    req,
    router: appRouter,
    createContext: () => createTRPCContext(),
    maxBatchSize: TRPC_MAX_BATCH_SIZE,
    onError({ error }) {
      if (error.code === "INTERNAL_SERVER_ERROR") {
        captureOperationalEvent({
          operation: "api",
          status: "error",
          count: 1,
        });
      }
    },
  });

export { handler as GET, handler as POST };
