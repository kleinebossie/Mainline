"use client";

import Link from "next/link";

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
  const [guestSession, setGuestSession] = useState<GuestSessionData | null>(
    null,
  );
  const [revealSeen, setRevealSeen] = useState(false);

  useEffect(() => {
    setGuestSession(getGuestSession());
    setRevealSeen(
      typeof window !== "undefined" &&
        localStorage.getItem("mainline_reveal_seen") === "true",
    );
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
    if (
      step.href === "/onboarding/constraints" &&
      guestSession?.constraints != null
    ) {
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
      (Boolean(guestSession?.baseline?.calibratedAt) ||
        (guestSession?.calibrationResponses &&
          guestSession.calibrationResponses.length >= 3))
    ) {
      done = true;
    }
    if (
      step.href === "/onboarding/reveal" &&
      (revealSeen ||
        guestSession?.program != null ||
        Boolean(guestSession?.baseline?.calibratedAt) ||
        (guestSession?.calibrationResponses &&
          guestSession.calibrationResponses.length >= 3))
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
      <div className="sheet flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
        <p className="font-mono text-[0.85rem] font-semibold text-ink">
          {doneCount} of {steps.length} steps done
        </p>
        <div
          className="flex gap-1"
          role="img"
          aria-label={`${doneCount} of ${steps.length} setup steps complete`}
        >
          {steps.map((step) => (
            <span
              key={step.href}
              className={cn(
                "h-1.5 w-8 rounded-[1px] sm:w-12",
                step.done ? "bg-biro" : "bg-ink/[0.12]",
              )}
            />
          ))}
        </div>
      </div>

      {isComplete ? (
        <div className="sheet flex flex-col items-start justify-between gap-4 border-tile/45 p-5 sm:flex-row sm:items-center">
          <div>
            <p className="label-ink">Ready to train</p>
            <p className="text-lg font-semibold text-ink mt-1">
              Your first daily training session is ready
            </p>
            <p className="text-graphite font-serif text-sm mt-0.5 max-w-lg">
              You can start training right now, or finish connecting your
              accounts and calibration below to refine your starting signals.
            </p>
          </div>
          <Link
            href="/today"
            className={cn(buttonVariants({ size: "default" }), "shrink-0")}
          >
            Start Today&apos;s session
          </Link>
        </div>
      ) : (
        <div className="sheet px-4 py-3" role="status">
          <p className="text-sm font-semibold">
            {`${requiredDone} of ${requiredCount} required steps done`}
          </p>
          <p className="mt-1 text-sm text-graphite">
            Complete the required constraints step to unlock daily training.
          </p>
        </div>
      )}

      <ol className="sheet rule-list" aria-label="Setup steps">
        {steps.map((step, i) => {
          const isNext = step === nextStep;
          return (
            <li
              key={step.href}
              className={cn(
                "relative flex flex-col items-stretch gap-3 py-4 pl-6 pr-4 sm:flex-row sm:items-center sm:justify-between",
                isNext && !step.done && "bg-biro/[0.04]",
              )}
            >
              {isNext && !step.done && (
                <span
                  aria-hidden
                  className="absolute inset-y-0 left-0 w-[3px] bg-biro"
                />
              )}
              <div className="flex min-w-0 items-start gap-3">
                <span
                  aria-hidden
                  className={cn(
                    "font-mono mt-px shrink-0 text-[0.85rem] font-semibold",
                    step.done
                      ? "text-tile"
                      : isNext
                        ? "text-biro"
                        : "text-graphite",
                  )}
                >
                  {i + 1}.
                </span>
                <div className="min-w-0">
                  <p className="flex flex-wrap items-baseline gap-x-2 text-[1.02rem] font-semibold leading-snug">
                    <span className={step.done ? "text-graphite" : undefined}>
                      {step.title}
                    </span>
                    {step.done ? (
                      <span className="font-mono text-[0.72rem] font-semibold text-tile">
                        done
                      </span>
                    ) : (
                      step.required && (
                        <span className="font-mono text-[0.7rem] text-graphite">
                          required
                        </span>
                      )
                    )}
                  </p>
                  <p className="font-serif mt-1 max-w-[52ch] text-[0.92rem] leading-relaxed text-graphite">
                    {step.detail}
                  </p>
                </div>
              </div>
              <Link
                href={step.href}
                className={cn(
                  buttonVariants({
                    variant: step.done
                      ? "outline"
                      : isNext
                        ? "default"
                        : "ghost",
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
