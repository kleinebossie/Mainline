"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import {
  Settings,
  SlidersHorizontal,
  MessageSquare,
  Link2,
  Download,
  LogOut,
  LogIn,
  Info,
  Sun,
  Moon,
  Laptop,
  FlaskConical,
} from "lucide-react";
import { useTheme } from "next-themes";

import { signOutAction } from "@/server/auth-actions";
import { PendingSubmitButton } from "@/components/pending-submit-button";
import { safeRouteContext } from "@/lib/feedback";
import { isGuestSession } from "@/lib/guest-session";
import { trpc } from "@/lib/trpc/react";
import {
  Menu,
  MenuTrigger,
  MenuContent,
  MenuItem,
  MenuSeparator,
  MenuLabel,
} from "@/components/ui/menu";

export function AccountMenu() {
  const pathname = usePathname();
  const feedbackFrom = safeRouteContext(pathname) ?? "/settings";
  const { setTheme } = useTheme();

  const [isGuest, setIsGuest] = useState(false);

  useEffect(() => {
    setIsGuest(isGuestSession());
  }, []);

  const consent = trpc.account.researchConsent.useQuery(undefined, {
    staleTime: 60_000,
  });
  const hasResearchConsent = consent.data?.hasActiveGrant === true;

  return (
    <div className="relative flex items-center gap-1.5">
      {hasResearchConsent && (
        <Link
          href="/settings"
          title="Observational research active"
          aria-label="Observational research active"
          className="flex h-9 w-9 items-center justify-center rounded-sm font-sans text-evergreen hover:text-evergreen-bright hover:bg-evergreen/10 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-paper"
        >
          <FlaskConical className="h-4 w-4" aria-hidden="true" />
        </Link>
      )}

      {isGuest && (
        <span
          className="hidden sm:inline-flex items-center gap-1 rounded-full border border-line bg-paper-raised px-2.5 py-1 text-xs font-sans text-graphite"
          title="Outcomes save to browser storage"
        >
          <span className="h-1.5 w-1.5 rounded-full bg-evergreen" aria-hidden="true" />
          Guest mode
        </span>
      )}

      <Menu>
        <MenuTrigger asChild>
          <button
            type="button"
            aria-label="Account menu"
            className="flex h-9 w-9 items-center justify-center rounded-sm text-graphite transition-colors hover:bg-ink/[0.04] hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-paper data-[state=open]:bg-ink/[0.06] data-[state=open]:text-ink"
          >
            <Settings className="h-4 w-4" aria-hidden="true" />
          </button>
        </MenuTrigger>

        <MenuContent align="end" className="w-56 font-sans">
          {isGuest && (
            <>
              <div className="px-3 py-2 text-xs text-graphite bg-ink/[0.03] rounded-xs mb-1">
                <p className="font-semibold text-ink">Guest session</p>
                <p className="mt-0.5 leading-normal">
                  Outcomes save to browser storage. Sign in to sync across devices.
                </p>
              </div>
              <MenuSeparator />
            </>
          )}

          <MenuLabel>Navigation</MenuLabel>
          <MenuItem asChild>
            <Link href="/onboarding" className="flex items-center gap-2.5">
              <SlidersHorizontal className="h-4 w-4 text-graphite" aria-hidden="true" />
              <span>Setup</span>
            </Link>
          </MenuItem>
          <MenuItem asChild>
            <Link href="/settings" className="flex items-center gap-2.5">
              <Settings className="h-4 w-4 text-graphite" aria-hidden="true" />
              <span>Settings</span>
            </Link>
          </MenuItem>
          <MenuItem asChild>
            <Link href="/about" className="flex items-center gap-2.5">
              <Info className="h-4 w-4 text-graphite" aria-hidden="true" />
              <span>About</span>
            </Link>
          </MenuItem>
          <MenuItem asChild>
            <Link
              href={`/settings?feedbackFrom=${encodeURIComponent(feedbackFrom)}#feedback`}
              className="flex items-center gap-2.5"
            >
              <MessageSquare className="h-4 w-4 text-graphite" aria-hidden="true" />
              <span>Feedback</span>
            </Link>
          </MenuItem>
          <MenuItem asChild>
            <Link href="/connections" className="flex items-center gap-2.5">
              <Link2 className="h-4 w-4 text-graphite" aria-hidden="true" />
              <span>Connections</span>
            </Link>
          </MenuItem>
          <MenuItem asChild>
            <Link href="/settings#data" className="flex items-center gap-2.5">
              <Download className="h-4 w-4 text-graphite" aria-hidden="true" />
              <span>Export data</span>
            </Link>
          </MenuItem>

          <MenuSeparator />
          <MenuLabel>Theme</MenuLabel>
          <MenuItem onSelect={() => setTheme("system")} className="flex items-center gap-2.5">
            <Laptop className="h-4 w-4 text-graphite" aria-hidden="true" />
            <span>System theme</span>
          </MenuItem>
          <MenuItem onSelect={() => setTheme("light")} className="flex items-center gap-2.5">
            <Sun className="h-4 w-4 text-graphite" aria-hidden="true" />
            <span>Light theme</span>
          </MenuItem>
          <MenuItem onSelect={() => setTheme("dark")} className="flex items-center gap-2.5">
            <Moon className="h-4 w-4 text-graphite" aria-hidden="true" />
            <span>Dark theme</span>
          </MenuItem>

          <MenuSeparator />
          {isGuest ? (
            <MenuItem asChild>
              <Link
                href="/signin"
                className="flex items-center gap-2.5 text-evergreen hover:text-evergreen-bright"
              >
                <LogIn className="h-4 w-4" aria-hidden="true" />
                <span>Sign in</span>
              </Link>
            </MenuItem>
          ) : (
            <form action={signOutAction} className="w-full">
              <PendingSubmitButton
                pendingLabel="Signing out…"
                className="group flex min-h-10 w-full items-center gap-2.5 rounded-xs px-3 py-2 text-left font-sans text-sm text-graphite transition-colors hover:bg-clay/10 hover:text-clay focus-visible:bg-clay/10 focus-visible:outline-none"
              >
                <LogOut className="h-4 w-4 shrink-0 text-graphite group-hover:text-clay" aria-hidden="true" />
                <span>Sign out</span>
              </PendingSubmitButton>
            </form>
          )}
        </MenuContent>
      </Menu>
    </div>
  );
}
