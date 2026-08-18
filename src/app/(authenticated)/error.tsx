"use client";

import { PageShell } from "@/components/app-shell";
import { UnexpectedError } from "@/components/unexpected-error";

export default function AuthenticatedError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <PageShell width="wide">
      <UnexpectedError error={error} reset={reset} />
    </PageShell>
  );
}


