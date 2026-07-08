import { PageShell } from "@/components/app-shell";
import { cn } from "@/lib/utils";

// About — the transparency manifest. Every claim is graded the same way
// recommendations are graded in the product itself.

const GRADE_KEY = [
  {
    glyph: "‼",
    grade: "A",
    label: "Strong, replicated",
    note: "Used for robust, replicated findings, e.g. the retrieval-practice effect or the spacing effect.",
  },
  {
    glyph: "!",
    grade: "B",
    label: "Suggestive, limited",
    note: "Suggestive studies with limited sample size, context, or generalizability.",
  },
  {
    glyph: "?!",
    grade: "C",
    label: "Theory / best-guess",
    note: "Logical inference, placeholder, or calibration estimate. Treated as a starting point, never a proven prescription.",
  },
  {
    glyph: "??",
    grade: "D",
    label: "Myth: avoided",
    note: "Popular chess-improvement advice the app actively avoids because the evidence contradicts it.",
  },
] as const;

const GRADE_CLR: Record<string, string> = {
  A: "text-grade-a",
  B: "text-grade-b",
  C: "text-grade-c",
  D: "text-grade-d",
};

const CONFIDENCE_KEY = [
  {
    level: "Insufficient",
    filled: 0,
    label: "Not enough of your data yet",
    note: "We don't have enough of your games or reviews to make this call. The app says so plainly instead of inventing a verdict.",
  },
  {
    level: "Low",
    filled: 1,
    label: "A band prior, not your own data yet",
    note: "The recommendation rests on what players at your level tend to need, not on what we've seen from you. It will sharpen as your data accrues.",
  },
  {
    level: "Medium",
    filled: 2,
    label: "Some of your own data",
    note: "Partially grounded in your games or reviews. A working hypothesis, still refining.",
  },
  {
    level: "High",
    filled: 4,
    label: "Well-backed by your own data",
    note: "Drawn from enough of your own play to read as yours, not as a population average.",
  },
] as const;

const EXCLUSIONS = [
  {
    what: "No LLM/AI at runtime",
    why: "AI plays chess poorly and invites cost, abuse, and opacity. The app is pure deterministic algorithms. You can verify every decision.",
  },
  {
    what: "No competing game platform",
    why: "Lichess and Chess.com already do that better. The app references external platforms; it doesn't replace them.",
  },
  {
    what: "No hosted copyrighted content",
    why: "Books and courses are recommended and logged, never hosted. The app points you to the right resource; it doesn't steal it.",
  },
  {
    what: "No social or multiplayer",
    why: "No leaderboards, no chat, no shared sessions. Social comparison harms long-term motivation, and the app's goal is personal improvement.",
  },
  {
    what: "No self-report skill diagnosis",
    why: "Dunning-Kruger is real in chess (Grade A/1). The app diagnoses you behaviorally from your games and your puzzle performance, never by asking you to rate yourself.",
  },
  {
    what: "No infinite streaks",
    why: 'Unbreakable streaks are a dark pattern. They create a loss-aversion "quit moment" when the streak breaks. The app caps streaks and forgives missed days.',
  },
  {
    what: "No global leaderboards",
    why: "Downward social comparison (seeing yourself ranked below strangers) harms motivation for the majority of users who are not at the top.",
  },
  {
    what: "No puzzle-volume chasing",
    why: "Correlation between puzzle volume and rating gap is r=−0.02. Grinding puzzles without reflection or spacing doesn't help. The app prioritizes how you practice over how much.",
  },
  {
    what: "No opening memorization for beginners",
    why: "Beginners lose to blunders, not opening theory. Time spent memorizing lines at <1200 is time not spent on tactics and board vision.",
  },
];

