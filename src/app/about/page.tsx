import { PageShell } from "@/components/app-shell";
import { GradeMark } from "@/components/evidence";
import { cn } from "@/lib/utils";

// About — the transparency manifest. This page is public (no auth gate) because
// honesty that's hidden behind a login isn't honesty. It explains the vision, the
// science, the architecture, and the algorithm — with every claim graded the same
// way recommendations are graded in the product itself. No claim is dressed up
// as stronger than the evidence supports. The central caveat is stated first and
// never retracted: no training activity has been proven to cause a rating gain.

const GRADE_KEY = [
  { glyph: "‼", grade: "A", label: "Strong, replicated", note: "Used for robust, replicated findings — e.g. the retrieval-practice effect or the spacing effect." },
  { glyph: "!", grade: "B", label: "Suggestive, limited", note: "Suggestive studies with limited sample size, context, or generalizability." },
  { glyph: "?!", grade: "C", label: "Theory / best-guess", note: "Logical inference, placeholder, or calibration estimate. Treated as a starting point, never a proven prescription." },
  { glyph: "??", grade: "D", label: "Myth — avoided", note: "Popular chess-improvement advice the app actively avoids because the evidence contradicts it." },
] as const;

const GRADE_CLR: Record<string, string> = {
  A: "text-grade-a",
  B: "text-grade-b",
  C: "text-grade-c",
  D: "text-grade-d",
};

const FINDINGS = [
  { grade: "A", tier: 1, title: "Deliberate practice explains ~26–34% of skill variance", note: "Necessary but not sufficient. The rest is genetics, starting age, and unknown factors." },
  { grade: "A", tier: 1, title: "Chess skill is pattern/chunk recognition", note: "Experts hold 50,000–100,000 position chunks. This is the theoretical basis for all pattern drilling." },
  { grade: "A", tier: 1, title: "Below ~2000, games are decided by blunders/tactics", note: "72–85% of games at this level turn on a tactical oversight, not positional nuance." },
  { grade: "A", tier: 2, title: "Retrieval practice is a strong learning mechanism", note: "Effect size g≈0.51 — one of the largest in learning science. Proven on flashcards and perceptual learning, not yet chess-validated." },
  { grade: "A", tier: 1, title: "Self-reported skill diagnosis is invalid", note: "Dunning-Kruger is real in chess. The app assesses you behaviorally, never by questionnaire." },
  { grade: "A", tier: 2, title: "Process goals beat outcome goals", note: "From sport psychology. \"Solve 20 puzzles at 85%\" outperforms \"gain 100 points\" as a target." },
  { grade: "A", tier: 1, title: "Improvement is the exception, not the norm", note: "96% of active Lichess players showed no substantial lasting gain over 7 years (Blanch 2023, N=72,022)." },
  { grade: "A", tier: 1, title: "Diminishing returns are steep", note: "+100 points ≈ 1–2 months at 800–1000, but ≈ 3–4 years at 1600–2000. Your trajectory is personal." },
] as const;

const LIMITATIONS = [
  "No activity is proven to cause rating gain. Every chess-specific study is observational or correlational. We can say what strong players do differently — we cannot prove that copying those activities will raise your rating.",
  "Spacing and retrieval practice are proven on flashcards and perceptual learning tasks, not on chess. The mechanism is robust enough to extrapolate, but the extrapolation is a best guess (Grade A/2, not A/1).",
  "FSRS is the best-supported spaced repetition scheduler available, with 20–30% fewer reviews than SM-2 for the same retention. But it has not been validated specifically on chess puzzles.",
  "The 85% success-rate target is derived from machine-learning optimization on general learning data, not from chess-specific research.",
  "Blunder reduction is descriptively robust — better players blunder less. But the causal link (doing blunder drills causes you to blunder less in games) is Grade C, not proven.",
  "Athletic periodisation (macro/meso/micro cycles) has no cognitive or chess-specific evidence. The app does not pretend it does.",
];

