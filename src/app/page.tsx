import Link from "next/link";
import { redirect } from "next/navigation";

import { auth } from "@/server/auth";
import { prisma } from "@/db/client";
import { buttonVariants } from "@/components/ui/button";
import { GradeMark, ConfidenceBar } from "@/components/evidence";
import { getOnboardingStatus } from "@/server/onboarding";
import { cn } from "@/lib/utils";

// The landing hero is the thesis: this is the honest line. It performs the brand rather
// than describing it — the strongest no-BS statement up top, and a live specimen of the
// grade-and-confidence annotation right beside it so a visitor grasps the one idea at once.

const GRADE_KEY = [
  { glyph: "‼", grade: "A", label: "Strong, replicated" },
  { glyph: "!", grade: "B", label: "Suggestive, limited" },
  { glyph: "?!", grade: "C", label: "Theory / best-guess" },
  { glyph: "??", grade: "D", label: "Myth: avoided" },
] as const;

const GRADE_CLR: Record<string, string> = {
  A: "text-grade-a",
  B: "text-grade-b",
  C: "text-grade-c",
  D: "text-grade-d",
};

export default async function Home() {
  const session = await auth();
  // Signed-in users who haven't finished onboarding go straight to the setup flow.
  if (session?.user) {
    const status = await getOnboardingStatus(prisma, session.user.id);
    if (!status.complete) redirect("/onboarding");
  }
  const primaryHref = session?.user ? "/today" : "/signin";

  return (
    <main className="min-h-screen">
      {/* ── Hero: the dark analysis panel ── */}
      <section className="bg-ink text-paper relative overflow-hidden">
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 opacity-[0.5]"
          style={{
            backgroundImage:
              "linear-gradient(hsl(var(--paper) / 0.05) 1px, transparent 1px), linear-gradient(90deg, hsl(var(--paper) / 0.05) 1px, transparent 1px)",
            backgroundSize: "28px 28px",
          }}
        />
        <div className="relative mx-auto grid max-w-5xl gap-12 px-6 py-20 sm:py-28 lg:grid-cols-[1.1fr_0.9fr] lg:items-center">
          <div className="settle flex flex-col gap-6">
            <p className="text-evergreen-bright font-mono text-[0.72rem] font-medium uppercase tracking-[0.22em]">
              The principal variation · science-based, no-BS chess training
            </p>

            <h1 className="font-serif text-6xl font-semibold leading-none tracking-tight sm:text-7xl">
              Mainline
              <span aria-hidden className="text-evergreen-bright">
                {" "}
                ·!
              </span>
            </h1>

            <p className="font-serif text-2xl leading-snug sm:text-3xl">
              No app can prove it will raise your rating.{" "}
              <span className="text-evergreen-bright italic">
                This one won&apos;t pretend it can.
              </span>
            </p>

            <p className="text-paper/70 max-w-md text-base leading-relaxed">
              A personalized training program built from your real games and
              your real constraints, then adapted as you play. Every
              recommendation shows its reasoning and exactly how strong the
              evidence is.
            </p>

            <div className="mt-2 flex flex-wrap items-center gap-3">
              <Link
                href={primaryHref}
                className={cn(buttonVariants({ size: "lg" }))}
              >
                {session?.user ? "Open today's session →" : "Get started →"}
              </Link>
              <a
                href="#how"
                className="text-paper/70 hover:text-paper font-mono text-sm underline-offset-4 transition-colors hover:underline"
              >
                How the honesty works
              </a>
            </div>
          </div>

          {/* The specimen — a real annotated recommendation, the product in one card. */}
          <div className="settle bg-paper text-ink rounded-lg border border-paper/10 p-5 shadow-sheet [animation-delay:120ms]">
            <p className="eyebrow flex items-center justify-between">
              <span>Specimen · today</span>
              <span className="text-graphite normal-case tracking-normal">
                ~12 min
              </span>
            </p>
            <h2 className="mt-2 font-serif text-2xl font-semibold tracking-tight">
              Tactics: knight forks
            </h2>
            <p className="text-graphite mt-1 font-mono text-xs">
              target ~1450 · 8 puzzles · worked example first
            </p>
            <div className="bg-paper/70 mt-4 rounded-md border border-dashed p-4">
              <p className="eyebrow flex items-center gap-2">
                <span className="text-evergreen not-italic" aria-hidden>
                  ∴
                </span>
                Why this?
              </p>
              <p className="mt-2 font-serif text-[0.95rem] leading-relaxed">
                Your last 20 games leak most rating in the middlegame to missed
                forks. Spaced practice at a stretch level is the highest-yield
                response.
              </p>
              <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2">
                <GradeMark grade="B" tier={1} />
                <ConfidenceBar confidence="medium" />
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── The evaluation key: the one idea, taught ── */}
      <section id="how" className="mx-auto max-w-5xl px-6 py-16 sm:py-20">
        <div className="grid gap-10 lg:grid-cols-[0.8fr_1.2fr] lg:gap-16">
          <div className="flex flex-col gap-4">
            <p className="eyebrow">The evaluation key</p>
            <h2 className="font-serif text-3xl font-semibold leading-tight tracking-tight sm:text-4xl">
              Borrowed from the board: every claim is annotated.
            </h2>
            <p className="text-graphite leading-relaxed">
              Chess players already grade moves: a brilliant move, a blunder.
              Mainline grades its own advice the same way, so you always know
              whether you&apos;re following strong evidence or a best guess. We
              never dress a guess up as a fact.
            </p>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            {GRADE_KEY.map((g) => (
              <div
                key={g.grade}
                className="bg-card eval-gutter rounded-lg border p-5 pl-6 shadow-sheet transition-all duration-150 hover:translate-y-[-1px]"
                data-grade={g.grade}
              >
                <div className="flex items-center gap-3">
                  <span
                    aria-hidden
                    className={cn(
                      "font-mono text-2xl font-bold leading-none select-none",
                      GRADE_CLR[g.grade],
                    )}
                  >
                    {g.glyph}
                  </span>
                  <span className="font-mono text-xs font-semibold uppercase tracking-[0.12em]">
                    Grade {g.grade}
                  </span>
                </div>
                <p className="text-graphite mt-3 font-serif text-sm leading-relaxed">
                  {g.label} evidence. Used to mark{" "}
                  {g.grade === "A"
                    ? "strong, replicated research results (like FSRS spacing formulas)."
                    : g.grade === "B"
                      ? "suggestive studies with limited size or context."
                      : g.grade === "C"
                        ? "logical theories, placeholders, or calibration estimates."
                        : "popular chess improvement myths that the app actively avoids."}
                </p>
              </div>
            ))}
          </div>
        </div>

        <p className="text-graphite mt-12 max-w-2xl border-l-2 border-evergreen/40 pl-4 font-serif text-lg italic leading-relaxed">
          The hardest, most honest fact in chess training: no activity has ever
          been proven to cause a measured rating gain. Mainline helps you train
          smarter on the best available evidence. It never sells you certainty.
        </p>
      </section>

      <footer className="border-t border-line/80">
        <div className="text-graphite mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-4 px-6 py-8 font-mono text-xs">
          <span className="uppercase tracking-[0.2em]">Mainline</span>
          <span>
            Hosts no content · uses no AI · points you to Lichess &amp; the open
            puzzle database.
          </span>
        </div>
      </footer>
    </main>
  );
}
