import Link from "next/link";
import { redirect } from "next/navigation";
import { buttonVariants } from "@/components/ui/button";
import { PendingSubmitButton } from "@/components/pending-submit-button";
import { HomepageBlunderAnalyzer } from "@/components/homepage-blunder-analyzer";
import { LandingTelemetry } from "@/components/landing-telemetry";
import { GuestLandingButton } from "@/components/guest-landing-button";
import { prisma } from "@/db/client";
import { beginSelectedBetaSignIn } from "@/app/signin/actions";
import { cn } from "@/lib/utils";
import { auth } from "@/server/auth";
import { getPostAuthDestination } from "@/server/onboarding";

// The landing page is a copy of the product's own artifact: a session typed as a game
// score, graded like an annotation, measured like an eval bar. No dark hero panel, no
// feature cards, no promises about rating.

const SETUP_STEPS = [
  {
    title: "Set your constraints",
    detail:
      "Minutes per day, which days you actually train, your format, and the books you own.",
  },
  {
    title: "Connect your accounts",
    detail:
      "Link Lichess or Chess.com. Mainline reads your public games, read-only, and never touches your password.",
  },
  {
    title: "Calibrate your tactics",
    detail:
      "Three positions, timed. Enough to place you in a difficulty band without asking you to rate yourself.",
  },
  {
    title: "Read your starting profile",
    detail:
      "Where your games are actually decided, which patterns repeat, and how much of it Mainline has evidence for.",
  },
  {
    title: "Train the session it builds",
    detail:
      "Solve, review, log. Each result moves the next day's plan. Nothing is a fixed curriculum.",
  },
] as const;

const PRINCIPLES = [
  {
    title: "Every recommendation shows its evidence",
    detail:
      "Each block carries a grade, the study it comes from, and a plain answer to why it is in front of you today.",
  },
  {
    title: "No rating promises",
    detail:
      "No study proves that any training method raises rating. Mainline uses the best evidence available and says so.",
  },
  {
    title: "The plan moves when you do",
    detail:
      "New games, failed puzzles, and skipped blocks feed back into the next session the same day.",
  },
  {
    title: "Your games stay yours",
    detail:
      "Read-only connections, no advertising, no third-party trackers. Export or delete everything in Settings.",
  },
  {
    title: "No chatbots deciding your training",
    detail:
      "Deterministic scheduling and Stockfish compiled to WebAssembly, running on your machine.",
  },
  {
    title: "Nothing good behind a paywall",
    detail:
      "Every training feature and every methodology file is free. Patronage pays for hosting, nothing unlocks it.",
  },
] as const;

const GRADES = [
  {
    glyph: "!!",
    grade: "Grade A",
    meaning: "Strong, replicated evidence",
    detail:
      "Spaced retrieval practice and repairing your own blunders. Repeated in chess-specific studies.",
    fill: 100,
    cls: "text-grade-a",
  },
  {
    glyph: "!",
    grade: "Grade B",
    meaning: "Suggestive, thinly replicated",
    detail:
      "Explicit process goals and pre-move checklists. Good general evidence, less of it in chess.",
    fill: 72,
    cls: "text-grade-b",
  },
  {
    glyph: "?!",
    grade: "Grade C",
    meaning: "Theory and best guess",
    detail:
      "Tactical motif taxonomy drills. A plausible mechanism, limited direct measurement.",
    fill: 46,
    cls: "text-grade-c",
  },
  {
    glyph: "??",
    grade: "Grade D",
    meaning: "Popular, unsupported",
    detail:
      "Passive master-game replay. Mainline names these and leaves them out of your plan.",
    fill: 22,
    cls: "text-grade-d",
  },
] as const;