const EXCLUSIONS = [
  { what: "No LLM/AI at runtime", why: "AI plays chess poorly and invites cost, abuse, and opacity. The app is pure deterministic algorithms. You can verify every decision." },
  { what: "No competing game platform", why: "Lichess and Chess.com already do that better. The app references external platforms; it doesn't replace them." },
  { what: "No hosted copyrighted content", why: "Books and courses are recommended and logged, never hosted. The app points you to the right resource; it doesn't steal it." },
  { what: "No social or multiplayer", why: "No leaderboards, no chat, no shared sessions. Social comparison harms long-term motivation, and the app's goal is personal improvement." },
  { what: "No self-report skill diagnosis", why: "Dunning-Kruger is real in chess (Grade A/1). The app diagnoses you behaviorally — from your games and your puzzle performance — never by asking you to rate yourself." },
  { what: "No infinite streaks", why: "Unbreakable streaks are a dark pattern. They create a loss-aversion \"quit moment\" when the streak breaks. The app caps streaks and forgives missed days." },
  { what: "No global leaderboards", why: "Downward social comparison (seeing yourself ranked below strangers) harms motivation for the majority of users who are not at the top." },
  { what: "No puzzle-volume chasing", why: "Correlation between puzzle volume and rating gap is r=−0.02. Grinding puzzles without reflection or spacing doesn't help. The app prioritizes how you practice over how much." },
  { what: "No opening memorization for beginners", why: "Beginners lose to blunders, not opening theory. Time spent memorizing lines at <1200 is time not spent on tactics and board vision." },
];

const LAWS = [
  { id: "L1", rule: "No chess or learning constants outside the methodology config", enforcement: "Architecture guard test in CI. A hardcoded number in the engine fails the build." },
  { id: "L2", rule: "Decisions are pure and deterministic — same inputs always produce the same output", enforcement: "No Date.now() or Math.random() in engine or methodology. Time is injected via a Clock interface. Eslint rule + guard test." },
  { id: "L3", rule: "Every methodology leaf value is a GradedValue with a grade, tier, and citation", enforcement: "Zod schema validation. A bare number without a grade is rejected at load time. The app will not boot with an invalid config." },
];

const ALGORITHM_SECTIONS = [
  {
    name: "FSRS v6 — Spaced Repetition",
    description: "The scheduler that decides when to show you a puzzle again. It models your memory with three variables:",
    items: [
      { label: "Retrievability (R)", value: "The probability you can recall the solution today." },
      { label: "Stability (S)", value: "How many days until your recall drops to 90%." },
      { label: "Difficulty (D)", value: "How inherently hard this position is for you (1–10 scale)." },
    ],
    extra: "Desired retention is set to 0.90 (Grade A/2). The scheduler uses FSRS-v6 default weights until you have 1000+ personalizing reviews, then adapts to your individual memory curve. When you fail a puzzle, the app doesn't just reschedule it — it runs a 3-phase redo flow: hide the solution, give a scaffolded hint, re-present at session end (min 10–15 min delay, no hints), and only then hand it to FSRS as a lapse.",
  },
  {
    name: "Glicko-2 — Progress Measurement",
    description: "Your rating is a distribution, not a number. The app tracks the confidence interval (95% CI = R ± 1.96·RD) and only declares significant progress when the new CI's lower bound exceeds the old CI's upper bound.",
    items: [],
    extra: "A 40–100 point swing with overlapping confidence intervals is statistically no change. The app won't celebrate noise. Plateau detection: if your CI upper bound hasn't exceeded its historical max over ~90 active days, you're plateaued — and the app tells you plainly.",
  },
  {
    name: "Servo-Controlled Difficulty",
    description: "The app doesn't guess your puzzle difficulty — it measures it and adjusts. Two tracks run simultaneously:",
    items: [
      { label: "Pattern track", value: "~85% success target. You should mostly succeed — this builds pattern recognition." },
      { label: "Calculation track", value: "~55% success target. You should struggle — this builds calculation depth." },
    ],
    extra: "Your rolling success rate is the control variable; the puzzle Elo offset is the actuator. A servo controller adjusts the offset to hit the target. Beginners (<800) get a raised target (~90%) for competence and motivation. The system converges — it doesn't require you to know your level.",
  },
  {
    name: "Weakness Detection",
    description: "The app reads your games through Stockfish and extracts raw features, then the methodology interprets them into graded weakness signals.",
    items: [
      { label: "Primary signal", value: "Blunder rate — severe evaluation drops (≥150–300 cp) in undecided positions. If your rate exceeds 1.2× the band baseline over ≥20 games, a weakness is flagged." },
      { label: "Secondary signal", value: "ACPL by game phase. ACPL alone is weak (5–7% of variance) — it supports the blunder signal, never replaces it." },
      { label: "Suppressed", value: "Opening diagnosis requires ≥194 games per ECO code. Below that, the sample is noise. The app says \"insufficient data,\" never fabricates a diagnosis." },
    ],
    extra: "",
  },
  {
    name: "Program Generation",
    description: "Every day, the app assembles your training session through a deterministic pipeline:",
    items: [
      { label: "1", value: "Weakness signals + your rating band → candidate activities." },
      { label: "2", value: "Prioritize: weakness severity × dimension salience, activity ROI (per-band), due reviews, variety/recency, constraint fit (time budget, owned resources)." },
      { label: "3", value: "Set difficulty per item via the servo controller." },
      { label: "4", value: "Pack to your minute budget." },
      { label: "5", value: "Attach a graded \"why this / why now\" rationale + a snapshot of the inputs to every item." },
    ],
    extra: "The snapshot means any past decision can be re-derived. If you ask \"why did the app suggest this three months ago?\", the answer is in the data — not a black box.",
  },
];

