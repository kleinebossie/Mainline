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
            --paper: 90 6% 95%;
            --ink: 162 8% 12%;
            --graphite: 163 6% 40%;
            --rule: 96 7% 84%;
            --brick: 7 69% 40%;
            --tile: 167 73% 19%;
          }
          body {
            background-color: #f1f2f0;
            color: #1c211f;
            font-family: system-ui, sans-serif;
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
