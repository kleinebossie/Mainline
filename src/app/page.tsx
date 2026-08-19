import Link from "next/link";
import { redirect } from "next/navigation";
import { LandingIcon, type LandingIconName } from "@/components/landing-icons";

import { cn } from "@/lib/utils";
import { beginSelectedBetaSignIn } from "@/app/signin/actions";
import { PendingSubmitButton } from "@/components/pending-submit-button";
import { buttonVariants } from "@/components/ui/button";
import { HomepageBlunderAnalyzer } from "@/components/homepage-blunder-analyzer";
import { LandingTelemetry } from "@/components/landing-telemetry";
import { GuestLandingButton } from "@/components/guest-landing-button";
import { prisma } from "@/db/client";

import { auth } from "@/server/auth";
import { getPostAuthDestination } from "@/server/onboarding";

const SETUP_STEPS = [
  {
    label: "Constrain",
    title: "Set your constraints",
    detail:
      "Set your daily time budget, format preferences, goals, and owned books.",
  },
  {
    label: "Connect",
    title: "Connect your accounts",
    detail:
      "Link Lichess or Chess.com to import your public games and tactical mistakes.",
  },
  {
    label: "Calibrate",
    title: "Measure your baseline",
    detail:
      "Solve a short 3-puzzle check to estimate tactical rating and blunder patterns.",
  },
  {
    label: "Reveal",
    title: "See your starting profile",
    detail:
      "Review your tactical rating, game signals, and initial training priorities.",
  },
  {
    label: "Train",
    title: "Start your daily session",
    detail:
      "Train with personalized blocks that adapt as you complete exercises and play games.",
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
    title: "Every recommendation shows evidence",
    detail:
      "Every training block displays its evidence grade, research citations, and scheduling reason.",
  },
  {
    icon: "shield-alert",
    title: "No rating promises",
    detail:
      "No study proves that specific chess training causes rating gains. Mainline uses best evidence without false certainty.",
  },
  {
    icon: "refresh",
    title: "Adapts to your play",
    detail:
      "New games, mistake drills, and completed reviews reshape what Mainline schedules next.",
  },
  {
    icon: "shield-check",
    title: "Your data stays private",
    detail:
      "Connections are read-only. We do not sell your data, and you can export or delete your account at any time.",
  },
  {
    icon: "cpu",
    title: "No runtime AI",
    detail:
      "Mainline uses deterministic algorithms and a client-side Stockfish engine, never generative chatbots.",
  },
  {
    icon: "unlock",
    title: "Core training is never paywalled",
    detail:
      "Mainline is free and ad-free. Optional supporter tiers fund hosting without locking training features.",
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
            className="hidden items-center gap-5 font-mono text-xs text-graphite md:flex"
          >
            <a
              className="transition-colors hover:text-ink"
              href="#blunder-analyzer"
            >
              Analyze games
            </a>
            <a
              className="transition-colors hover:text-ink"
              href="#how-it-works"
            >
              How it works
            </a>
            <a className="transition-colors hover:text-ink" href="#principles">
              Principles
            </a>
          </nav>
          <a
            href="#get-started"
            className={buttonVariants({ size: "sm", className: "shrink-0" })}
          >
            Get started
          </a>
        </div>
      </header>
      <LandingTelemetry />

      <section className="relative border-b border-line/80">
        <div
          aria-hidden
          className="pointer-events-none absolute inset-y-0 left-1/2 hidden w-px bg-line/80 lg:block"
        />
        <div className="mx-auto grid max-w-6xl lg:grid-cols-2">
          <div className="settle flex flex-col justify-center px-4 py-12 sm:px-6 sm:py-20 lg:min-h-[690px] lg:pr-16">
            <p className="eyebrow text-evergreen">
              Evidence-based chess training
            </p>
            <h1 className="mt-4 max-w-xl font-serif text-4xl font-semibold leading-[1.02] tracking-[-0.03em] sm:text-6xl lg:text-7xl">
              Stop guessing what to train.
            </h1>
            <p className="mt-6 max-w-lg font-serif text-lg leading-relaxed text-graphite sm:text-2xl">
              Mainline converts your games, goals, and daily time into an
              adaptive training program grounded in learning science.
            </p>
            <p className="mt-4 max-w-lg text-sm sm:text-base leading-relaxed text-graphite">
              Instead of giving you endless random puzzles, Mainline targets
              your measured mistakes and schedules spaced reviews.
            </p>
            <div className="mt-8 flex flex-col sm:flex-row sm:items-center gap-3.5">
              <a
                href="#blunder-analyzer"
                className={buttonVariants({
                  size: "lg",
                  className: "w-full sm:w-auto text-center justify-center",
                })}
              >
                Analyze my games
              </a>
              <a
                href="#how-it-works"
                className="text-center rounded-sm font-mono text-xs sm:text-sm text-graphite underline decoration-line underline-offset-4 transition-colors hover:text-ink py-1"
              >
                See how setup works
              </a>
            </div>
            <p className="mt-4 font-mono text-[0.68rem] uppercase tracking-[0.12em] text-graphite">
              Open beta · no sign-in required
            </p>
          </div>

          <div className="settle flex items-center bg-ink px-4 py-12 text-paper [animation-delay:100ms] sm:px-6 sm:py-16 lg:min-h-[690px] lg:pl-16">
            <div className="mx-auto w-full max-w-md">
              <div className="flex items-end justify-between gap-4 border-b border-paper/15 pb-4">
                <div>
                  <p className="font-mono text-[0.65rem] uppercase tracking-[0.2em] text-evergreen-bright">
                    Example daily session
                  </p>
                  <h2 className="mt-2 font-serif text-2xl font-semibold">
                    Structured daily training
                  </h2>
                </div>
                <span className="font-mono text-xs text-paper/50">Today</span>
              </div>

              <div className="grid grid-cols-[1fr_auto] gap-x-5 gap-y-3 border-b border-paper/15 py-5 font-mono text-xs">
                <span className="text-paper/50">Time budget</span>
                <span>25 minutes</span>
                <span className="text-paper/50">Primary weakness</span>
                <span>tactical conversions</span>
                <span className="text-paper/50">Format goal</span>
                <span>rapid chess</span>
                <span className="text-paper/50">Due reviews</span>
                <span>2 blocks</span>
              </div>

              <div className="relative space-y-3 py-6 before:absolute before:bottom-10 before:left-[1.18rem] before:top-10 before:w-px before:bg-evergreen-bright/40">
                <TrainingBlock
                  number="1"
                  minutes="10 min"
                  title="Blunder drills from your games"
                  reason="Positions extracted directly from your recent losses."
                  delay="[animation-delay:150ms]"
                />
                <TrainingBlock
                  number="2"
                  minutes="8 min"
                  title="Spaced repetition reviews"
                  reason="Scheduled based on past mistake review intervals."
                  delay="[animation-delay:250ms]"
                />
                <TrainingBlock
                  number="3"
                  minutes="7 min"
                  title="Endgame conversion drills"
                  reason="Practical endgame structures matched to your rating."
                  delay="[animation-delay:350ms]"
                />
              </div>

              <div className="border-t border-dashed border-paper/20 pt-4">
                <p className="flex items-start gap-3 font-serif text-sm leading-relaxed text-paper/65">
                  <LandingIcon
                    name="help"
                    className="mt-0.5 h-4 w-4 shrink-0 text-evergreen-bright"
                  />
                  Every block includes an evidence grade, data source, and
                  clear explanation of uncertainty.
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section
        id="blunder-analyzer"
        className="scroll-mt-16 border-b border-line/80 bg-paper py-14 sm:py-20"
      >
        <div className="mx-auto max-w-6xl px-4 sm:px-6">
          <HomepageBlunderAnalyzer />
        </div>
      </section>

      <section
        id="how-it-works"
        className="scroll-mt-16 border-b border-line/80 bg-paper-raised/70"
      >
        <div className="mx-auto max-w-6xl px-4 py-20 sm:px-6 sm:py-24">
          <div className="grid gap-8 lg:grid-cols-[0.72fr_1.28fr] lg:gap-16">
            <div>
              <p className="eyebrow">Onboarding flow</p>
              <h2 className="mt-4 font-serif text-4xl font-semibold leading-tight sm:text-5xl">
                Five steps to your tailored daily session.
              </h2>
              <p className="mt-5 max-w-md leading-relaxed text-graphite">
                Setup configures your constraints and analyzes your game
                baseline. You can adjust settings at any time.
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
            After setup, the daily loop is simple: train your blocks, play your
            games, and let new outcomes adapt your next session.
          </p>
        </div>
      </section>

      <section id="principles" className="scroll-mt-16 border-b border-line/80">
        <div className="mx-auto max-w-6xl px-4 py-20 sm:px-6 sm:py-24">
          <div className="max-w-2xl">
            <p className="eyebrow">Methodology</p>
            <h2 className="mt-4 font-serif text-4xl font-semibold leading-tight sm:text-5xl">
              Scientific honesty in every recommendation.
            </h2>
            <p className="mt-5 text-lg leading-relaxed text-graphite">
              Mainline uses peer-reviewed cognitive science without claiming
              false guarantees. All methodology rationales are public and open.
            </p>
          </div>

          <div className="mt-12 grid border-l border-t border-line sm:grid-cols-2 lg:grid-cols-3">
            {PRINCIPLES.map((principle) => (
              <article
                key={principle.title}
                className="border-b border-r border-line bg-paper-raised/50 p-6 sm:p-7"
              >
                <div className="flex h-10 w-10 items-center justify-center rounded-lg border border-line/80 bg-paper text-evergreen shadow-xs">
                  <LandingIcon
                    name={principle.icon}
                    className="h-5 w-5 stroke-[1.75]"
                  />
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
              Get started
            </p>
            <h2 className="mt-5 max-w-xl font-serif text-4xl font-semibold leading-tight sm:text-6xl">
              Build your personal training plan.
            </h2>
            <p className="mt-6 max-w-lg text-lg leading-relaxed text-paper/65">
              Mainline is in open beta. Sign in to connect your games or try a
              local guest session.
            </p>
          </div>

          <form
            action={beginSelectedBetaSignIn}
            className="bg-paper text-ink rounded-lg border border-paper/10 p-6 shadow-sheet sm:p-8"
          >
            <h3 className="font-serif text-xl font-semibold">
              Get started in open beta
            </h3>
            <p className="mt-1 text-sm text-graphite">
              Sign in with your chess or Google account to build your plan.
            </p>
            <div className="mt-6 grid gap-3">
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
              <div className="relative my-1 flex items-center justify-center">
                <div className="w-full border-t border-line" />
                <span className="bg-paper px-3 font-mono text-[0.65rem] uppercase text-graphite">
                  or
                </span>
              </div>
              <GuestLandingButton />
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
          <span>No ads · no runtime AI · no rating promises</span>
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
