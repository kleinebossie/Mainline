"use client";

import * as Sentry from "@sentry/nextjs";
import Link from "next/link";
import { useEffect, useTransition } from "react";

import { Button, buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export function UnexpectedError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const [resetting, startReset] = useTransition();

  useEffect(() => {
    Sentry.captureException(error);
  }, [error]);

  return (
    <section className="mx-auto w-full max-w-2xl" aria-labelledby="error-title">
      <div className="mb-7 flex items-center gap-3" aria-hidden>
        <span className="font-mono text-xs font-semibold uppercase tracking-[0.16em] text-clay">
          Line interrupted
        </span>
        <span className="h-px flex-1 bg-clay/35" />
        <span className="flex h-7 w-7 items-center justify-center rounded-sm border border-clay/35 font-mono text-xs font-bold text-clay">
          !
        </span>
      </div>

      <h1
        id="error-title"
        className="max-w-xl font-serif text-4xl font-semibold leading-tight sm:text-5xl"
      >
        This page could not finish loading.
      </h1>
      <p className="mt-4 max-w-xl font-serif text-base leading-relaxed text-graphite sm:text-lg">
        Anything already saved is still there. Try the page again, or return to
        Today and continue from the latest session.
      </p>

      <div className="mt-7 flex flex-wrap items-center gap-3">
        <Button
          type="button"
          onClick={() => {
            startReset(reset);
          }}
          disabled={resetting}
        >
          {resetting ? "Trying again…" : "Try this page again"}
        </Button>
        <Link
          href="/today"
          className={cn(buttonVariants({ variant: "outline" }))}
        >
          Return to Today
        </Link>
      </div>

      <div className="mt-10 border-t border-line pt-4 font-mono text-[0.68rem] leading-relaxed text-graphite">
        <p>
          Error reports exclude game data, account credentials, and form text.
        </p>
        {error.digest && <p className="mt-1">Reference: {error.digest}</p>}
      </div>
    </section>
  );
}
