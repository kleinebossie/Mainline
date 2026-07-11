"use client";

import * as Sentry from "@sentry/nextjs";
import { useEffect } from "react";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    Sentry.captureException(error);
  }, [error]);

  return (
    <html lang="en">
      <body>
        <main className="mx-auto flex min-h-screen max-w-xl flex-col justify-center gap-5 px-6">
          <p className="font-mono text-xs uppercase tracking-widest">
            Something went wrong
          </p>
          <h1 className="font-serif text-4xl font-semibold">
            Something went wrong.
          </h1>
          <p>
            Mainline excludes game data, account credentials, and form text from
            error reports.
          </p>
          <button
            className="w-fit rounded-md border px-4 py-2 font-mono text-sm"
            onClick={reset}
            type="button"
          >
            Try again
          </button>
        </main>
      </body>
    </html>
  );
}
