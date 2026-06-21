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
  ];

  return (
    <ol className="flex flex-col gap-3">
      {steps.map((step, i) => (
        <li
          key={step.href}
          className="flex items-center justify-between gap-4 rounded-md border p-4"
        >
          <div className="flex items-start gap-3">
            <span
              aria-hidden
              className={cn(
                "mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full border text-xs font-medium",
                step.done
                  ? "border-primary bg-primary text-primary-foreground"
                  : "text-muted-foreground",
              )}
            >
              {step.done ? "✓" : i + 1}
            </span>
            <div>
              <p className="font-medium">{step.title}</p>
              <p className="text-muted-foreground text-sm">{step.detail}</p>
            </div>
          </div>
          <Link
            href={step.href}
            className={cn(
              buttonVariants({ variant: step.done ? "ghost" : "default", size: "sm" }),
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
