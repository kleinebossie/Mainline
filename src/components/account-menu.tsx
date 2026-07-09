"use client";

import Link from "next/link";
import { useEffect, useId, useRef, useState } from "react";

import { signOutAction } from "@/server/auth-actions";
import { cn } from "@/lib/utils";

// The account menu (⚙) at the right of the top bar — the home for everything that is
// account/data rather than training: Settings, Connections, data export, and Sign out.
// A small, dependency-free popover (Esc + click-outside + roving focus) so the shell stays
// lean (the repo only ships button/card/input primitives) and on-brand (mono, paper, ink).

const ITEMS: ReadonlyArray<{ href: string; label: string }> = [
  { href: "/onboarding", label: "Setup" },
  { href: "/settings", label: "Settings" },
  { href: "/connections", label: "Connections" },
  { href: "/settings#data", label: "Export data" },
];

export function AccountMenu() {
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
        <span aria-hidden>⚙</span>
      </button>

      {open && (
        <div
          id={menuId}
          role="group"
          aria-label="Account actions"
          className="absolute right-0 top-full z-40 mt-2 w-48 overflow-hidden rounded-md border border-line bg-paper-raised py-1 shadow-sheet"
        >
          {ITEMS.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              ref={item === ITEMS[0] ? firstItemRef : undefined}
              onClick={() => setOpen(false)}
              className="text-graphite hover:text-ink hover:bg-ink/[0.05] block min-h-9 px-3 py-2 font-mono text-xs tracking-tight transition-colors focus-visible:bg-ink/[0.05] focus-visible:outline-none"
            >
              {item.label}
            </Link>
          ))}
          <form action={signOutAction} className="border-t border-line/80">
            <button
              type="submit"
              className="text-graphite hover:text-clay hover:bg-clay/[0.06] block min-h-9 w-full px-3 py-2 text-left font-mono text-xs tracking-tight transition-colors focus-visible:bg-clay/[0.06] focus-visible:outline-none"
            >
              Sign out
            </button>
          </form>
        </div>
      )}
    </div>
  );
}
