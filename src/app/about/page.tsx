import { PageShell } from "@/components/app-shell";
import { cn } from "@/lib/utils";
import {
  ACTIVE_METHODOLOGY_VERSION,
  METHODOLOGY_RELEASES,
  methodologyReleaseFor,
} from "@/methodology";

// About : the transparency manifest. Every claim is graded the same way
// recommendations are graded in the product itself.

const GRADE_KEY = [
  {
    glyph: "!!",
    grade: "A",
    label: "Strong, replicated",
    note: "Used for robust, replicated findings such as retrieval-practice and spacing effects.",
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
    label: "Contradicted myth",
    note: "Popular chess advice that Mainline avoids because evidence contradicts it.",
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
    label: "Not enough data yet",
    note: "We do not have enough of your games or reviews to make this call. Mainline displays uncertainty plainly instead of guessing.",
  },
  {
    level: "Low",
    filled: 1,
    label: "Population baseline",
    note: "The recommendation rests on what players at your level tend to need, not on your personal data yet. It sharpens as you train.",
  },
  {
    level: "Medium",
    filled: 2,
    label: "Partial data",
    note: "Partially grounded in your games or reviews. A working hypothesis under active refinement.",
  },
  {
    level: "High",
    filled: 4,
    label: "Strong personal data",
    note: "Drawn from enough of your own play to represent your specific strengths and leaks.",
  },
] as const;

const EXCLUSIONS = [
  {
    what: "No LLM/AI at runtime",
    why: "Generative AI plays chess poorly and introduces opacity. Mainline uses deterministic algorithms and local Stockfish. You can verify every decision.",
  },
  {
    what: "No competing game platform",
    why: "Lichess and Chess.com provide great play servers. Mainline connects to external platforms rather than replacing them.",
  },
  {
    what: "No hosted copyrighted content",
    why: "Books and courses are recommended and logged, never hosted. Mainline points you to resources you own.",
  },
  {
    what: "No social or multiplayer",
    why: "No leaderboards, chat, or comparative rankings. Social comparison harms long-term practice habits.",
  },
  {
    what: "No self-reported skill diagnosis",
    why: "Self-assessment in chess is prone to error. Mainline measures play behaviorally from your games and calibration puzzles.",
  },
  {
    what: "No infinite streaks",
    why: "Unbreakable streaks create loss aversion and burnout. Mainline caps streak cycles and forgives missed days.",
  },
  {
    what: "No global leaderboards",
    why: "Comparative leaderboards harm motivation for most learners. Mainline focuses strictly on personal training consistency.",
  },
  {
    what: "No puzzle volume chasing",
    why: "Correlation between raw puzzle volume and rating is near zero. Spaced repetition and deliberate calculation matter more than quantity.",
  },
  {
    what: "No opening memorization for beginners",
    why: "Beginner and intermediate games are decided by tactical blunders. Time is better spent on pattern recognition and calculation.",
  },
];

