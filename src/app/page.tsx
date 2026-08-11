import Link from "next/link";
import { redirect } from "next/navigation";
import { LandingIcon, type LandingIconName } from "@/components/landing-icons";

import { cn } from "@/lib/utils";
import { beginSelectedBetaSignIn } from "@/app/signin/actions";
import { PendingSubmitButton } from "@/components/pending-submit-button";
import { buttonVariants } from "@/components/ui/button";
import { prisma } from "@/db/client";
import { auth } from "@/server/auth";
import { getPostAuthDestination } from "@/server/onboarding";

const SETUP_STEPS = [
  {
    label: "Connect",
    title: "Bring your games",
    detail:
      "Link Lichess or add Chess.com so Mainline can work from your actual play.",
  },
  {
    label: "Calibrate",
    title: "Establish a baseline",
    detail:
      "Complete a short tactical check. We measure play instead of asking you to rate yourself.",
  },
  {
    label: "Constrain",
    title: "Define your reality",
    detail:
      "Set your available time, goals, formats, preferences, and resources you already own.",
  },
  {
    label: "Reveal",
    title: "See the starting picture",
    detail:
      "Review the useful signals, the uncertainty, and what the program can act on first.",
  },
  {
    label: "Train",
    title: "Open today’s session",
    detail:
      "Get a practical plan that fits today, with a reason attached to every activity.",
  },
] as const;

interface PrincipleItem {
  icon: LandingIconName;
  title: string;
  detail: string;
}

const PRINCIPLES: PrincipleItem[] = [
  {
    icon: "help",
    title: "Every recommendation explains why",
    detail:
      "See why this activity made the plan, why it matters now, and how strong the supporting evidence is.",
  },
  {
    icon: "shield-alert",
    title: "No rating promises",
    detail:
      "No training activity has been proven to cause rating gains. Mainline will not turn uncertainty into a sales pitch.",
  },
  {
    icon: "refresh",
    title: "The plan keeps moving",
    detail:
      "New games and completed training reshape what comes next. There is no generic syllabus to fall behind on.",
  },
  {
    icon: "shield-check",
    title: "Your data stays under your control",
    detail:
      "Connections are read-only. Your data is never sold, and you can export or delete it whenever you choose.",
  },
  {
    icon: "cpu",
    title: "No runtime AI",
    detail:
      "The product uses open data, transparent rules, and a client-side chess engine, not an opaque chatbot deciding your training.",
  },
  {
    icon: "unlock",
    title: "Training quality is never paywalled",
    detail:
      "Mainline is free, without ads. Optional patronage may support the project, but never buys better training.",
  },
];

