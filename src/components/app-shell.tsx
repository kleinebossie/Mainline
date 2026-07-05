"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";

import { AccountMenu } from "@/components/account-menu";
import { NAV } from "@/components/navigation";
import { cn } from "@/lib/utils";

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
        "group inline-flex items-baseline gap-1 font-mono text-sm font-bold uppercase tracking-[0.2em] text-ink",
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
  return (
    <header className="bg-paper/80 sticky top-0 z-30 border-b border-line/80 backdrop-blur-sm">
      <div className="mx-auto flex h-14 max-w-5xl items-center justify-between gap-2 px-3 sm:gap-4 sm:px-6">
        <Wordmark className="shrink-0" />
        <div className="flex min-w-0 items-center gap-1 sm:gap-2">
          <nav className="flex min-w-0 items-center gap-0.5 whitespace-nowrap sm:gap-2">
            {NAV.map((item) => {
              const active =
                pathname === item.href || pathname.startsWith(item.href + "/");
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  aria-current={active ? "page" : undefined}
                  className={cn(
                    "relative rounded-sm px-1.5 py-1.5 font-mono text-[0.68rem] tracking-tight transition-colors sm:px-2 sm:text-[0.8rem]",
                    item.secondary && "hidden sm:inline-flex",
                    active
                      ? "text-ink"
                      : "text-graphite hover:text-ink hover:bg-ink/[0.04]",
                  )}
                >
                  {item.label}
                  {active && (
                    <span className="bg-evergreen absolute inset-x-2 -bottom-px h-0.5 rounded-full" />
                  )}
                </Link>
              );
            })}
          </nav>
          <span className="ml-1 h-5 w-px bg-line/80" aria-hidden />
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
      <TopBar />
      <main
        className={cn(
          "mx-auto px-6 py-10 sm:py-14",
          width === "wide" ? "max-w-5xl" : "max-w-2xl",
        )}
      >
        {(eyebrow || title || lede) && (
          <header className="settle mb-8 flex flex-col gap-3">
            {eyebrow && <p className="eyebrow">{eyebrow}</p>}
            {title && (
              <h1 className="font-serif text-4xl font-semibold leading-[1.05] tracking-tight sm:text-5xl">
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