export default function AboutPage() {
  const release = methodologyReleaseFor(ACTIVE_METHODOLOGY_VERSION);
  const isResearchRelease = release.channel === "research";

  return (
    <PageShell
      eyebrow="About Mainline"
      title="Product transparency"
      lede="Mainline is a personalized chess training program that adapts as you play. Every recommendation carries an explicit evidence grade."
      width="wide"
    >
      <div className="flex flex-col gap-12">
        {/* ────────────────────────────────────────────────────────────────
            1. The thesis : the central honest claim, stated first
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
            2. Vision : what Mainline is
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
            3. Engagement and progress : why the loop exists
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
            4. What Mainline isn't : the boundaries
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
            5. How evidence is graded : the framework
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
            different question:{" "}
            <em>how much of your own data backs this specific call to you.</em>{" "}
            The same Grade-A finding can land with <em>low</em> confidence, as
            when we know spaced repetition works but you&apos;ve only imported
            three games. Or it can land with <em>high</em> confidence,
            well-backed by your own play. The distinction keeps a band prior
            from masquerading as a personalised verdict.
          </p>

          {/* Four confidence levels */}
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {CONFIDENCE_KEY.map((c) => (
              <div
                key={c.level}
                className="bg-card rounded-lg border p-5 shadow-sheet"
              >
                <div className="flex items-center gap-3">
                  <span aria-hidden className="flex items-center gap-[3px]">
                    {[0, 1, 2, 3].map((i) => (
                      <span
                        key={i}
                        className={cn(
                          "h-3 w-[6px] rounded-[1px]",
                          i < c.filled ? "bg-evergreen" : "bg-ink/15",
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
            6. Current state : honest about where the science is
            ──────────────────────────────────────────────────────────── */}
        <section className="flex flex-col gap-5">
          <div className="flex flex-col gap-2 border-b border-line/80 pb-3">
            <p className="eyebrow">Where the science is now</p>
            <h2 className="font-serif text-3xl font-semibold leading-tight tracking-tight sm:text-4xl">
              Honest about the current state.
            </h2>
          </div>
          <div
            className={cn(
              "rounded-md border p-5",
              isResearchRelease
                ? "border-evergreen/40 bg-evergreen/5"
                : "border-dashed border-amber/50 bg-paper/60",
            )}
            data-methodology-channel={release.channel}
            data-methodology-version={release.version}
          >
            <p className="eyebrow">Active methodology · {release.version}</p>
            <p className="text-ink mt-3 font-serif text-base leading-relaxed">
              {isResearchRelease
                ? "This active research release encodes the approved methodology values and copy, while retaining every documented best guess and deliberate stub as evidence-labeled data."
                : "The active methodology is still the pre-release placeholder configuration. It keeps the full loop runnable while research release work is pending."}
            </p>
            <p className="text-graphite mt-3 font-serif text-sm leading-relaxed">
              The release is reproducible: historic programs keep the version
              and rationale snapshot they were generated with. The central
              caveat remains unchanged: no training activity has been proven to
              cause a measured rating gain.
            </p>
            {isResearchRelease && release.deliberateStubs.length > 0 && (
              <div className="mt-4 border-t border-line/80 pt-4">
                <p className="eyebrow">Still deliberately unresolved</p>
                <ul className="text-graphite mt-2 flex flex-col gap-1 font-mono text-xs leading-relaxed">
                  {release.deliberateStubs.slice(0, 3).map((stub) => (
                    <li key={stub}>· {stub}</li>
                  ))}
                </ul>
              </div>
            )}
            <div className="mt-4 border-t border-line/80 pt-4">
              <p className="eyebrow">Aggregate basis</p>
              <p className="text-graphite mt-2 font-serif text-sm leading-relaxed">
                {release.aggregateBasis}
              </p>
            </div>
          </div>
        </section>

        <section className="flex flex-col gap-5">
          <div className="flex flex-col gap-2 border-b border-line/80 pb-3">
            <p className="eyebrow">Methodology release history</p>
            <h2 className="font-serif text-3xl font-semibold leading-tight tracking-tight sm:text-4xl">
              Every change keeps its limits and rollback path.
            </h2>
          </div>
          <div className="grid gap-3">
            {Object.values(METHODOLOGY_RELEASES)
              .slice()
              .reverse()
              .map((entry) => (
                <article
                  className="bg-card rounded-md border p-4"
                  key={entry.version}
                >
                  <p className="eyebrow">
                    {entry.version} · {entry.releasedOn}
                  </p>
                  <p className="text-ink mt-2 font-serif text-sm">
                    {entry.summary}
                  </p>
                  <p className="text-graphite mt-2 font-mono text-xs leading-relaxed">
                    Aggregate basis: {entry.aggregateBasis}
                  </p>
                  <div className="text-graphite mt-2 font-mono text-xs leading-relaxed">
                    <p>Evidence changes:</p>
                    <ul className="mt-1 flex flex-col gap-1">
                      {entry.evidenceChanges.map((change) => (
                        <li key={change}>· {change}</li>
                      ))}
                    </ul>
                  </div>
                  <div className="text-graphite mt-2 font-mono text-xs leading-relaxed">
                    <p>Limitations:</p>
                    <ul className="mt-1 flex flex-col gap-1">
                      {entry.limitations.map((limitation) => (
                        <li key={limitation}>· {limitation}</li>
                      ))}
                    </ul>
                  </div>
                  <p className="text-graphite mt-1 font-mono text-xs leading-relaxed">
                    Rollback: {entry.rollbackNotes}
                  </p>
                </article>
              ))}
          </div>
        </section>
      </div>
    </PageShell>
  );
}
