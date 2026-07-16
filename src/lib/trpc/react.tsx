"use client";

// Client-side tRPC + React Query setup. `trpc` exposes typed hooks
// (trpc.connections.list.useQuery(), …) to client components. AppRouter is a
// type-only import, erased at build time, so no server code reaches the bundle.

import { useState, type ReactNode } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { httpBatchLink } from "@trpc/client";
import { createTRPCReact } from "@trpc/react-query";
import superjson from "superjson";

import type { AppRouter } from "@/server/routers/_app";
import { shouldRetryRequest } from "@/lib/error-presentation";
import { TRPC_MAX_BATCH_SIZE } from "@/lib/trpc-limits";

export const trpc = createTRPCReact<AppRouter>();

function baseUrl() {
  if (typeof window !== "undefined") return ""; // same-origin in the browser
  return `http://localhost:${process.env.PORT ?? 3000}`;
}

export function TRPCReactProvider({ children }: { children: ReactNode }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            // Mutations explicitly invalidate the data they change. Keeping
            // recent reads fresh makes revisiting a screen immediate instead
            // of issuing the same remote queries after every remount.
            staleTime: 30_000,
            gcTime: 10 * 60_000,
            refetchOnWindowFocus: false,
            retry: shouldRetryRequest,
          },
        },
      }),
  );
  const [trpcClient] = useState(() =>
    trpc.createClient({
      links: [
        httpBatchLink({
          url: `${baseUrl()}/api/trpc`,
          transformer: superjson,
          maxItems: TRPC_MAX_BATCH_SIZE,
        }),
      ],
    }),
  );

  return (
    <trpc.Provider client={trpcClient} queryClient={queryClient}>
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    </trpc.Provider>
  );
}
