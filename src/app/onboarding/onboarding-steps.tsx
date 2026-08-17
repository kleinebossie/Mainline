"use client";

import Link from "next/link";
import { Check } from "lucide-react";

import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { OnboardingStatus } from "@/server/onboarding";

// The guided setup checklist. All five completion states come from persisted server
// state so revisiting this page never resets visible progress.

import { useEffect, useState } from "react";
import { getGuestSession, type GuestSessionData } from "@/lib/guest-session";

interface Step {
  href: string;
  title: string;
  detail: string;
  done: boolean;
  required: boolean;
}

export function OnboardingSteps({ status }: { status: OnboardingStatus }) {
  const [guestSession, setGuestSession] = useState<GuestSessionData | null>(null);

  useEffect(() => {
    setGuestSession(getGuestSession());
  }, []);

  const details: Record<string, string> = {
    "/onboarding/constraints": "Set your time, goals, and playing formats.",
    "/connections": "Link Lichess or add a Chess.com username.",
    "/onboarding/calibration": "Complete a short adaptive puzzle check.",
    "/onboarding/reveal":
      "Review your starting picture and solve your first blunder drill.",
    "/today": "Create your first daily training session.",
  };

  const steps: Step[] = status.steps.map((step) => {
    let done = step.done;
    if (step.href === "/onboarding/constraints" && guestSession?.constraints != null) {
      done = true;
    }
    if (
      step.href === "/connections" &&
      ((guestSession?.connections && guestSession.connections.length > 0) ||
        Boolean(guestSession?.baseline?.username))
    ) {
      done = true;
    }
    if (
      step.href === "/onboarding/calibration" &&
      Boolean(guestSession?.baseline?.calibratedAt)
    ) {
      done = true;
    }
    if (step.href === "/today" && guestSession?.program != null) {
      done = true;
    }
    return {
      href: step.href,
      title: step.label,
      detail: details[step.href] ?? "Complete this setup step.",
      done,
      required: step.required,
    };
  });

  const doneCount = steps.filter((step) => step.done).length;
  const requiredDone = steps.filter(
    (step) => step.required && step.done,
  ).length;
  const requiredCount = steps.filter((step) => step.required).length;
  const isComplete = requiredCount > 0 && requiredDone === requiredCount;
  const nextStep =
    steps.find((step) => step.required && !step.done) ??
    steps.find((step) => !step.done);

  return (
    <div className="flex flex-col gap-6">
      <div className="bg-card rounded-lg border p-5 shadow-sheet">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="eyebrow !text-[0.65rem]">Setup progress</p>
            <p className="font-serif text-lg font-semibold mt-1">
              {doneCount} of {steps.length} steps done
            </p>
          </div>
          <div className="grid grid-cols-5 gap-1.5" aria-hidden>
            {steps.map((step) => (
              <span
                key={step.href}
                className={cn(
                  "h-2 w-8 rounded-full transition-colors sm:w-10",
                  step.done ? "bg-evergreen" : "bg-line",
                )}
              />
            ))}
          </div>
        </div>
      </div>

      <div
        className={cn(
          "rounded-lg border px-4 py-3",
          isComplete
            ? "border-evergreen/30 bg-evergreen/[0.06]"
            : "border-line bg-card",
        )}
        role="status"
      >
        <p className="font-serif text-sm font-semibold text-ink">
          {isComplete
            ? "Required setup complete"
            : `${requiredDone} of ${requiredCount} required steps done`}
        </p>
        <p className="mt-1 text-sm text-graphite">
          {isComplete
            ? "Daily training is unlocked. Finish the last two steps when you are ready."
            : "Complete the required steps to unlock daily training."}
        </p>
      </div>

      <ol className="flex flex-col gap-4">
        {steps.map((step, i) => {
          const isNext = step === nextStep;
          return (
            <li
              key={step.href}
              className={cn(
                "bg-card flex flex-col items-stretch gap-4 rounded-lg border p-4 shadow-sheet transition-all sm:flex-row sm:items-center sm:justify-between",
                isNext && "ring-2 ring-evergreen/40 border-evergreen/40",
              )}
            >
              <div className="flex items-start gap-3.5">
                <span
                  aria-hidden
                  className={cn(
                    "mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full border text-xs font-mono font-medium transition-colors",
                    step.done
                      ? "border-evergreen bg-evergreen text-primary-foreground"
                      : isNext
                        ? "border-evergreen bg-evergreen/10 text-evergreen"
                        : "border-line text-graphite bg-paper",
                  )}
                >
                  {step.done ? (
                    <Check
                      className="h-3.5 w-3.5 stroke-[2.5]"
                      aria-hidden="true"
                    />
                  ) : (
                    i + 1
                  )}
                </span>
                <div>
                  <div className="flex items-center gap-2">
                    <p className="font-serif text-base font-semibold leading-tight">
                      {step.title}
                    </p>
                    {step.required && (
                      <span className="text-graphite font-mono text-[0.6rem] uppercase tracking-wider">
                        required
                      </span>
                    )}
                  </div>
                  <p className="text-graphite text-sm leading-relaxed mt-1">
                    {step.detail}
                  </p>
                  {!step.done && !isNext && i > 0 && (
                    <p className="mt-1 font-mono text-[0.65rem] text-graphite">
                      Complete the step above to unlock.
                    </p>
                  )}
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
                {step.done ? "Review" : isNext ? "Start" : "Open"}
              </Link>
            </li>
          );
        })}
      </ol>
    </div>
  );
}