export default function AboutPage() {
  return (
    <PageShell
      eyebrow="About Mainline"
      title="The honest line"
      lede={
        "Mainline is a personalized, science-based chess training program that adapts as you play, with every claim graded the same way recommendations are graded in the app."
      }
      width="wide"
    >
      <div className="flex flex-col gap-12">
        {/* ────────────────────────────────────────────────────────────────
            1. The thesis — the central honest claim, stated first
            ──────────────────────────────────────────────────────────── */}
        <section className="settle flex flex-col gap-5">
          <p className="eyebrow">The thesis</p>
          <blockquote className="border-l-2 border-evergreen/50 pl-5 font-serif text-2xl leading-snug sm:text-3xl">
            No training activity has been proven to cause a measured chess
            rating gain.{" "}
            <span className="text-graphite italic">
              Mainline helps you train smarter on the best available evidence.
              It never promises you a rating.
            </span>
          </blockquote>
          <p className="text-graphite max-w-2xl font-serif text-base leading-relaxed">
            Every chess-specific study is observational or correlational: we
            know what strong players do differently, but we cannot prove that
            copying those activities will raise your rating. Mainline is built
            around that fact, not around hiding it.
          </p>
        </section>

        {/* ────────────────────────────────────────────────────────────────
            2. Vision — what Mainline is
            ──────────────────────────────────────────────────────────── */}
        <section className="flex flex-col gap-5">
          <div className="flex flex-col gap-2 border-b border-line/80 pb-3">
            <p className="eyebrow">The vision</p>
            <h2 className="font-serif text-3xl font-semibold leading-tight tracking-tight sm:text-4xl">
              The training-program layer, not another tool.
            </h2>
          </div>
          <p className="text-graphite max-w-2xl font-serif text-base leading-relaxed">
            Mainline is not another puzzle trainer, game analysis tool, or
            spaced-repetition deck. This app sits one layer up: it is the{" "}
            <strong className="text-ink">orchestration layer</strong> that
            decides{" "}
            <em>what you should work on, with which resources, and why</em>,
            then revises that plan continuously as you train and play.
          </p>
        </section>

        {/* ────────────────────────────────────────────────────────────────
            3. Engagement and progress — why the loop exists
            ──────────────────────────────────────────────────────────── */}
        <section className="flex flex-col gap-5">
          <div className="flex flex-col gap-2 border-b border-line/80 pb-3">
            <p className="eyebrow">Engagement and progress</p>
            <h2 className="font-serif text-3xl font-semibold leading-tight tracking-tight sm:text-4xl">
              Built to support consistency, not to extract attention.
            </h2>
          </div>
          <p className="text-graphite max-w-2xl font-serif text-base leading-relaxed">
            Progress in Mainline means training signals: whether you are showing
            up, completing the planned work, keeping reviews healthy, and
            building skill estimates with uncertainty. Rating is noisy, and no
            activity here is treated as proven to cause rating gain.
          </p>
          <p className="text-graphite max-w-2xl font-serif text-base leading-relaxed">
            The engagement layer exists because consistency is part of training.
            It uses forgiving reminders, capped streak cycles, and competence
            feedback to make practice easier to resume. It does not use ads,
            leaderboards, shame, unbreakable streaks, or paywalled training
            quality.
          </p>
        </section>

        {/* ────────────────────────────────────────────────────────────────
            4. What Mainline isn't — the boundaries
            ──────────────────────────────────────────────────────────── */}
        <section className="flex flex-col gap-5">
          <div className="flex flex-col gap-2 border-b border-line/80 pb-3">
            <p className="eyebrow">The boundaries</p>
            <h2 className="font-serif text-3xl font-semibold leading-tight tracking-tight sm:text-4xl">
              What this app deliberately is not.
            </h2>
          </div>
          <p className="text-graphite max-w-2xl font-serif text-base leading-relaxed">
            Every exclusion is a design decision with a reason.
          </p>
          <ul className="flex flex-col gap-4">
            {EXCLUSIONS.map((item) => (
              <li key={item.what} className="flex flex-col gap-1">
                <span className="font-mono text-xs font-semibold uppercase tracking-tight text-ink">
                  {item.what}
                </span>
                <span className="text-graphite font-serif text-sm leading-relaxed">
                  {item.why}
                </span>
              </li>
            ))}
          </ul>
        </section>

        {/* ────────────────────────────────────────────────────────────────
            5. How evidence is graded — the framework
            ──────────────────────────────────────────────────────────── */}
        <section className="flex flex-col gap-5">
          <div className="flex flex-col gap-2 border-b border-line/80 pb-3">
            <p className="eyebrow">The evidence framework</p>
            <h2 className="font-serif text-3xl font-semibold leading-tight tracking-tight sm:text-4xl">
              Borrowed from the board: every claim is annotated.
            </h2>
          </div>
          <p className="text-graphite max-w-2xl font-serif text-base leading-relaxed">
            Every recommendation, methodology value, and claim on this page
            carries a grade: a placeholder can never pose as established fact.
          </p>

          {/* Four grades */}
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {GRADE_KEY.map((g) => (
              <div
                key={g.grade}
                className="bg-card eval-gutter rounded-lg border p-5 pl-6 shadow-sheet"
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
                <p className="text-ink mt-2 font-serif text-sm font-medium">
                  {g.label}
                </p>
                <p className="text-graphite mt-1 font-serif text-sm leading-relaxed">
                  {g.note}
                </p>
              </div>
            ))}
          </div>

          <p className="text-graphite max-w-2xl font-serif text-base leading-relaxed border-l-2 border-evergreen/40 pl-4">
            <strong className="text-ink">Grade</strong> answers{" "}
            <em>how strong the science is</em>. A second axis,{" "}
            <strong className="text-ink">confidence</strong>, answers a
            different question: <em>how much of your own data backs this
            specific call to you.</em> The same Grade-A finding can land with{" "}
            <em>low</em> confidence, as when we know spaced repetition works
            but you&apos;ve only imported three games. Or it can land with{" "}
            <em>high</em> confidence, well-backed by your own play. The
            distinction keeps a band prior from masquerading as a
            personalised verdict.
          </p>

          {/* Four confidence levels */}
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {CONFIDENCE_KEY.map((c) => (
              <div
                key={c.level}
                className="bg-card rounded-lg border p-5 shadow-sheet"
              >
                <div className="flex items-center gap-3">
                  <span
                    aria-hidden
                    className="flex items-center gap-[3px]"
                  >
                    {[0, 1, 2, 3].map((i) => (
                      <span
                        key={i}
                        className={cn(
                          "h-3 w-[6px] rounded-[1px]",
                          i < c.filled
                            ? "bg-evergreen"
                            : "bg-ink/15",
                        )}
                      />
                    ))}
                  </span>
                  <span className="font-mono text-xs font-semibold uppercase tracking-[0.12em]">
                    {c.level}
                  </span>
                </div>
                <p className="text-ink mt-2 font-serif text-sm font-medium">
                  {c.label}
                </p>
                <p className="text-graphite mt-1 font-serif text-sm leading-relaxed">
                  {c.note}
                </p>
              </div>
            ))}
          </div>
        </section>

        {/* ────────────────────────────────────────────────────────────────
            6. Current state — honest about where the science is
            ──────────────────────────────────────────────────────────── */}
        <section className="flex flex-col gap-5">
          <div className="flex flex-col gap-2 border-b border-line/80 pb-3">
            <p className="eyebrow">Where the science is now</p>
            <h2 className="font-serif text-3xl font-semibold leading-tight tracking-tight sm:text-4xl">
              Honest about the current state.
            </h2>
          </div>
          <div className="bg-paper/60 rounded-md border border-dashed border-amber/50 p-5">
            <p className="text-ink font-serif text-base leading-relaxed">
              The methodology configuration currently shipping is a{" "}
              <span className="font-mono text-sm font-semibold">stub</span>{" "}
              with safe placeholder values that make the whole loop run end-to-end.
              The real research will replace the stub without re-architecting
              anything. That is the point of the separation.
            </p>
          </div>
        </section>
      </div>
    </PageShell>
  );
}
