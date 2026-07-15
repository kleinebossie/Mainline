"use client";

import { UnexpectedError } from "@/components/unexpected-error";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-paper text-ink antialiased">
        <main className="flex min-h-screen items-center px-5 py-12 sm:px-8">
          <UnexpectedError error={error} reset={reset} />
        </main>
      </body>
    </html>
  );
}
