"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useId, useRef, useState } from "react";
import type { LucideIcon } from "lucide-react";
import {
  Settings,
  SlidersHorizontal,
  MessageSquare,
  Link2,
  Download,
  LogOut,
} from "lucide-react";

import { signOutAction } from "@/server/auth-actions";
import { PendingSubmitButton } from "@/components/pending-submit-button";
import { safeRouteContext } from "@/lib/feedback";
import { cn } from "@/lib/utils";

// The account menu at the right of the top bar: the home for everything that is
// account/data rather than training: Settings, Connections, data export, and Sign out.
// A small popover (Esc + click-outside + roving focus) so the shell stays
// lean (the repo only ships button/card/input primitives) and on-brand (mono, paper, ink).

interface AccountMenuItem {
  href: string;
  label: string;
  icon: LucideIcon;
}

const ITEMS: ReadonlyArray<AccountMenuItem> = [
  { href: "/onboarding", label: "Setup", icon: SlidersHorizontal },
  { href: "/settings", label: "Settings", icon: Settings },
  { href: "/settings#feedback", label: "Feedback", icon: MessageSquare },
  { href: "/connections", label: "Connections", icon: Link2 },
  { href: "/settings#data", label: "Export data", icon: Download },
];

export function AccountMenu() {
  const pathname = usePathname();
  const feedbackFrom = safeRouteContext(pathname) ?? "/settings";
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const firstItemRef = useRef<HTMLAnchorElement>(null);
  const menuId = useId();

  useEffect(() => {
    if (!open) return;
    function onPointer(e: MouseEvent) {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") {
        setOpen(false);
        triggerRef.current?.focus();
      }
    }
    document.addEventListener("mousedown", onPointer);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onPointer);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        aria-expanded={open}
        aria-controls={open ? menuId : undefined}
        aria-label="Account menu"
        onClick={() => setOpen((v) => !v)}
        onKeyDown={(event) => {
          if (event.key === "ArrowDown") {
            event.preventDefault();
            setOpen(true);
            requestAnimationFrame(() => firstItemRef.current?.focus());
          }
        }}
        ref={triggerRef}
        className={cn(
          "flex h-9 w-9 items-center justify-center rounded-sm font-mono text-base transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-paper",
          open
            ? "text-ink bg-ink/[0.06]"
            : "text-graphite hover:text-ink hover:bg-ink/[0.04]",
        )}
      >
        <Settings className="h-4 w-4" aria-hidden="true" />
      </button>

      {open && (
        <div
          id={menuId}
          role="group"
          aria-label="Account actions"
          className="absolute right-0 top-full z-40 mt-2 w-52 overflow-hidden rounded-md border border-line bg-paper-raised/95 p-1 shadow-lg backdrop-blur-md"
        >
          {ITEMS.map((item) => {
            const Icon = item.icon;
            return (
              <Link
                key={item.href}
                href={
                  item.label === "Feedback"
                    ? `/settings?feedbackFrom=${encodeURIComponent(feedbackFrom)}#feedback`
                    : item.href
                }
                ref={item === ITEMS[0] ? firstItemRef : undefined}
                onClick={() => setOpen(false)}
                className="group flex min-h-8 items-center gap-2.5 rounded-sm px-2.5 py-1.5 font-mono text-xs tracking-tight text-graphite transition-colors hover:bg-ink/[0.06] hover:text-ink focus-visible:bg-ink/[0.06] focus-visible:outline-none"
              >
                <span className="flex h-4 w-4 shrink-0 items-center justify-center text-graphite/70 transition-colors group-hover:text-ink">
                  <Icon className="h-3.5 w-3.5 stroke-[1.75]" aria-hidden="true" />
                </span>
                <span className="leading-none">{item.label}</span>
              </Link>
            );
          })}
          <div className="my-1 h-px bg-line/70" />
          <form action={signOutAction}>
            <PendingSubmitButton
              pendingLabel="Signing out…"
              className="group flex min-h-8 w-full items-center gap-2.5 rounded-sm px-2.5 py-1.5 text-left font-mono text-xs tracking-tight text-graphite transition-colors hover:bg-clay/10 hover:text-clay focus-visible:bg-clay/10 focus-visible:outline-none"
            >
              <span className="flex h-4 w-4 shrink-0 items-center justify-center text-graphite/70 transition-colors group-hover:text-clay">
                <LogOut className="h-3.5 w-3.5 stroke-[1.75]" aria-hidden="true" />
              </span>
              <span className="leading-none">Sign out</span>
            </PendingSubmitButton>
          </form>
        </div>
      )}
    </div>
  );
}
