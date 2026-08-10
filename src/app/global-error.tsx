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
      <head>
        <style>{`
          :root {
            --paper: 80 14% 93%;
            --ink: 210 13% 9%;
            --graphite: 210 7% 38%;
            --line: 84 12% 84%;
            --clay: 12 56% 42%;
            --evergreen: 152 39% 30%;
          }
          body {
            background-color: #f1f2eb;
            color: #14171a;
            font-family: Georgia, serif;
          }
        `}</style>
      </head>
      <body className="min-h-screen bg-paper text-ink antialiased">
        <main className="flex min-h-screen items-center px-5 py-12 sm:px-8">
          <UnexpectedError error={error} reset={reset} />
        </main>
      </body>
    </html>
  );
}
