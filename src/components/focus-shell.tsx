"use client";

import * as React from "react";
import Link from "next/link";
import { X } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogClose,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export interface FocusShellProps {
  children: React.ReactNode;
  title?: React.ReactNode;
  progressSlot?: React.ReactNode;
  controlsSlot?: React.ReactNode;
  exitHref?: string;
  onExit?: () => void;
  confirmExit?: boolean;
  confirmTitle?: string;
  confirmDescription?: string;
  className?: string;
}

export function FocusShell({
  children,
  title,
  progressSlot,
  controlsSlot,
  exitHref = "/today",
  onExit,
  confirmExit = false,
  confirmTitle = "Leave training session?",
  confirmDescription = "Your current block progress will be saved, but the active position will reset.",
  className,
}: FocusShellProps) {
  const [confirmOpen, setConfirmOpen] = React.useState(false);

  const handleConfirmExit = () => {
    setConfirmOpen(false);
    if (onExit) {
      onExit();
    } else if (typeof window !== "undefined") {
      window.location.href = exitHref;
    }
  };

  return (
    <div
      className={cn(
        "min-h-screen bg-paper text-ink flex flex-col",
        className,
      )}
    >
      {/* Compact Focus Header: no tabs, no app nav */}
      <header className="h-[54px] border-b border-line bg-paper/85 backdrop-blur-md px-4 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-3">
          {confirmExit ? (
            <Dialog open={confirmOpen} onOpenChange={setConfirmOpen}>
              <DialogTrigger asChild>
                <button
                  type="button"
                  aria-label="Exit training"
                  className="flex h-9 w-9 items-center justify-center rounded-xs text-graphite hover:text-ink hover:bg-ink/[0.04] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  <X className="h-4 w-4" aria-hidden="true" />
                </button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>{confirmTitle}</DialogTitle>
                  <DialogDescription>{confirmDescription}</DialogDescription>
                </DialogHeader>
                <DialogFooter>
                  <DialogClose asChild>
                    <Button variant="secondary">Stay</Button>
                  </DialogClose>
                  <Button variant="danger" onClick={handleConfirmExit}>
                    Leave
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          ) : (
            <Link
              href={exitHref}
              onClick={onExit}
              aria-label="Exit training"
              className="flex h-9 w-9 items-center justify-center rounded-xs text-graphite hover:text-ink hover:bg-ink/[0.04] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <X className="h-4 w-4" aria-hidden="true" />
            </Link>
          )}

          {title && (
            <div className="font-sans text-sm font-semibold text-ink truncate">
              {title}
            </div>
          )}
        </div>

        <div className="flex items-center gap-3">
          {progressSlot}
          {controlsSlot}
        </div>
      </header>

      {/* Focus Area */}
      <main className="flex-1 flex flex-col max-w-wide w-full mx-auto p-4 sm:p-6">
        {children}
      </main>
    </div>
  );
}
