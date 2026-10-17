"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import { Calendar, BarChart2, BookOpen, TrendingUp } from "lucide-react";

import { AccountMenu } from "@/components/account-menu";
import { NAV } from "@/components/navigation";
import { useNavigationDataPrefetch } from "@/components/navigation-data-prefetch";
import { cn } from "@/lib/utils";

const TAB_ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  "/today": Calendar,
  "/analysis": BarChart2,
  "/library": BookOpen,
  "/progress": TrendingUp,
};

export function Wordmark({ className }: { className?: string }) {
  return (
    <Link
      href="/today"
      aria-label="Mainline"
      className={cn(
        "group inline-flex items-center gap-2 rounded-xs text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-paper min-h-10 sm:min-h-0",
        className,
      )}
    >
      <svg
        className="h-6 w-6 shrink-0"
        viewBox="0 0 512 512"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        aria-hidden="true"
      >
        <rect
          width="512"
          height="512"
          rx="96"
          fill="currentColor"
          fillOpacity="0.08"
        />
        <path
          d="M120 376V136h56l80 132 80-132h56v240h-54V240l-82 120-82-120v136z"
          fill="currentColor"
        />
        <circle cx="392" cy="120" r="28" fill="hsl(var(--evergreen))" />
      </svg>
      <span className="font-serif text-lg font-bold tracking-tight text-ink">
        Mainline
      </span>
    </Link>
  );
}

function TopBar() {
  const pathname = usePathname();
  const prefetch = useNavigationDataPrefetch();

  return (
    <header className="sticky top-0 z-30 h-[54px] border-b border-line bg-paper/85 backdrop-blur-md">
      <div className="mx-auto flex h-full max-w-wide items-center justify-between px-4 sm:px-6">
        <Wordmark className="shrink-0" />

        {/* Desktop primary navigation centered (768px and wider) */}
        <nav
          aria-label="Primary navigation"
          className="hidden md:flex items-center gap-1"
        >
          {NAV.map((item) => {
            const active =
              pathname === item.href || pathname.startsWith(item.href + "/");
            return (
              <Link
                key={item.href}
                href={item.href}
                aria-current={active ? "page" : undefined}
                onMouseEnter={() => prefetch(item.href)}
                onFocus={() => prefetch(item.href)}
                className={cn(
                  "relative flex h-8 items-center justify-center rounded-xs px-3 font-sans text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                  active
                    ? "text-ink font-semibold"
                    : "text-graphite hover:bg-ink/[0.04] hover:text-ink",
                )}
              >
                <span>{item.label}</span>
                {active && (
                  <span className="absolute inset-x-3 -bottom-[11px] h-0.5 rounded-full bg-evergreen" />
                )}
              </Link>
            );
          })}
        </nav>

        <div className="flex shrink-0 items-center gap-2">
          <AccountMenu />
        </div>
      </div>
    </header>
  );
}

function BottomTabBar() {
  const pathname = usePathname();
  const prefetch = useNavigationDataPrefetch();

  return (
    <nav
      aria-label="Mobile navigation"
      className="fixed inset-x-0 bottom-0 z-40 flex h-[60px] items-center justify-around border-t border-line bg-paper/95 px-2 pb-[env(safe-area-inset-bottom)] backdrop-blur-md md:hidden"
    >
      {NAV.map((item) => {
        const active =
          pathname === item.href || pathname.startsWith(item.href + "/");
        const Icon = TAB_ICONS[item.href] ?? Calendar;

        return (
          <Link
            key={item.href}
            href={item.href}
            aria-current={active ? "page" : undefined}
            onMouseEnter={() => prefetch(item.href)}
            onFocus={() => prefetch(item.href)}
            className={cn(
              "flex flex-1 flex-col items-center justify-center gap-1 py-1 text-center font-sans transition-colors min-h-[48px]",
              active
                ? "text-evergreen font-semibold"
                : "text-graphite hover:text-ink",
            )}
          >
            <Icon className="h-4 w-4 shrink-0" aria-hidden="true" />
            <span className="text-[11px] leading-none tracking-tight">
              {item.label}
            </span>
          </Link>
        );
      })}
    </nav>
  );
}

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
  width?: "default" | "reading" | "wide";
}) {
  const maxWidthClass = width === "wide" ? "max-w-wide" : "max-w-reading";

  return (
    <div className="min-h-screen">
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:absolute focus:left-3 focus:top-3 focus:z-50 focus:rounded-md focus:border focus:border-line focus:bg-paper-raised focus:px-3 focus:py-2 focus:font-sans focus:text-xs focus:text-ink focus:shadow-sm"
      >
        Skip to content
      </a>
      <TopBar />
      <main
        id="main-content"
        tabIndex={-1}
        className={cn(
          "mx-auto px-4 py-6 sm:px-6 sm:py-10 pb-24 md:pb-12",
          maxWidthClass,
        )}
      >
        {(eyebrow || title || lede) && (
          <header className="settle mb-6 flex flex-col gap-2 sm:mb-8">
            {eyebrow && (
              <p className="eyebrow text-graphite">{eyebrow}</p>
            )}
            {title && (
              <h1 className="font-serif text-3xl font-semibold leading-tight tracking-tight sm:text-4xl text-ink">
                {title}
              </h1>
            )}
            {lede && (
              <p className="text-graphite max-w-xl text-sm leading-relaxed sm:text-base">
                {lede}
              </p>
            )}
          </header>
        )}
        {children}
      </main>
      <BottomTabBar />
    </div>
  );
}
