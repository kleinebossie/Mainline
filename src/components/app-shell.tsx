"use client";

import Link from "next/link";
import dynamic from "next/dynamic";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";

import { AccountMenu } from "@/components/account-menu";
import { NAV } from "@/components/navigation";
import { cn } from "@/lib/utils";

const NavigationDataPrefetch = dynamic(
  () =>
    import("@/components/navigation-data-prefetch").then(
      (module) => module.NavigationDataPrefetch,
    ),
  { ssr: false },
);

// The app shell — one slim mono top bar across every signed-in surface, so the product
// reads as a single instrument instead of a stack of pages. The wordmark carries the
// annotation mark (·!) that is the brand's whole idea: a graded, honest line.
//
// IA: primary training surfaces live in the top bar. Progress is restored as a top-level
// process surface, while secondary About copy can yield on the smallest screens.

export function Wordmark({ className }: { className?: string }) {
  return (
    <Link
      href="/today"
      className={cn(
        "group inline-flex items-baseline gap-1 rounded-sm font-mono text-sm font-bold uppercase tracking-[0.2em] text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-paper",
        className,
      )}
    >
      Mainline
      <span className="text-evergreen tracking-normal" aria-hidden>
        ·!
      </span>
    </Link>
  );
}

function TopBar() {
  const pathname = usePathname();
  const isTrainingSurface = [
    "/today",
    "/analysis",
    "/library",
    "/progress",
    "/train",
  ].some((href) => pathname === href || pathname.startsWith(`${href}/`));

  return (
    <header className="bg-paper/80 sticky top-0 z-30 border-b border-line/80 backdrop-blur-sm">
      {isTrainingSurface && <NavigationDataPrefetch />}
      <div className="mx-auto flex min-h-14 max-w-5xl flex-wrap items-center gap-x-2 px-4 sm:grid sm:h-14 sm:grid-cols-[1fr_auto_1fr] sm:gap-4 sm:px-6">
        <Wordmark className="shrink-0" />
        <nav
          aria-label="Primary navigation"
          className="order-3 -mx-4 flex w-[calc(100%+2rem)] border-t border-line/70 sm:order-none sm:mx-0 sm:w-auto sm:justify-self-center sm:border-t-0"
        >
          {NAV.map((item) => {
            const active =
              pathname === item.href || pathname.startsWith(item.href + "/");
            return (
              <Link
                key={item.href}
                href={item.href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "relative flex min-h-10 flex-1 items-center justify-center whitespace-nowrap rounded-sm px-2 py-2 font-mono text-[0.68rem] tracking-tight transition-colors focus-visible:z-10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset sm:min-h-0 sm:flex-none sm:px-2 sm:py-1.5 sm:text-[0.8rem]",
                  item.secondary && "hidden sm:inline-flex",
                  active
                    ? "text-ink"
                    : "text-graphite hover:bg-ink/[0.04] hover:text-ink",
                )}
              >
                {item.label}
                {active && (
                  <span className="bg-evergreen absolute inset-x-3 bottom-0 h-0.5 rounded-full sm:inset-x-2 sm:-bottom-px" />
                )}
              </Link>
            );
          })}
        </nav>
        <div className="ml-auto flex shrink-0 items-center gap-2 sm:ml-0 sm:justify-self-end">
          <span className="hidden h-5 w-px bg-line/80 sm:block" aria-hidden />
          <AccountMenu />
        </div>
      </div>
    </header>
  );
}

/**
 * PageShell — the signed-in page frame: the top bar plus a centered measure and an optional
 * masthead (mono eyebrow, serif title, graphite lede).
 */
export function PageShell({
  children,
  eyebrow,
  title,
  lede,
  width = "default",
}: {
  children: ReactNode;
  eyebrow?: string;
  title?: string;
  lede?: ReactNode;
  width?: "default" | "wide";
}) {
  return (
    <div className="min-h-screen">
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:absolute focus:left-3 focus:top-3 focus:z-50 focus:rounded-md focus:border focus:border-line focus:bg-paper-raised focus:px-3 focus:py-2 focus:font-mono focus:text-xs focus:text-ink focus:shadow-sheet"
      >
        Skip to content
      </a>
      <TopBar />
      <main
        id="main-content"
        tabIndex={-1}
        className={cn(
          "mx-auto px-4 py-8 sm:px-6 sm:py-12",
          width === "wide" ? "max-w-5xl" : "max-w-2xl",
        )}
      >
        {(eyebrow || title || lede) && (
          <header className="settle mb-8 flex flex-col gap-3 sm:mb-10">
            {eyebrow && <p className="eyebrow">{eyebrow}</p>}
            {title && (
              <h1 className="font-serif text-[2.35rem] font-semibold leading-[1.05] tracking-tight sm:text-5xl">
                {title}
              </h1>
            )}
            {lede && (
              <p className="text-graphite max-w-xl text-base leading-relaxed">
                {lede}
              </p>
            )}
          </header>
        )}
        {children}
      </main>
    </div>
  );
}
