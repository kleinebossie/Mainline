import Link from "next/link";

import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export default function NotFound() {
  return (
    <main className="mx-auto flex min-h-screen max-w-2xl items-center px-5 py-12 sm:px-8">
      <section aria-labelledby="not-found-title" className="w-full">
        <div className="mb-7 flex items-center gap-3" aria-hidden>
          <span className="font-mono text-xs font-semibold uppercase tracking-[0.16em] text-graphite">
            Line not found
          </span>
          <span className="h-px flex-1 bg-line" />
          <span className="font-mono text-xs font-semibold text-graphite">
            404
          </span>
        </div>
        <h1
          id="not-found-title"
          className="font-serif text-4xl font-semibold leading-tight sm:text-5xl"
        >
          There is no page at this address.
        </h1>
        <p className="mt-4 max-w-xl font-serif text-base leading-relaxed text-graphite sm:text-lg">
          The link may be old, or the page may have moved. Return home to pick
          up the latest route.
        </p>
        <Link href="/" className={cn(buttonVariants(), "mt-7")}>
          Return home
        </Link>
      </section>
    </main>
  );
}
