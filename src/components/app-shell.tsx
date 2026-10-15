"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState, type ReactNode } from "react";

import { AccountMenu } from "@/components/account-menu";
import { NAV } from "@/components/navigation";
import { trpc } from "@/lib/trpc/react";
import { getGuestSession } from "@/lib/guest-session";
import { cn } from "@/lib/utils";

// The app shell: a rail, not a stack of pages. The rail carries the wordmark, the primary
// surfaces, and — pinned to its right edge — the session bar: the product's one progress
// device, drawn like an engine eval bar. It fills with the share of today's planned minutes
// you have already trained, so the state of your day is legible from any page without a
// number being read. (planning/DESIGN.md §Signature)

/** The brand mark: the name plus the annotation glyph that is the whole idea — a graded line. */
export function Wordmark({ className }: { className?: string }) {
  return (
    <Link
      href="/today"
      className={cn(
        "group inline-flex items-baseline gap-1 text-[1.0625rem] font-bold uppercase tracking-[-0.005em] text-ink [font-stretch:118%] rounded-[2px]",
        className,
      )}
    >
      Mainline
      <span
        className="text-biro font-mono text-[0.8rem] lowercase tracking-normal transition-colors group-hover:text-ink"
        aria-hidden
      >
        ·!
      </span>
    </Link>
  );
}

type SessionState = {
  planned: number;
  trained: number;
  skipped: number;
  blocks: number;
};

function useTodaySession(): SessionState | null {
  const me = trpc.account.me.useQuery(undefined, {
    staleTime: 60_000,
    retry: false,
  });
  const authenticated = me.data?.authenticated === true;
  const program = trpc.program.getToday.useQuery(undefined, {
    enabled: authenticated,
    retry: false,
    staleTime: 30_000,
  });
  const pathname = usePathname();

  // Guest sessions live in localStorage; re-read when the route changes so the bar tracks
  // the work you just logged on /today.
  const [guest, setGuest] = useState<SessionState | null>(null);
  useEffect(() => {
    if (authenticated) return;
    const read = () => {
      const stored = getGuestSession().program;
      setGuest(stored ? summarize(stored.items) : null);
    };
    read();
    window.addEventListener("storage", read);
    return () => window.removeEventListener("storage", read);
  }, [authenticated, pathname]);

  const items = program.data?.items;
  if (authenticated) return items ? summarize(items) : null;
  return guest;
}

function summarize(
  items: {
    estMinutes?: number | null;
    status: string;
  }[] = [],
): SessionState {
  let planned = 0;
  let trained = 0;
  let skipped = 0;
  for (const item of items) {
    const minutes = item.estMinutes ?? 0;
    planned += minutes;
    if (item.status === "done") trained += minutes;
    if (item.status === "skipped") skipped += minutes;
  }
  return { planned, trained, skipped, blocks: items.length };
}

function SessionBar({
  className,
  orientation = "column",
}: {
  className?: string;
  orientation?: "column" | "row";
}) {
  const session = useTodaySession();
  const done = session ? Math.min(session.planned, session.trained) : 0;
  const skipped = session
    ? Math.min(session.planned - done, session.skipped)
    : 0;
  const planned = session?.planned ?? 0;
  const doneShare = planned > 0 ? (done / planned) * 100 : 0;
  const skipShare = planned > 0 ? (skipped / planned) * 100 : 0;
  const clear = planned > 0 && done + skipped >= planned;

  const left = planned > 0 ? Math.max(0, planned - done - skipped) : 0;

  const row = orientation === "row";

  return (
    <div
      className={cn(
        row ? "flex items-center gap-3" : "flex items-stretch gap-2.5",
        className,
      )}
    >
      <div
        data-orient={row ? "row" : "column"}
        className={cn(
          "session-bar shrink-0",
          row ? "h-[7px] w-full max-w-[10rem]" : "self-stretch",
        )}
        data-done={planned > 0 ? "true" : undefined}
        data-empty={planned === 0 ? "true" : undefined}
        role="img"
        aria-label={
          planned === 0
            ? "No training planned for today"
            : `${done} of ${planned} planned minutes trained${skipped > 0 ? `, ${skipped} skipped` : ""}`
        }
      >
        <span
          className="bar-skip"
          style={{ height: `${skipShare}%`, bottom: `${doneShare}%` }}
          aria-hidden
        />
        <span
          className="bar-fill"
          style={{ height: `${doneShare}%` }}
          aria-hidden
        />
      </div>
      <div className={cn("min-w-0", row && "flex items-baseline gap-2")}>
        <p className="label">
          {planned === 0
            ? "No session yet"
            : clear
              ? "Session handled"
              : "Left in today"}
        </p>
        <p className="mt-0.5 font-mono text-[0.8rem] font-semibold text-ink">
          {planned === 0 ? (
            <Link
              href="/today"
              className="text-biro underline decoration-rule underline-offset-4 hover:decoration-biro"
            >
              Build it
            </Link>
          ) : (
            <>
              {left > 0 ? `${left} min` : `${done}/${planned} min`}
              {skipped > 0 && (
                <span className="text-brick font-normal">
                  {" "}
                  · {skipped} skipped
                </span>
              )}
            </>
          )}
        </p>
      </div>
    </div>
  );
}