export default function AboutPage() {
  return (
    <PageShell
      eyebrow="About Mainline"
      title="The honest line"
      lede={
        <>
          Mainline is a personalized, science-based chess training program that
          adapts as you play. This page explains the vision, the science, the
          architecture, and the algorithm — with every claim graded the same way
          recommendations are graded in the app. No claim is dressed up as
          stronger than the evidence supports.
        </>
      }
      width="wide"
    >
      <div className="flex flex-col gap-16">
        {/* ────────────────────────────────────────────────────────────────
            1. The thesis — the central honest claim, stated first
            ──────────────────────────────────────────────────────────── */}
        <section className="settle flex flex-col gap-5">
          <p className="eyebrow">The thesis</p>
          <blockquote className="border-l-2 border-evergreen/50 pl-5 font-serif text-2xl leading-snug sm:text-3xl">
            No training activity has been proven to cause a measured chess
            rating gain.{" "}
            <span className="text-graphite italic">
              Mainline helps you train smarter on the best available evidence —
              it never promises you a rating.
            </span>
          </blockquote>
          <p className="text-graphite max-w-2xl font-serif text-base leading-relaxed">
            Every chess-specific study ever conducted is observational or
            correlational. We know what strong players do differently — they
            play more rated games, they analyze their games, they solve
            tactical puzzles. We can measure that deliberate practice explains
            roughly a quarter to a third of skill variance. But we cannot prove
            that any specific training activity will cause your rating to go
            up. This is not a limitation of this app — it is a limitation of the
            evidence. Mainline is built around that fact, not around hiding it.
          </p>
        </section>

        {/* ────────────────────────────────────────────────────────────────
            2. What Mainline is — the vision
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
            spaced-repetition deck. Those exist and many are good. This app sits
            one layer up: it is the <strong className="text-ink">orchestration
            layer</strong> that decides <em>what you should work on, with which
            resources, and why</em> — and revises that plan continuously as you
            train and play.
          </p>
          <div className="grid gap-4 sm:grid-cols-3">
            {[
              {
                n: "1",
                title: "Personalization through constraints",
                body: "Your time per day, your days per week, your goals, the resources you already own. The program is built around your reality, not a generic curriculum.",
              },
              {
                n: "2",
                title: "It's alive",
                body: "After generation, the program is dynamic. A tracker records every outcome, and the program re-prioritizes itself. There is no fixed syllabus.",
              },
              {
                n: "3",
                title: "Internal-first, external where it must be",
                body: "What can be done well in-app from open data and a client-side engine — puzzles, blunder drills, game review, endgames — is done in-app with precise tracking. What can't — playing real games, reading books — stays a reference to an external resource.",
              },
            ].map((item) => (
              <div
                key={item.n}
                className="bg-card eval-gutter rounded-lg border p-5 pl-6 shadow-sheet"
                data-grade="A"
              >
                <span
                  aria-hidden
                  className="text-evergreen font-mono text-sm font-bold"
                >
                  {item.n}
                </span>
                <h3 className="mt-2 font-serif text-lg font-semibold leading-tight">
                  {item.title}
                </h3>
                <p className="text-graphite mt-2 font-serif text-sm leading-relaxed">
                  {item.body}
                </p>
              </div>
            ))}
          </div>
        </section>

        {/* ────────────────────────────────────────────────────────────────
            3. What Mainline isn't — the boundaries
            ──────────────────────────────────────────────────────────── */}
        <section className="flex flex-col gap-5">
          <div className="flex flex-col gap-2 border-b border-line/80 pb-3">
            <p className="eyebrow">The boundaries</p>
            <h2 className="font-serif text-3xl font-semibold leading-tight tracking-tight sm:text-4xl">
              What this app deliberately is not.
            </h2>
          </div>
          <p className="text-graphite max-w-2xl font-serif text-base leading-relaxed">
            Every exclusion is a design decision with a reason. The app is a
            reaction against the hype, manipulation, and opacity that dominate
            chess improvement products. Here is what it refuses to do — and why.
          </p>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {EXCLUSIONS.map((item) => (
              <div
                key={item.what}
                className="bg-card rounded-lg border border-line/80 p-4 shadow-sheet"
              >
                <p className="font-mono text-xs font-semibold uppercase tracking-tight text-ink">
                  {item.what}
                </p>
                <p className="text-graphite mt-2 font-serif text-sm leading-relaxed">
                  {item.why}
                </p>
              </div>
            ))}
          </div>
        </section>

        {/* ────────────────────────────────────────────────────────────────
            4. How evidence is graded — the framework
            ──────────────────────────────────────────────────────────── */}
        <section className="flex flex-col gap-5">
          <div className="flex flex-col gap-2 border-b border-line/80 pb-3">
            <p className="eyebrow">The evidence framework</p>
            <h2 className="font-serif text-3xl font-semibold leading-tight tracking-tight sm:text-4xl">
              Borrowed from the board: every claim is annotated.
            </h2>
          </div>
          <p className="text-graphite max-w-2xl font-serif text-base leading-relaxed">
            Chess players already grade moves — a brilliant move (‼), a
            blunder (??). Mainline grades its own advice the same way. Every
            recommendation, every methodology value, and every claim on this
            page carries a grade and a tier. A placeholder can never pose as
            established fact.
          </p>

          {/* Two tiers */}
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="bg-card rounded-lg border border-line/80 p-5 shadow-sheet">
              <p className="font-mono text-xs font-semibold uppercase tracking-[0.12em] text-ink">
                Tier 1 · Chess-specific
              </p>
              <p className="text-graphite mt-2 font-serif text-sm leading-relaxed">
                Studies about chess players — often observational, sometimes
                with small samples. The evidence is directly about chess, but
                its strength varies. A Tier 1 finding can be Grade A (replicated
                across large samples) or Grade C (a single suggestive study).
              </p>
            </div>
            <div className="bg-card rounded-lg border border-line/80 p-5 shadow-sheet">
              <p className="font-mono text-xs font-semibold uppercase tracking-[0.12em] text-ink">
                Tier 2 · General learning science
              </p>
              <p className="text-graphite mt-2 font-serif text-sm leading-relaxed">
                Robust cognitive psychology — retrieval practice, spacing,
                desirable difficulty — extrapolated to chess by analogy. The
                underlying evidence is often stronger than Tier 1, but the
                chess application is an inference, not a measurement.
              </p>
            </div>
          </div>

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

          <p className="text-graphite max-w-2xl border-l-2 border-evergreen/40 pl-4 font-serif text-base italic leading-relaxed">
            This is not just a display convention. Every value in the
            methodology configuration carries a grade, a tier, and a citation
            key. A Zod schema rejects bare numbers at load time — the app will
            not boot with an ungraded value. Honesty is structural, not a
            promise.
          </p>
        </section>

        {/* ────────────────────────────────────────────────────────────────
            5. What the science says — key findings
            ──────────────────────────────────────────────────────────── */}
        <section className="flex flex-col gap-5">
          <div className="flex flex-col gap-2 border-b border-line/80 pb-3">
            <p className="eyebrow">What the science says</p>
            <h2 className="font-serif text-3xl font-semibold leading-tight tracking-tight sm:text-4xl">
              The findings that shape the program.
            </h2>
          </div>
          <p className="text-graphite max-w-2xl font-serif text-base leading-relaxed">
            These are the highest-grade findings in the research base. Each one
            directly influences how the app builds your program. None of them
            are causal proof — they are the strongest available evidence, graded
            honestly.
          </p>
          <div className="grid gap-4 sm:grid-cols-2">
            {FINDINGS.map((f) => (
              <div
                key={f.title}
                className="bg-card eval-gutter rounded-lg border p-5 pl-6 shadow-sheet"
                data-grade={f.grade}
              >
                <div className="flex items-start justify-between gap-3">
                  <h3 className="font-serif text-base font-semibold leading-tight">
                    {f.title}
                  </h3>
                  <GradeMark grade={f.grade} tier={f.tier} className="shrink-0" />
                </div>
                <p className="text-graphite mt-2 font-serif text-sm leading-relaxed">
                  {f.note}
                </p>
              </div>
            ))}
          </div>
        </section>

        {/* ────────────────────────────────────────────────────────────────
            6. What the science doesn't say — honest limitations
            ──────────────────────────────────────────────────────────── */}
        <section className="flex flex-col gap-5">
          <div className="flex flex-col gap-2 border-b border-line/80 pb-3">
            <p className="eyebrow">What the science doesn&apos;t say</p>
            <h2 className="font-serif text-3xl font-semibold leading-tight tracking-tight sm:text-4xl">
              The honest caveats.
            </h2>
          </div>
          <p className="text-graphite max-w-2xl font-serif text-base leading-relaxed">
            Transparency means naming what you don&apos;t know. These are the gaps in
            the evidence base — the places where the app makes its best guess
            and tells you it&apos;s guessing.
          </p>
          <div className="flex flex-col gap-3">
            {LIMITATIONS.map((limitation, i) => (
              <div
                key={i}
                className="flex items-start gap-3 border-l-2 border-amber/40 pl-4"
              >
                <span
                  aria-hidden
                  className="text-grade-c mt-0.5 font-mono text-sm font-bold select-none"
                >
                  ?!
                </span>
                <p className="text-graphite font-serif text-sm leading-relaxed">
                  {limitation}
                </p>
              </div>
            ))}
          </div>
        </section>

        {/* ────────────────────────────────────────────────────────────────
            7. How it's built — the architecture
            ──────────────────────────────────────────────────────────── */}
        <section className="flex flex-col gap-5">
          <div className="flex flex-col gap-2 border-b border-line/80 pb-3">
            <p className="eyebrow">The architecture</p>
            <h2 className="font-serif text-3xl font-semibold leading-tight tracking-tight sm:text-4xl">
              The engine and the methodology are separate.
            </h2>
          </div>
          <p className="text-graphite max-w-2xl font-serif text-base leading-relaxed">
            The single most important design decision in Mainline: the generic
            machinery (the engine) and the actual science (the methodology) are
            strictly separated. The engine contains no chess or learning
            knowledge. The methodology contains nothing but. They communicate
            through a typed boundary of about eighteen pure functions.
          </p>

          {/* Engine vs Methodology */}
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="bg-card rounded-lg border border-line/80 p-5 shadow-sheet">
              <p className="font-mono text-xs font-semibold uppercase tracking-[0.12em] text-ink">
                The Engine
              </p>
              <p className="text-graphite mt-2 font-serif text-sm leading-relaxed">
                Generic, deterministic machinery: accounts and imports, the user
                profile, raw game analysis via Stockfish, the program generator,
                the tracker, the adaptation loop, the transparency UI. It
                contains <strong className="text-ink">no chess or learning
                knowledge of its own</strong>. Every graded decision is
                delegated to the methodology.
              </p>
            </div>
            <div className="bg-card rounded-lg border border-line/80 p-5 shadow-sheet">
              <p className="font-mono text-xs font-semibold uppercase tracking-[0.12em] text-ink">
                The Methodology
              </p>
              <p className="text-graphite mt-2 font-serif text-sm leading-relaxed">
                The actual science: what skills to measure, how to read a
                player&apos;s games, which resource fits which weakness at which
                level, how hard tasks should be, how to space and prioritize,
                and the &quot;why&quot; copy shown to the user. This is a{" "}
                <strong className="text-ink">versioned configuration</strong> —
                a JSON file with graded values.
              </p>
            </div>
          </div>

          {/* Three laws */}
          <div className="flex flex-col gap-3">
            <p className="eyebrow">The three laws — enforced in CI</p>
            {LAWS.map((law) => (
              <div
                key={law.id}
                className="bg-card eval-gutter rounded-lg border p-4 pl-6 shadow-sheet"
                data-grade="A"
              >
                <div className="flex items-baseline gap-3">
                  <span className="font-mono text-sm font-bold text-evergreen">
                    {law.id}
                  </span>
                  <p className="font-serif text-base font-medium leading-tight">
                    {law.rule}
                  </p>
                </div>
                <p className="text-graphite mt-2 pl-8 font-mono text-xs leading-relaxed">
                  {law.enforcement}
                </p>
              </div>
            ))}
          </div>

          <p className="text-graphite max-w-2xl font-serif text-base leading-relaxed">
            Why this matters: science enters the system in exactly one place.
            When the research improves, you swap one config file and bump the
            version — no re-architecting. When the app makes a decision, it
            persists the methodology version and the input snapshot, so any past
            decision can be re-derived and audited. And a bare number in the
            engine — a hardcoded &quot;85% success rate&quot; or &quot;puzzle rating offset&quot; —
            would fail the architecture guard test in CI. Honesty is not a
            policy; it is a build error if violated.
          </p>
        </section>

        {/* ────────────────────────────────────────────────────────────────
            8. How it works — the algorithm
            ──────────────────────────────────────────────────────────── */}
        <section className="flex flex-col gap-5">
          <div className="flex flex-col gap-2 border-b border-line/80 pb-3">
            <p className="eyebrow">The algorithm</p>
            <h2 className="font-serif text-3xl font-semibold leading-tight tracking-tight sm:text-4xl">
              The machinery, explained.
            </h2>
          </div>
          <p className="text-graphite max-w-2xl font-serif text-base leading-relaxed">
            No black boxes. Every algorithm the app uses is a known, published
            method. Here is what each one does, what parameters it uses, and
            where the evidence for those parameters comes from.
          </p>

          <div className="flex flex-col gap-6">
            {ALGORITHM_SECTIONS.map((algo) => (
              <div
                key={algo.name}
                className="bg-card rounded-lg border border-line/80 p-5 shadow-sheet"
              >
                <h3 className="font-mono text-sm font-semibold uppercase tracking-[0.1em] text-ink">
                  {algo.name}
                </h3>
                <p className="text-graphite mt-2 font-serif text-sm leading-relaxed">
                  {algo.description}
                </p>
                {algo.items.length > 0 && (
                  <dl className="mt-4 flex flex-col gap-2.5">
                    {algo.items.map((item) => (
                      <div key={item.label} className="flex items-start gap-3">
                        <dt className="font-mono text-xs font-semibold text-evergreen shrink-0 pt-0.5 min-w-[7rem]">
                          {item.label}
                        </dt>
                        <dd className="text-graphite font-serif text-sm leading-relaxed">
                          {item.value}
                        </dd>
                      </div>
                    ))}
                  </dl>
                )}
                {algo.extra && (
                  <p className="text-graphite mt-3 border-t border-line/60 pt-3 font-serif text-sm leading-relaxed">
                    {algo.extra}
                  </p>
                )}
              </div>
            ))}
          </div>
        </section>

        {/* ────────────────────────────────────────────────────────────────
            9. Where the science is now — honest about the current state
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
              The app is in active development. The methodology configuration
              currently shipping is a{" "}
              <span className="font-mono text-sm font-semibold">stub</span> —
              safe placeholder values that make the whole loop run end-to-end.
              The real research is being mapped into graded config values and
              will replace the stub without re-architecting anything. That is
              the point of the separation: the engine works now, and the science
              lands when it&apos;s ready.
            </p>
            <p className="text-graphite mt-3 font-serif text-sm italic leading-relaxed">
              If you see a recommendation that carries a placeholder flag or a
              Grade C evidence mark, that is the app telling you it&apos;s not yet
              confident — not the app hiding its uncertainty.
            </p>
          </div>
        </section>

        {/* ────────────────────────────────────────────────────────────────
            10. Your data & privacy
            ──────────────────────────────────────────────────────────── */}
        <section className="flex flex-col gap-5">
          <div className="flex flex-col gap-2 border-b border-line/80 pb-3">
            <p className="eyebrow">Your data & privacy</p>
            <h2 className="font-serif text-3xl font-semibold leading-tight tracking-tight sm:text-4xl">
              The app runs a study. It says so.
            </h2>
          </div>
          <p className="text-graphite max-w-2xl font-serif text-base leading-relaxed">
            Honesty extends to data. The app is open about what it collects —
            connected-account data, imported games, and training outcomes — and
            why: those outcomes power the adaptation loop and, over time, build
            a longitudinal picture of what actually helps. In effect, the app
            runs its own small scientific study on its users&apos; data. It says so
            plainly rather than burying it in a privacy policy.
          </p>
          <div className="grid gap-4 sm:grid-cols-2">
            {[
              { title: "Transparent, not extractive", body: "Clear about what is stored and why. Data is never sold or shared for advertising or any third-party purpose." },
              { title: "User control", body: "Easy data export and deletion. GDPR-aligned by default — the builder is EU-based." },
              { title: "Aggregate and anonymized", body: "Any study or product-improvement use is aggregate and anonymized. Your individual data stays yours." },
              { title: "Light-touch feedback", body: "Feedback is invited as an ongoing signal, never obsessively or naggingly. That would violate the adherence ethic." },
            ].map((item) => (
              <div
                key={item.title}
                className="bg-card rounded-lg border border-line/80 p-4 shadow-sheet"
              >
                <p className="font-mono text-xs font-semibold uppercase tracking-tight text-ink">
                  {item.title}
                </p>
                <p className="text-graphite mt-2 font-serif text-sm leading-relaxed">
                  {item.body}
                </p>
              </div>
            ))}
          </div>
        </section>

        {/* ────────────────────────────────────────────────────────────────
            11. How it's funded — patronage, not extraction
            ──────────────────────────────────────────────────────────── */}
        <section className="flex flex-col gap-5">
          <div className="flex flex-col gap-2 border-b border-line/80 pb-3">
            <p className="eyebrow">Funding & openness</p>
            <h2 className="font-serif text-3xl font-semibold leading-tight tracking-tight sm:text-4xl">
              Patronage, not extraction.
            </h2>
          </div>
          <p className="text-graphite max-w-2xl font-serif text-base leading-relaxed">
            The long-term intent is to monetize, but modestly and on-brand. The
            model follows Lichess: free for everyone, with all training
            features included, and a single optional patronage subscription
            (~€5/month) to support development. One tier, kept deliberately
            simple.
          </p>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="bg-card eval-gutter rounded-lg border p-5 pl-6 shadow-sheet" data-grade="A">
              <p className="font-mono text-xs font-semibold uppercase tracking-tight text-ink">
                No ads
              </p>
              <p className="text-graphite mt-2 font-serif text-sm leading-relaxed">
                Ads are attention extraction — the exact thing this app
                positions against. Free means genuinely free, not
                ad-supported.
              </p>
            </div>
            <div className="bg-card eval-gutter rounded-lg border p-5 pl-6 shadow-sheet" data-grade="A">
              <p className="font-mono text-xs font-semibold uppercase tracking-tight text-ink">
                Never paywall training quality
              </p>
              <p className="text-graphite mt-2 font-serif text-sm leading-relaxed">
                The science, the program, and the adaptation are free forever.
                Premium perks are cosmetic only. The moment better training sits
                behind a paywall, the app has become the thing it&apos;s fighting.
              </p>
            </div>
          </div>
          <p className="text-graphite max-w-2xl font-serif text-base leading-relaxed">
            The app is intended to be{" "}
            <strong className="text-ink">open source (AGPL-3.0)</strong> — the
            strongest possible proof of the transparency brand. You can read
            every line of code, verify every claim, and self-host if you want.
            The methodology is already exposed in-app by the transparency
            brand; opening the code formally is consistent, not a new
            sacrifice. The durable advantages are not a secret algorithm — they
            are the curated, evidence-graded methodology corpus, the trust, and
            the longitudinal outcome data that compounds over time.
          </p>
        </section>

        {/* ────────────────────────────────────────────────────────────────
            Footer — the closing honest statement
            ──────────────────────────────────────────────────────────── */}
        <footer className="border-t border-line/80 pt-8">
          <p className="text-graphite max-w-2xl font-serif text-lg italic leading-relaxed">
            The hardest, most honest fact in chess training: no activity has
            ever been proven to cause a measured rating gain. Mainline helps
            you train smarter on the best available evidence — it never sells
            you certainty. The stance is deliberately polarizing, and that&apos;s
            fine. If you&apos;d rather follow a guru who promises 300 points in 30
            days, that&apos;s your choice. This app is for the person who&apos;d rather
            hear the truth.
          </p>
        </footer>
      </div>
    </PageShell>
  );
}