export default async function Home() {
  const session = await auth();

  if (session?.user) {
    redirect(await getPostAuthDestination(prisma, session.user.id));
  }

  const googleEnabled = Boolean(
    process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET,
  );

  return (
    <main className="min-h-screen overflow-x-clip">
      <header className="bg-paper/90 sticky top-0 z-30 border-b border-line/80 backdrop-blur-md">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-6 px-4 sm:px-6">
          <Link
            href="/"
            className="rounded-sm font-mono text-sm font-bold uppercase tracking-[0.2em] text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
          >
            Mainline
            <span className="text-evergreen tracking-normal" aria-hidden>
              ·!
            </span>
          </Link>
          <nav
            aria-label="Landing page navigation"
            className="flex items-center gap-3 font-mono text-[0.7rem] text-graphite sm:gap-6 sm:text-xs"
          >
            <a
              className="transition-colors hover:text-ink"
              href="#how-it-works"
            >
              How it works
            </a>
            <a className="transition-colors hover:text-ink" href="#principles">
              Principles
            </a>
            <Link className="transition-colors hover:text-ink" href="/about">
              About
            </Link>
          </nav>
          <a href="#get-started" className={buttonVariants({ size: "sm" })}>
            Get started
          </a>
        </div>
      </header>

      <section className="relative border-b border-line/80">
        <div
          aria-hidden
          className="pointer-events-none absolute inset-y-0 left-1/2 hidden w-px bg-line/80 lg:block"
        />
        <div className="mx-auto grid max-w-6xl lg:grid-cols-2">
          <div className="settle flex flex-col justify-center px-4 py-16 sm:px-6 sm:py-24 lg:min-h-[690px] lg:pr-16">
            <p className="eyebrow text-evergreen">
              Personal chess training, properly directed
            </p>
            <h1 className="mt-5 max-w-xl font-serif text-5xl font-semibold leading-[0.98] tracking-[-0.04em] sm:text-7xl">
              Stop guessing what to train.
            </h1>
            <p className="mt-7 max-w-lg font-serif text-xl leading-relaxed text-graphite sm:text-2xl">
              Mainline turns your games, goals, and available time into a daily
              chess training program that keeps adapting.
            </p>
            <p className="mt-5 max-w-lg text-base leading-relaxed text-graphite">
              It sits above puzzle trainers, game analysis, books, and courses.
              Instead of giving you more material, it decides what deserves your
              attention today, then tells you why.
            </p>
            <div className="mt-9 flex flex-wrap items-center gap-4">
              <a href="#get-started" className={buttonVariants({ size: "lg" })}>
                Build my training plan
              </a>
              <a
                href="#how-it-works"
                className="rounded-sm font-mono text-sm text-graphite underline decoration-line underline-offset-4 transition-colors hover:text-ink"
              >
                See what setup involves
              </a>
            </div>
            <p className="mt-4 font-mono text-[0.68rem] uppercase tracking-[0.12em] text-graphite">
              Closed beta · invite required · free to use
            </p>
          </div>

          <div className="settle flex items-center bg-ink px-4 py-12 text-paper [animation-delay:100ms] sm:px-6 sm:py-16 lg:min-h-[690px] lg:pl-16">
            <div className="mx-auto w-full max-w-md">
              <div className="flex items-end justify-between gap-4 border-b border-paper/15 pb-4">
                <div>
                  <p className="font-mono text-[0.65rem] uppercase tracking-[0.2em] text-evergreen-bright">
                    Illustrative training line
                  </p>
                  <h2 className="mt-2 font-serif text-2xl font-semibold">
                    A plan from your reality
                  </h2>
                </div>
                <span className="font-mono text-xs text-paper/50">Today</span>
              </div>

              <div className="grid grid-cols-[1fr_auto] gap-x-5 gap-y-3 border-b border-paper/15 py-5 font-mono text-xs">
                <span className="text-paper/50">Time available</span>
                <span>25 minutes</span>
                <span className="text-paper/50">Recent signal</span>
                <span>missed conversions</span>
                <span className="text-paper/50">Goal</span>
                <span>stronger OTB play</span>
                <span className="text-paper/50">Due practice</span>
                <span>2 reviews</span>
              </div>

              <div className="relative space-y-3 py-6 before:absolute before:bottom-10 before:left-[1.18rem] before:top-10 before:w-px before:bg-evergreen-bright/40">
                <TrainingBlock
                  number="1"
                  minutes="10 min"
                  title="Repair your own mistakes"
                  reason="Recent games supply the positions."
                  delay="[animation-delay:150ms]"
                />
                <TrainingBlock
                  number="2"
                  minutes="8 min"
                  title="Review what is due"
                  reason="Completed work returns when it is useful."
                  delay="[animation-delay:250ms]"
                />
                <TrainingBlock
                  number="3"
                  minutes="7 min"
                  title="Build the current priority"
                  reason="The session fits the goal and time left."
                  delay="[animation-delay:350ms]"
                />
              </div>

              <div className="border-t border-dashed border-paper/20 pt-4">
                <p className="flex items-start gap-3 font-serif text-sm leading-relaxed text-paper/65">
                  <LandingIcon name="help" className="mt-0.5 h-4 w-4 shrink-0 text-evergreen-bright" />
                  Every block carries its evidence grade, the data that
                  triggered it, and an honest explanation of uncertainty.
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section
        id="how-it-works"
        className="scroll-mt-16 border-b border-line/80 bg-paper-raised/70"
      >
        <div className="mx-auto max-w-6xl px-4 py-20 sm:px-6 sm:py-24">
          <div className="grid gap-8 lg:grid-cols-[0.72fr_1.28fr] lg:gap-16">
            <div>
              <p className="eyebrow">Your first session</p>
              <h2 className="mt-4 font-serif text-4xl font-semibold leading-tight sm:text-5xl">
                Five steps from scattered data to a useful day.
              </h2>
              <p className="mt-5 max-w-md leading-relaxed text-graphite">
                Setup gives Mainline enough context to make a defensible first
                plan. You can change every constraint later.
              </p>
            </div>

            <ol className="border-t border-line">
              {SETUP_STEPS.map((step, index) => (
                <li
                  key={step.label}
                  className="grid gap-2 border-b border-line py-5 sm:grid-cols-[2rem_7rem_1fr] sm:items-baseline sm:gap-4"
                >
                  <span className="font-mono text-xs text-evergreen">
                    {index + 1}
                  </span>
                  <span className="font-mono text-xs font-semibold uppercase tracking-[0.12em] text-ink">
                    {step.label}
                  </span>
                  <div>
                    <h3 className="font-serif text-lg font-semibold">
                      {step.title}
                    </h3>
                    <p className="mt-1 text-sm leading-relaxed text-graphite">
                      {step.detail}
                    </p>
                  </div>
                </li>
              ))}
            </ol>
          </div>
          <p className="ml-auto mt-10 max-w-2xl border-l-2 border-evergreen/50 pl-5 font-serif text-xl leading-relaxed text-ink">
            After setup, the loop is simple: train, play, and let new outcomes
            change what deserves attention next.
          </p>
        </div>
      </section>

      <section id="principles" className="scroll-mt-16 border-b border-line/80">
        <div className="mx-auto max-w-6xl px-4 py-20 sm:px-6 sm:py-24">
          <div className="max-w-2xl">
            <p className="eyebrow">The no-BS part</p>
            <h2 className="mt-4 font-serif text-4xl font-semibold leading-tight sm:text-5xl">
              Trust should be visible in the product.
            </h2>
            <p className="mt-5 text-lg leading-relaxed text-graphite">
              Mainline is science-based without pretending the science is
              stronger than it is. Its boundaries are part of the product, not
              fine print.
            </p>
          </div>

          <div className="mt-12 grid border-l border-t border-line sm:grid-cols-2 lg:grid-cols-3">
            {PRINCIPLES.map((principle) => (
              <article
                key={principle.title}
                className="border-b border-r border-line bg-paper-raised/50 p-6 sm:p-7"
              >
                <div className="flex h-10 w-10 items-center justify-center rounded-lg border border-line/80 bg-paper text-evergreen shadow-xs">
                  <LandingIcon name={principle.icon} className="h-5 w-5 stroke-[1.75]" />
                </div>
                <h3 className="mt-5 font-serif text-xl font-semibold leading-snug">
                  {principle.title}
                </h3>
                <p className="mt-3 text-sm leading-relaxed text-graphite">
                  {principle.detail}
                </p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section id="get-started" className="scroll-mt-16 bg-ink text-paper">
        <div className="mx-auto grid max-w-6xl gap-12 px-4 py-20 sm:px-6 sm:py-24 lg:grid-cols-[1fr_0.82fr] lg:items-center lg:gap-20">
          <div>
            <p className="font-mono text-[0.68rem] font-medium uppercase tracking-[0.2em] text-evergreen-bright">
              Step 1 · create your account
            </p>
            <h2 className="mt-5 max-w-xl font-serif text-4xl font-semibold leading-tight sm:text-6xl">
              Give your chess training a main line.
            </h2>
            <p className="mt-6 max-w-lg text-lg leading-relaxed text-paper/65">
              Mainline is currently in closed beta. Enter your invite code, sign
              in, and we will take you straight to connecting your games.
            </p>
          </div>

          <form
            action={beginSelectedBetaSignIn}
            className="bg-paper text-ink rounded-lg border border-paper/10 p-6 shadow-sheet sm:p-8"
          >
            <label
              htmlFor="landing-invite"
              className="font-mono text-xs font-medium uppercase tracking-[0.12em]"
            >
              Invite code
            </label>
            <p
              id="landing-invite-help"
              className="mt-2 text-sm leading-relaxed text-graphite"
            >
              Optional if your email is already allowlisted.
            </p>
            <input
              id="landing-invite"
              name="inviteCode"
              autoComplete="one-time-code"
              maxLength={128}
              aria-describedby="landing-invite-help"
              className="mt-4 h-12 w-full rounded-md border border-input bg-paper-raised px-3 font-mono text-sm outline-none transition-shadow focus:ring-2 focus:ring-ring focus:ring-offset-2 focus:ring-offset-paper"
            />
            <div className="mt-4 grid gap-3">
              <PendingSubmitButton
                name="provider"
                value="lichess"
                pendingLabel="Opening Lichess…"
                className={buttonVariants({
                  size: "lg",
                  className: "w-full",
                })}
              >
                Continue with Lichess
              </PendingSubmitButton>
              {googleEnabled && (
                <PendingSubmitButton
                  name="provider"
                  value="google"
                  pendingLabel="Opening Google…"
                  className={buttonVariants({
                    variant: "outline",
                    size: "lg",
                    className: "w-full",
                  })}
                >
                  Continue with Google
                </PendingSubmitButton>
              )}
            </div>
            <p className="mt-6 border-t border-line pt-5 text-center font-mono text-[0.68rem] leading-relaxed text-graphite">
              Read-only connections · no password stored · export or delete your
              data at any time
            </p>
          </form>
        </div>
      </section>

      <footer className="border-t border-paper/10 bg-ink text-paper/50">
        <div className="mx-auto flex max-w-6xl flex-col gap-3 px-4 py-7 font-mono text-[0.68rem] sm:flex-row sm:items-center sm:justify-between sm:px-6">
          <span className="uppercase tracking-[0.18em]">
            Mainline · science-based chess training
          </span>
          <div className="flex items-center gap-6">
            <span>No ads · no runtime AI · no rating promises</span>
            <Link className="transition-colors hover:text-paper" href="/about">
              About
            </Link>
          </div>
        </div>
      </footer>
    </main>
  );
}

function TrainingBlock({
  number,
  minutes,
  title,
  reason,
  delay = "[animation-delay:150ms]",
}: {
  number: string;
  minutes: string;
  title: string;
  reason: string;
  delay?: string;
}) {
  return (
    <div
      className={cn(
        "settle relative grid grid-cols-[2.4rem_1fr_auto] items-start gap-3 rounded-md border border-paper/10 bg-paper/[0.04] p-3.5",
        delay,
      )}
    >
      <span className="relative z-10 flex h-6 w-6 items-center justify-center rounded-full bg-evergreen font-mono text-[0.65rem] font-semibold text-primary-foreground">
        {number}
      </span>
      <div>
        <h3 className="font-serif text-base font-semibold">{title}</h3>
        <p className="mt-1 text-xs leading-relaxed text-paper/50">{reason}</p>
      </div>
      <span className="font-mono text-[0.68rem] text-paper/50">{minutes}</span>
    </div>
  );
}
