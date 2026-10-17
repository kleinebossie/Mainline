"use client";

import * as React from "react";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
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
  mainClassName?: string;
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
  mainClassName,
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
      <header className="h-[48px] sm:h-[52px] border-b border-line bg-paper/85 backdrop-blur-md px-3 sm:px-4 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-2 sm:gap-3 min-w-0">
          {confirmExit ? (
            <Dialog open={confirmOpen} onOpenChange={setConfirmOpen}>
              <DialogTrigger asChild>
                <button
                  type="button"
                  aria-label="Exit training"
                  className="inline-flex items-center gap-1.5 rounded-xs text-graphite hover:text-ink hover:bg-ink/[0.04] px-2 py-1 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  <ArrowLeft className="h-4 w-4" aria-hidden="true" />
                  <span className="text-xs font-medium">Today</span>
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
              className="inline-flex items-center gap-1.5 rounded-xs text-graphite hover:text-ink hover:bg-ink/[0.04] px-2 py-1 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <ArrowLeft className="h-4 w-4" aria-hidden="true" />
              <span className="text-xs font-medium">Today</span>
            </Link>
          )}

          {title && (
            <div className="font-sans text-xs sm:text-sm font-semibold text-ink truncate">
              {title}
            </div>
          )}
        </div>

        <div className="flex items-center gap-2 sm:gap-3 shrink-0">
          {progressSlot}
          {controlsSlot}
        </div>
      </header>

      {/* Focus Area */}
      <main
        className={cn(
          "flex-1 flex flex-col max-w-wide w-full mx-auto px-3 py-2 sm:p-6",
          mainClassName,
        )}
      >
        {children}
      </main>
    </div>
  );
}