const SAMPLE_BLOCKS = [
  {
    minutes: "12 min",
    title: "Blunder drill from your own games",
    note: "Three positions where you lost the most material last week.",
    glyph: "!!",
    cls: "text-grade-a",
  },
  {
    minutes: "6 min",
    title: "Spaced review: king and pawn endings",
    note: "Queued by the scheduler because you missed two of them.",
    glyph: "!",
    cls: "text-grade-b",
  },
  {
    minutes: "2 min",
    title: "Log one rated game",
    note: "Play it on Lichess. Mainline reads it tomorrow.",
    glyph: "?!",
    cls: "text-grade-c",
  },
] as const;

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
      <header className="bg-paper/90 sticky top-0 z-30 border-b border-rule backdrop-blur-md">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-6 px-4 sm:px-6">
          <Link
            href="/"
            className="rounded-[2px] text-[1.0625rem] font-bold uppercase tracking-[-0.005em] text-ink [font-stretch:118%]"
          >
            Mainline
            <span
              className="font-mono text-[0.8rem] lowercase tracking-normal text-biro"
              aria-hidden
            >
              ·!
            </span>
          </Link>
          <nav
            aria-label="Landing page navigation"
            className="hidden items-center gap-6 text-[0.875rem] text-graphite md:flex"
          >
            <a className="transition-colors hover:text-ink" href="#analyzer">
              Analyze your games
            </a>
            <a className="transition-colors hover:text-ink" href="#grades">
              Evidence grades
            </a>
            <a
              className="transition-colors hover:text-ink"
              href="#how-it-works"
            >
              How setup works
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

      <section className="border-b border-rule">
        <div className="mx-auto grid max-w-6xl gap-y-12 px-4 py-14 sm:px-6 sm:py-20 lg:grid-cols-[1fr_0.92fr] lg:gap-x-16 lg:py-24">
          <div className="settle flex max-w-xl flex-col justify-center">
            <h1 className="display max-w-[13ch] text-[2.9rem] leading-[0.96] sm:text-[4rem] lg:text-[4.4rem]">
              Stop guessing what to train.
            </h1>
            <p className="font-serif mt-6 max-w-[46ch] text-[1.15rem] leading-[1.6] text-graphite">
              Mainline reads your games, finds the mistakes that keep deciding
              them, and builds a short training session for the time you
              actually have. Every block says why it is there and how solid the
              evidence behind it is.
            </p>
            <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:items-center">
              <a
                href="#analyzer"
                className={buttonVariants({
                  size: "lg",
                  className: "justify-center text-center",
                })}
              >
                Analyze my games
              </a>
              <a
                href="#how-it-works"
                className={cn(
                  buttonVariants({ variant: "link", size: "lg" }),
                  "justify-center px-1",
                )}
              >
                See how setup works
              </a>
            </div>
            <p className="mt-6 font-mono text-[0.75rem] text-graphite">
              Open beta. Free, and no sign-in needed to try it below.
            </p>
          </div>

          {/* The product's own artifact, typeset as a session: this is what you get. */}
          <div
            className="settle sheet self-center p-5 [animation-delay:120ms] sm:p-6"
            style={{ animationDelay: "120ms" }}
          >
            <div className="border-b border-rule pb-3">
              <p className="flex flex-wrap items-baseline justify-between gap-x-3 font-mono text-[0.75rem] text-graphite">
                <span>Tuesday, 20 minutes available</span>
                <span className="text-ink">20 min planned</span>
              </p>
              <h2 className="mt-1.5 text-[1.4rem] leading-tight">
                Your session, as Mainline writes it
              </h2>
            </div>

            <div className="flex gap-5">
              <div
                className="session-bar mt-1 w-[9px] shrink-0 self-stretch"
                role="img"
                aria-label="Twelve of twenty minutes trained"
              >
                <span
                  className="bar-fill bar-rise h-[60%]"
                  style={{ height: "60%" }}
                  aria-hidden
                />
              </div>
              <ol className="rule-list min-w-0 flex-1">
                {SAMPLE_BLOCKS.map((block, index) => (
                  <li key={block.title} className="flex gap-3 py-3 first:pt-1">
                    <span className="font-mono pt-px text-[0.8rem] text-graphite">
                      {index + 1}.
                    </span>
                    <div className="min-w-0 flex-1">
                      <h3 className="flex flex-wrap items-baseline gap-2 text-[1rem] leading-snug">
                        <span>{block.title}</span>
                        <span
                          className={cn(
                            "font-mono text-[0.8rem] font-bold leading-none",
                            block.cls,
                          )}
                          aria-hidden
                        >
                          {block.glyph}
                        </span>
                      </h3>
                      <p className="font-serif mt-1 text-[0.88rem] leading-relaxed text-graphite">
                        {block.note}
                      </p>
                    </div>
                    <span className="font-mono shrink-0 pt-px text-[0.72rem] text-graphite">
                      {block.minutes}
                    </span>
                  </li>
                ))}
              </ol>
            </div>

            <p className="mt-3 border-t border-tile/40 pt-3 font-serif text-[0.88rem] leading-relaxed text-graphite">
              <span className="font-mono text-[0.72rem] font-semibold text-tile">
                12 of 20 min done
              </span>{" "}
              The bar beside the list is the only progress meter here. It fills
              with trained minutes, never with streaks.
            </p>
          </div>
        </div>
      </section>

      <section
        id="analyzer"
        className="scroll-mt-20 border-b border-rule bg-sheet/60 py-14 sm:py-20"
      >
        <div className="mx-auto max-w-6xl px-4 sm:px-6">
          <HomepageBlunderAnalyzer />
        </div>
      </section>

      <section
        id="grades"
        className="scroll-mt-20 border-b border-rule py-14 sm:py-20"
      >
        <div className="mx-auto max-w-6xl px-4 sm:px-6">
          <div className="grid gap-8 lg:grid-cols-[0.78fr_1.22fr] lg:gap-16">
            <div>
              <h2 className="text-[2rem] leading-tight sm:text-[2.6rem]">
                Four grades. That is the whole honesty policy.
              </h2>
              <p className="font-serif mt-4 max-w-[44ch] text-[1.05rem] leading-relaxed text-graphite">
                Mainline borrows the annotation marks chess already uses: A
                strong recommendation gets the same grammar as a strong move,
                and a weak one is marked weak rather than left out quietly.
              </p>
            </div>
            <ul className="rule-list">
              {GRADES.map((grade) => (
                <li
                  key={grade.grade}
                  className="grid grid-cols-[2.25rem_1fr] items-baseline gap-x-4 gap-y-1 py-4 sm:grid-cols-[2.25rem_15rem_1fr] sm:gap-x-6"
                >
                  <span
                    className={cn(
                      "font-mono text-[1.05rem] font-bold leading-none",
                      grade.cls,
                    )}
                    aria-hidden
                  >
                    {grade.glyph}
                  </span>
                  <div className="min-w-0">
                    <p className="text-[1rem] font-semibold">
                      {grade.grade}
                      <span className="font-normal text-graphite">
                        {" "}
                        {grade.meaning}
                      </span>
                    </p>
                    <span
                      className="bg-rule relative mt-2 block h-1.5 w-full max-w-[12rem] overflow-hidden rounded-[1px]"
                      aria-hidden
                    >
                      <span
                        className={cn(
                          "absolute inset-y-0 left-0 rounded-[1px]",
                          grade.grade === "Grade A" && "bg-grade-a",
                          grade.grade === "Grade B" && "bg-grade-b",
                          grade.grade === "Grade C" && "bg-grade-c",
                          grade.grade === "Grade D" && "bg-grade-d",
                        )}
                        style={{ width: `${grade.fill}%` }}
                      />
                    </span>
                  </div>
                  <p className="font-serif col-span-2 text-[0.95rem] leading-relaxed text-graphite sm:col-span-1">
                    {grade.detail}
                  </p>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </section>

      <section
        id="how-it-works"
        className="scroll-mt-20 border-b border-rule py-14 sm:py-20"
      >
        <div className="mx-auto max-w-6xl px-4 sm:px-6">
          <div className="grid gap-8 lg:grid-cols-[0.78fr_1.22fr] lg:gap-16">
            <div>
              <h2 className="text-[2rem] leading-tight sm:text-[2.6rem]">
                Setup is five steps, then a loop.
              </h2>
              <p className="font-serif mt-4 max-w-[44ch] text-[1.05rem] leading-relaxed text-graphite">
                Nothing here is a course you have to finish. It takes about four
                minutes, and every value it writes down stays editable in
                Settings.
              </p>
            </div>
            <ol className="rule-list">
              {SETUP_STEPS.map((step, index) => (
                <li
                  key={step.title}
                  className="grid grid-cols-[2.25rem_1fr] gap-x-4 py-4 sm:gap-x-6"
                >
                  <span className="font-mono text-[0.85rem] font-semibold text-graphite">
                    {index + 1}.
                  </span>
                  <div className="min-w-0">
                    <h3 className="text-[1.05rem] leading-snug">
                      {step.title}
                    </h3>
                    <p className="font-serif mt-1 max-w-[54ch] text-[0.95rem] leading-relaxed text-graphite">
                      {step.detail}
                    </p>
                  </div>
                </li>
              ))}
            </ol>
          </div>
          <p className="font-serif mt-10 max-w-[60ch] border-l-[3px] border-biro/45 pl-4 text-[1.05rem] leading-relaxed text-ink">
            After that the loop is short: train the blocks, play your games, and
            let the results change what tomorrow asks for.
          </p>
        </div>
      </section>

      <section
        id="principles"
        className="scroll-mt-20 border-b border-rule py-14 sm:py-20"
      >
        <div className="mx-auto max-w-6xl px-4 sm:px-6">
          <h2 className="max-w-[22ch] text-[2rem] leading-tight sm:text-[2.6rem]">
            What Mainline will not do to you.
          </h2>
          <div className="mt-10 grid gap-x-14 sm:grid-cols-2">
            {PRINCIPLES.map((principle) => (
              <article
                key={principle.title}
                className="border-t border-rule py-5"
              >
                <h3 className="text-[1.1rem] leading-snug">
                  {principle.title}
                </h3>
                <p className="font-serif mt-1.5 max-w-[46ch] text-[0.95rem] leading-relaxed text-graphite">
                  {principle.detail}
                </p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section id="get-started" className="scroll-mt-20 py-14 sm:py-20">
        <div className="mx-auto grid max-w-6xl gap-12 px-4 sm:px-6 lg:grid-cols-[1fr_0.78fr] lg:gap-20">
          <div>
            <h2 className="text-[2.2rem] leading-[1.05] sm:text-[3rem]">
              Write your next session.
            </h2>
            <p className="font-serif mt-5 max-w-[46ch] text-[1.1rem] leading-relaxed text-graphite">
              Sign in with the account your games are already on, or open a
              guest session kept entirely in this browser. Nothing is shared,
              and the guest session can be migrated to an account later.
            </p>
          </div>

          <form
            action={beginSelectedBetaSignIn}
            className="sheet p-5 sm:p-6"
            id="beta-sign-in"
          >
            <h3 className="text-[1.2rem] leading-snug">Get started</h3>
            <p className="font-serif mt-1 text-[0.95rem] leading-relaxed text-graphite">
              Takes about four minutes, including the tactical calibration.
            </p>
            <div className="mt-5 grid gap-3">
              <PendingSubmitButton
                name="provider"
                value="lichess"
                pendingLabel="Opening Lichess…"
                className={buttonVariants({ size: "lg", className: "w-full" })}
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
              <GuestLandingButton />
            </div>
            <p className="font-mono mt-5 border-t border-rule pt-4 text-[0.72rem] leading-relaxed text-graphite">
              Read-only connections. No password is stored. Export or delete
              your account whenever you like.
            </p>
          </form>
        </div>
      </section>

      <footer className="border-t border-rule bg-sheet/70">
        <div className="mx-auto flex max-w-6xl flex-col gap-2 px-4 py-6 text-[0.78rem] text-graphite sm:flex-row sm:items-center sm:justify-between sm:px-6">
          <span className="font-semibold uppercase tracking-[-0.005em] text-ink [font-stretch:112%]">
            Mainline
          </span>
          <span>Science-based chess training. Open source under AGPL-3.0.</span>
        </div>
      </footer>
    </main>
  );
}
