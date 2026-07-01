"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";

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

  useEffect(() => {
    if (!open) return;
    function onPointer(e: MouseEvent) {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
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
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label="Account menu"
        onClick={() => setOpen((v) => !v)}
        className={cn(
          "flex h-8 w-8 items-center justify-center rounded-sm font-mono text-base transition-colors",
          open
            ? "text-ink bg-ink/[0.06]"
            : "text-graphite hover:text-ink hover:bg-ink/[0.04]",
        )}
      >
        <span aria-hidden>⚙</span>
      </button>

      {open && (
        <div
          role="menu"
          aria-label="Account"
          className="absolute right-0 top-full z-40 mt-2 w-44 overflow-hidden rounded-md border border-line bg-paper-raised py-1 shadow-sheet"
        >
          {ITEMS.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              role="menuitem"
              onClick={() => setOpen(false)}
              className="text-graphite hover:text-ink hover:bg-ink/[0.05] block px-3 py-2 font-mono text-xs tracking-tight transition-colors"
            >
              {item.label}
            </Link>
          ))}
          <form action={signOutAction} className="border-t border-line/80">
            <button
              type="submit"
              role="menuitem"
              className="text-graphite hover:text-clay hover:bg-clay/[0.06] block w-full px-3 py-2 text-left font-mono text-xs tracking-tight transition-colors"
            >
              Sign out
            </button>
          </form>
        </div>
      )}
    </div>
  );
}
