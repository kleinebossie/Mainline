"use client";

import Link from "next/link";
import { useState, useEffect } from "react";

import { trpc } from "@/lib/trpc/react";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

// The resumable onboarding checklist. Reads live state so each step shows whether it is
// done; the user can jump to any step. Connect/import are M1/M2; calibration +
// constraints + reveal are M4.
export function OnboardingSteps() {
  const connections = trpc.connections.list.useQuery();
  const calibration = trpc.assessment.state.useQuery();
  const constraints = trpc.constraints.getCurrent.useQuery();
  const today = trpc.program.getToday.useQuery();

  const [revealSeen, setRevealSeen] = useState(false);

  useEffect(() => {
    if (typeof window !== "undefined") {
      setRevealSeen(localStorage.getItem("mainline_reveal_seen") === "true");
    }
  }, []);

  const isLoading =
    connections.isLoading ||
    calibration.isLoading ||
    constraints.isLoading ||
    today.isLoading;

  if (isLoading) {
    return (
      <ol className="flex flex-col gap-4">
        {[1, 2, 3, 4, 5].map((i) => (
          <li
            key={i}
            className="bg-card flex items-center justify-between gap-4 rounded-lg border p-4 shadow-sheet animate-pulse"
          >
            <div className="flex items-start gap-3.5 w-full">
              <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full border border-line bg-paper/40 text-xs font-mono font-medium" />
              <div className="flex-1 space-y-2 py-1">
                <div className="h-4 bg-ink/10 rounded w-1/3" />
                <div className="h-3 bg-ink/5 rounded w-2/3" />
              </div>
            </div>
            <div className="h-8 w-16 bg-ink/10 rounded-md shrink-0" />
          </li>
        ))}
      </ol>
    );
  }

  const steps = [
    {
      href: "/connections",
      title: "Connect a chess account",
      detail: "Link Lichess or a Chess.com username so we can read your games.",
      done: (connections.data?.length ?? 0) > 0,
    },
    {
      href: "/onboarding/calibration",
      title: "Skill calibration",
      detail:
        "A short, adaptive check across tactics, calculation and endgames.",
      done: calibration.data?.completed ?? false,
    },
    {
      href: "/onboarding/constraints",
      title: "Your time, goals & resources",
      detail:
        "Time, goals, formats, what you own, how you like to train, an if-then plan.",
      done: constraints.data != null,
    },
    {
      href: "/onboarding/reveal",
      title: "See where you stand",
      detail: "Your data-driven starting picture (more lands with the engine).",
      done: (today.data?.items.length ?? 0) > 0 || revealSeen,
    },
    {
      href: "/today",
      title: "Get your first program",
      detail:
        "A daily session built from your data, each item with a graded why.",
      done: (today.data?.items.length ?? 0) > 0,
    },
  ];

  return (
    <ol className="flex flex-col gap-4">
      {steps.map((step, i) => (
        <li
          key={step.href}
          className="bg-card flex items-center justify-between gap-4 rounded-lg border p-4 shadow-sheet"
        >
          <div className="flex items-start gap-3.5">
            <span
              aria-hidden
              className={cn(
                "mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full border text-xs font-mono font-medium transition-colors",
                step.done
                  ? "border-evergreen bg-evergreen text-primary-foreground"
                  : "border-line text-graphite bg-paper",
              )}
            >
              {step.done ? "✓" : i + 1}
            </span>
            <div>
              <p className="font-serif text-base font-semibold leading-tight">
                {step.title}
              </p>
              <p className="text-graphite text-sm leading-relaxed mt-1">
                {step.detail}
              </p>
            </div>
          </div>
          <Link
            href={step.href}
            className={cn(
              buttonVariants({
                variant: step.done ? "outline" : "default",
                size: "sm",
              }),
              "shrink-0",
            )}
          >
            {step.done ? "Review" : "Start"}
          </Link>
        </li>
      ))}
    </ol>
  );
}
