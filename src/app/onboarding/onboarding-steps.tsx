"use client";

import Link from "next/link";

import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { OnboardingStatus } from "@/server/onboarding";

// The guided onboarding checklist. The server passes the mandatory-step status
// (connections, calibration, constraints); the client adds the optional reveal
// and first-program steps. The flow is linear: each incomplete step shows a
// prominent "Start" CTA, and the next incomplete step is highlighted so the user
// always knows what to do next.

interface Step {
  href: string;
  title: string;
  detail: string;
  done: boolean;
  mandatory: boolean;
}

export function OnboardingSteps({ status }: { status: OnboardingStatus }) {
  // The mandatory steps come from the server-side guard. The reveal and
  // first-program steps are optional follow-ups that don't block the app.
  const steps: Step[] = [
    {
      href: "/connections",
      title: "Connect a chess account",
      detail:
        "Link Lichess or add a Chess.com username so we can read your games.",
      done: status.steps[0]?.done ?? false,
      mandatory: true,
    },
    {
      href: "/onboarding/calibration",
      title: "Tactical calibration",
      detail:
        "A short adaptive puzzle check to build a rough behavioural baseline.",
      done: status.steps[1]?.done ?? false,
      mandatory: true,
    },
    {
      href: "/onboarding/constraints",
      title: "Your time, goals & formats",
      detail:
        "How much time you have, what you play, what you own, and how you like to train.",
      done: status.steps[2]?.done ?? false,
      mandatory: true,
    },
    {
      href: "/onboarding/reveal",
      title: "See where you stand",
      detail:
        "Your data-driven starting picture: calibration results, game signals, and your goals.",
      done: false,
      mandatory: false,
    },
    {
      href: "/today",
      title: "Get your first session",
      detail:
        "A daily training session built from your data, each item with a graded why.",
      done: false,
      mandatory: false,
    },
  ];

  // The first incomplete mandatory step is the "next action."
  const nextMandatory = steps.find((s) => s.mandatory && !s.done);
  const allMandatoryDone = !nextMandatory;

  return (
    <div className="flex flex-col gap-6">
      {/* Progress summary */}
      <div className="bg-card rounded-lg border p-5 shadow-sheet">
        <div className="flex items-center justify-between gap-4">
          <div>
            <p className="eyebrow !text-[0.65rem]">Setup progress</p>
            <p className="font-serif text-lg font-semibold mt-1">
              {status.steps.filter((s) => s.done).length} of{" "}
              {status.steps.length} required steps done
            </p>
          </div>
          <div className="flex items-center gap-1.5">
            {status.steps.map((s, i) => (
              <span
                key={i}
                aria-hidden
                className={cn(
                  "h-2 w-10 rounded-full transition-colors",
                  s.done ? "bg-evergreen" : "bg-line",
                )}
              />
            ))}
          </div>
        </div>
        {allMandatoryDone ? (
          <p className="text-graphite text-sm leading-relaxed mt-3 font-serif">
            All set. Head to your reveal and first session whenever you&apos;re
            ready.
          </p>
        ) : (
          <p className="text-graphite text-sm leading-relaxed mt-3 font-serif">
            Complete all required steps to unlock your daily training sessions.
          </p>
        )}
      </div>

      {/* Step list */}
      <ol className="flex flex-col gap-4">
        {steps.map((step, i) => {
          const isNext = step === nextMandatory;
          return (
            <li
              key={step.href}
              className={cn(
                "bg-card flex items-center justify-between gap-4 rounded-lg border p-4 shadow-sheet transition-all",
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
                  {step.done ? "\u2713" : i + 1}
                </span>
                <div>
                  <div className="flex items-center gap-2">
                    <p className="font-serif text-base font-semibold leading-tight">
                      {step.title}
                    </p>
                    {step.mandatory && (
                      <span className="text-graphite font-mono text-[0.6rem] uppercase tracking-wider">
                        required
                      </span>
                    )}
                  </div>
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
                {step.done ? "Review" : isNext ? "Start" : "Open"}
              </Link>
            </li>
          );
        })}
      </ol>

      {/* Next action CTA */}
      {nextMandatory && (
        <div className="bg-evergreen/[0.06] border border-evergreen/30 rounded-lg p-5 flex items-center justify-between gap-4">
          <div>
            <p className="eyebrow !text-[0.65rem] text-evergreen">Next step</p>
            <p className="font-serif text-base font-semibold mt-1">
              {nextMandatory.title}
            </p>
          </div>
          <Link
            href={nextMandatory.href}
            className={cn(buttonVariants(), "shrink-0")}
          >
            Start now
          </Link>
        </div>
      )}

      {allMandatoryDone && (
        <div className="bg-evergreen/[0.06] border border-evergreen/30 rounded-lg p-5 flex items-center justify-between gap-4">
          <div>
            <p className="eyebrow !text-[0.65rem] text-evergreen">
              You&apos;re ready
            </p>
            <p className="font-serif text-base font-semibold mt-1">
              See your starting picture and build your first session.
            </p>
          </div>
          <Link
            href="/onboarding/reveal"
            className={cn(buttonVariants(), "shrink-0")}
          >
            Continue
          </Link>
        </div>
      )}
    </div>
  );
}