function RailNav({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = usePathname();
  return (
    <nav aria-label="Primary navigation" className="min-w-0">
      <ul className="rule-list">
        {NAV.filter((item) => !item.secondary).map((item) => {
          const active =
            pathname === item.href || pathname.startsWith(item.href + "/");
          return (
            <li key={item.href}>
              <Link
                href={item.href}
                onClick={onNavigate}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "flex min-h-11 items-center justify-between gap-2 rounded-[3px] px-2.5 text-[0.95rem] transition-colors",
                  active
                    ? "bg-biro/[0.07] text-ink font-semibold [box-shadow:inset_2px_0_0_hsl(var(--biro))]"
                    : "text-graphite hover:bg-ink/[0.04] hover:text-ink",
                )}
              >
                <span className="leading-none">{item.label}</span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

function RailHead() {
  return (
    <div className="flex items-baseline justify-between gap-2">
      <Wordmark />
      <span className="font-mono text-[0.68rem] text-graphite">
        {new Date().toLocaleDateString(undefined, {
          day: "2-digit",
          month: "short",
        })}
      </span>
    </div>
  );
}

function Rail() {
  return (
    <aside className="bg-sheet/70 sticky top-0 hidden h-screen w-[232px] shrink-0 flex-col justify-between border-r border-rule px-4 pb-5 pt-4 lg:flex">
      <div className="min-w-0">
        <RailHead />
        <div className="mt-6">
          <RailNav />
        </div>
        <div className="mt-6 border-t border-rule pt-4">
          <div className="h-20 min-h-20">
            <SessionBar className="h-full" />
          </div>
        </div>
      </div>
      <div className="flex flex-col gap-5">
        <div className="flex items-center justify-between gap-2 border-t border-rule pt-3">
          <ul className="flex min-w-0 items-center gap-3 text-[0.78rem] text-graphite">
            {NAV.filter((item) => item.secondary).map((item) => (
              <li key={item.href}>
                <Link
                  href={item.href}
                  className="rounded-[2px] transition-colors hover:text-ink"
                >
                  {item.label}
                </Link>
              </li>
            ))}
          </ul>
          <AccountMenu />
        </div>
      </div>
    </aside>
  );
}

function TopStrip() {
  const [navOpen, setNavOpen] = useState(false);
  const pathname = usePathname();
  useEffect(() => setNavOpen(false), [pathname]);

  return (
    <header className="bg-sheet/90 sticky top-0 z-30 border-b border-rule backdrop-blur-sm lg:hidden">
      <div className="flex min-h-[3.25rem] items-center justify-between gap-3 px-4">
        <RailHead />
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => setNavOpen((open) => !open)}
            aria-expanded={navOpen}
            aria-controls="mobile-nav"
            className="flex min-h-9 items-center gap-1.5 rounded-[3px] border border-rule px-2.5 font-mono text-[0.72rem] text-graphite transition-colors hover:text-ink"
          >
            Menu
            <span aria-hidden className="font-mono text-[0.7rem]">
              {navOpen ? "−" : "+"}
            </span>
          </button>
          <AccountMenu />
        </div>
      </div>
      {navOpen && (
        <div id="mobile-nav" className="border-t border-rule px-4 py-3">
          <RailNav onNavigate={() => setNavOpen(false)} />
          <ul className="mt-3 flex items-center gap-4 border-t border-rule pt-3 text-[0.8rem] text-graphite">
            {NAV.filter((item) => item.secondary).map((item) => (
              <li key={item.href}>
                <Link href={item.href} className="rounded-[2px] hover:text-ink">
                  {item.label}
                </Link>
              </li>
            ))}
          </ul>
        </div>
      )}
      <div className="flex items-center gap-4 border-t border-rule px-4 py-2">
        <SessionBar orientation="row" className="flex-1" />
      </div>
    </header>
  );
}

/**
 * PageShell: the signed-in frame — rail (or top strip) plus one content measure and a
 * rule-banded page head. `meta` sits right-aligned in the head band: it is a readout
 * (date, version, budget), never a decorative label.
 */
export function PageShell({
  children,
  kicker,
  meta,
  title,
  lede,
  width = "default",
}: {
  children: ReactNode;
  /** Where this sits in a sequence ("Step 2 of setup") or what the page covers. */
  kicker?: ReactNode;
  /** A readout that belongs to the page itself: a date, a count, a version. */
  meta?: ReactNode;
  title?: string;
  lede?: ReactNode;
  width?: "default" | "wide" | "full";
}) {
  return (
    <div className="flex min-h-screen">
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:absolute focus:left-3 focus:top-3 focus:z-50 focus:rounded-[3px] focus:border focus:border-rule focus:bg-sheet focus:px-3 focus:py-2 focus:font-mono focus:text-xs focus:text-ink"
      >
        Skip to content
      </a>
      <Rail />
      <div className="min-w-0 flex-1">
        <TopStrip />
        <main
          id="main-content"
          tabIndex={-1}
          className={cn(
            "mx-auto w-full px-4 pb-16 pt-6 sm:px-6 sm:pt-8",
            width === "wide"
              ? "max-w-[1080px]"
              : width === "full"
                ? "max-w-none"
                : "max-w-[760px]",
          )}
        >
          {(kicker || meta || title || lede) && (
            <header className="mb-7 sm:mb-9">
              {(kicker || meta) && (
                <div className="mb-3 flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 border-b border-rule pb-2">
                  {kicker && <span className="label-ink">{kicker}</span>}
                  {meta && (
                    <span className="font-mono text-[0.72rem] text-graphite">
                      {meta}
                    </span>
                  )}
                </div>
              )}
              {title && (
                <h1 className="text-[2.1rem] leading-[1.02] sm:text-[2.7rem]">
                  {title}
                </h1>
              )}
              {lede && (
                <p className="prose-sheet mt-3 text-graphite max-w-[62ch] text-[1rem] leading-relaxed">
                  {lede}
                </p>
              )}
            </header>
          )}
          {children}
        </main>
      </div>
    </div>
  );
}
