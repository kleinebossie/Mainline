"use client";

import Link from "next/link";

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

  const steps = [
    {
      href: "/connections",
      title: "Connect a chess account",
      detail: "Link Lichess or a Chess.com username so we can read your games.",
      done: (connections.data?.length ?? 0) > 0,
    },
    {
      href: "/onboarding/calibration",
      title: "Tactical calibration",
      detail: "A short, adaptive check that estimates your tactical level.",
      done: calibration.data?.completed ?? false,
    },
    {
      href: "/onboarding/constraints",
      title: "Your time & goals",
      detail: "How much you can train, what you want, and an if-then plan.",
      done: constraints.data != null,
    },
    {
      href: "/onboarding/reveal",
      title: "See where you stand",
      detail: "Your data-driven starting picture (more lands with the engine).",
      done: false,
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
              <p className="font-serif text-base font-semibold leading-tight">{step.title}</p>
              <p className="text-graphite text-sm leading-relaxed mt-1">{step.detail}</p>
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
