# Deep Research Prompt Toolkit

This is the brief for the **research phase** (the *onderzoek* phase). Its output becomes the
**Methodology layer** of the app — it fills the 9 research seams listed in
`planning/BUILD.md` §11. The app architecture does **not** change when this research lands; only
`MethodologyConfig` (rules, parameters, copy) does.

---

## How to run this (tool & model)

Use a **purpose-built "Deep Research" mode**, not a plain chat — these agents browse many sources
and produce long, cited reports.

- **Recommended (rigor + honesty + structure):** OpenAI **Deep Research** (in ChatGPT, on their
  strongest reasoning model) — or **Claude Opus 4.x in Research mode**, which is especially good at
  calibrated, honest "this evidence is weak" judgements (the no-BS core).
- **Widest browsing / citation density:** **Gemini Deep Research** (latest Pro model).
- **Best value / budget:** **Perplexity Deep Research** (has a free tier with daily limits).

**Strategy:**
1. Paste the **Shared Header** (below) before every run — it sets the evidence standard, product
   context, rating bands, and output format.
2. Run **Mode A (one-shot)** once for the full overview.
3. Then run **Mode B (per-seam deep dive)** for each of the 9 questions where you want depth —
   deep-research tools produce better depth on a focused brief and have output limits.
4. **Cross-check the highest-stakes claims across two different tools.** If a finding only shows up
   in blogs or in a single tool's report, downgrade its confidence. (Apply the no-BS principle to
   your own research.)

Write the report in **English** (matches the codebase and the literature).

---

## SHARED HEADER (paste before Mode A or Mode B)

```
ROLE: You are a rigorous research analyst with expertise in the cognitive science of skill
acquisition and chess expertise, learning science (memory, practice design), and the behavioural
science of motivation and habit. You write evidence-graded, no-BS reports: you never overclaim, you
state effect sizes and uncertainty, and you would rather write "evidence is weak / unknown" than
invent precision.

PRODUCT CONTEXT: I am building a web app that generates and continuously adapts a personalised daily
chess TRAINING PROGRAM. Key facts that should shape your recommendations:
- The app HOSTS NO exercises and has NO in-app play. It points users to EXTERNAL resources
  (especially Lichess puzzles selected by theme + rating, the "redo failed puzzles" flow, books,
  and endgame trainers) and TRACKS outcomes to adapt the next session.
- It must work across ALL rating levels (treat them in bands).
- The brand is science-based and radically honest ("no-BS"): the app shows users WHY each activity
  is recommended and HOW STRONG the evidence is. So every recommendation must carry an evidence
  grade and a citation.

EVIDENCE STANDARD (this is the core of the task):
- Prefer, in order: meta-analyses & systematic reviews > peer-reviewed empirical studies >
  large-scale chess-data analyses > expert/coach opinion. Use coaching folklore/blogs ONLY when
  nothing better exists, and label it explicitly as low-evidence opinion.
- For every empirical claim: give the magnitude/effect size if available, the study context and
  sample, whether it is chess-specific or extrapolated from general learning, and a citation
  (full reference + link/DOI + year). Prefer primary sources.
- Grade every recommendation:
    A = strong, replicated evidence
    B = suggestive but limited
    C = theory / expert opinion only
    D = popular belief that is unsupported or contradicted (a "myth to avoid")
- Be explicit about uncertainty, contradictions, replication problems, and any place where chess
  evidence is absent and you are extrapolating from general learning science.
- No marketing language. If a popular practice is unsupported, say so plainly.

RATING BANDS: use approximate bands and note that online (Lichess/Chess.com) and FIDE ratings differ
and that bands are fuzzy: <800, 800-1200, 1200-1600, 1600-2000, 2000-2200, 2200+. Where guidance
depends on level, say how it changes.

OUTPUT FORMAT for each research question:
- Recommendation (what the app should do)
- Parameters / specifics (numbers, ranges, mappings) — in a TABLE where possible, so it can become
  config
- Per-rating notes (how it differs by band)
- Evidence grade (A/B/C/D)
- Key citations (full reference + link + year)
- Confidence + caveats
- A short, honest, plain-language "why this / why now" line suitable to show end-users
Also include, across the whole report: an executive summary of the 10-15 highest-confidence /
highest-ROI takeaways; a "Myths & low-evidence practices to avoid" section; and a "Where evidence is
thin — labelled best-guess defaults" section so the app has safe, clearly-marked placeholders.

ANCHOR LITERATURE (starting points to VERIFY and go beyond — do not just repeat them): de Groot;
Chase & Simon and Gobet on chunking/expertise & pattern recognition; Ericsson on deliberate practice
AND the critiques/re-analyses (Hambrick, Macnamara, Gobet, Campitelli) on how much variance it
explains; Bjork on desirable difficulties; Roediger & Karpicke on retrieval practice; Cepeda et al.
on spacing; Wilson et al. (2019) "85% rule"; spaced-repetition algorithms (Leitner, SM-2, FSRS);
Deci & Ryan self-determination theory; Lally / Wood on habit formation; and large-scale analyses
using Lichess/Chess.com datasets.
```

---

## MODE A — One-shot comprehensive prompt

```
[Paste the SHARED HEADER first, then:]

Research and answer all NINE questions below, in order, each in the required output format.

1. SKILL TAXONOMY. What distinct, measurable components of chess skill does the research
   distinguish (e.g. tactical pattern recognition, calculation/visualisation depth, positional
   understanding, opening knowledge, endgame technique, time management, blunder-avoidance / board
   vision, psychological factors / tilt)? Which components are most predictive of rating and most
   trainable at each band?  (Feeds: the dimensions the app measures.)

2. DIAGNOSIS FROM A PLAYER'S OWN GAMES + ASSESSMENT VALIDITY. Which signals from a player's own
   games reliably indicate weakness in each component (e.g. average centipawn loss by game phase,
   blunder rate, time-trouble patterns, recurring missed tactical motifs, opening result stats,
   conversion of winning/losing positions)? How valid and reliable are these signals? Separately:
   are self-report questionnaires / onboarding "assessment quizzes" valid for diagnosing chess
   weaknesses, and how should an onboarding assessment be designed to be genuinely informative
   rather than just feel good?  (Feeds: feature->weakness interpretation + assessment design.)

3. WHAT ACTUALLY RAISES RATING, PER LEVEL (the core question). Rank common training activities by
   the EVIDENCE for their rating ROI at each band: solving tactics/puzzles, analysing one's own
   games, endgame study, opening study, calculation drills, playing longer time controls,
   blunder-checking habits, studying master games, etc. Quote effect sizes / data where they exist
   and state plainly where the evidence is weak or merely conventional wisdom.  (Feeds: which
   activity for which weakness/level, and how the daily mix is prioritised.)

4. PRACTICE DESIGN & OPTIMAL DIFFICULTY. What does the science say about difficulty targeting
   (desirable difficulty, optimal challenge / success-rate sweet spots), and specifically how should
   puzzle difficulty be set relative to a player's puzzle rating? Cover interleaving vs blocking,
   variability, and problem selection.  (Feeds: difficulty / calibration targets.)

5. SPACED REPETITION & RETENTION. What is the evidence for spaced repetition and retrieval practice
   in skill and pattern learning, and does it transfer to chess pattern recognition specifically (vs
   only verbal memory)? Which scheduling algorithm is best supported (Leitner / SM-2 / FSRS /
   other), with what parameters? How should a "redo failed puzzles" feature be scheduled?  (Feeds:
   the spacing/scheduling algorithm + parameters.)

6. VOLUME, FREQUENCY, SESSION DESIGN, PERIODISATION, PLATEAUS. How much practice, how often, and how
   long per session — including diminishing returns? Summarise the deliberate-practice literature
   AND its critiques honestly (how much variance it explains, individual differences, role of
   starting age/aptitude). Does athletic-style PERIODISATION (load cycling, deload, peaking) have
   ANY evidence base for cognitive/chess training, or is applying it speculative? What does evidence
   say causes plateaus and what helps break them?  (Feeds: periodisation/prioritisation logic +
   volume guidance + honest caveats.)

7. ADHERENCE, MOTIVATION & ETHICAL ENGAGEMENT. What sustains long-term practice adherence
   (self-determination theory: autonomy/competence/relatedness; goal-setting; implementation
   intentions; habit formation; feedback)? Which gamification/engagement mechanics have evidence for
   increasing SUSTAINED engagement and learning, and which (e.g. manipulative variable-reward / dark
   patterns) backfire or harm intrinsic motivation? Give ethical guardrails consistent with an
   honest, no-BS brand.  (Feeds: which reward mechanics we use + the ethical limits.)

8. REALISTIC EXPECTATIONS & MEASUREMENT. What rating gains are realistically achievable over given
   timeframes and effort levels, and how widely do they vary (so we can set honest expectations
   rather than hype)? How should improvement be measured reliably given rating noise, sample size,
   online vs OTB differences, and rating inflation/deflation?  (Feeds: honest expectation copy +
   progress measurement.)

9. USER-FACING RATIONALE COPY. For each major recommendation above, draft a short, honest,
   plain-language "why this / why now" explanation with its evidence grade and a citation, suitable
   to show end-users in the app.  (Feeds: the rationale/evidence text shown in the UI.)
```

---

## MODE B — Per-seam deep-dive template

Use this to go deeper on a single question. Paste the SHARED HEADER, then:

```
Do a DEEP dive on the following single question for a science-based chess training app. Find and
weigh the best available evidence, grade it (A/B/C/D), give config-ready parameters in tables,
break it down by rating band, be explicit about uncertainty and myths, and end with user-facing
"why" copy. Prefer primary sources and meta-analyses; flag anything that is only coach folklore.

QUESTION: <paste one of the nine questions above>

Additionally: list the 5-10 most important sources you relied on with one line each on their quality
(sample size, design, chess-specific or not), and explicitly name anything you could NOT find good
evidence for.
```

---

## Gemini per-seam prompts (recommended for Gemini Deep Research)

Run these as **8 separate Deep Research runs (#1–#8)** — deeper and better-cited than one mega-query.
Each run is independent, so **paste the PREAMBLE above each run**, then one topic block. **#9 is not
research** — run it last in normal Gemini (not Deep Research) with the 8 reports pasted in.
Want fewer runs? **#1+#2** and **#4+#5** combine naturally. Suggested order: **#3** first, then the
rest, **#9** last.

### PREAMBLE — paste above every run (#1–#8)

```
You are a rigorous, no-BS research analyst (cognitive science of skill/expertise, learning science,
motivation/habit science). Evidence standard: prefer meta-analyses & peer-reviewed studies >
large-scale chess-data analyses > expert opinion; use coach folklore only if nothing better exists
and label it as such. For every empirical claim give effect size/magnitude, context/sample, whether
it is chess-specific or extrapolated, and a citation (full ref + link/DOI + year; primary sources
preferred). Grade each recommendation A (strong, replicated) / B (suggestive, limited) / C (theory or
expert opinion only) / D (popular but unsupported — a myth to avoid). Be explicit about uncertainty,
contradictions, and where you extrapolate beyond direct evidence. No marketing language; prefer
"unknown / weak evidence" over invented precision.

CONTEXT: This feeds a science-based, radically honest chess TRAINING-PROGRAM web app that hosts no
content and runs no games — it points users to EXTERNAL resources (esp. Lichess puzzles by
theme+rating, "redo failed puzzles", books, endgame trainers) and tracks outcomes to adapt a daily
program. It must work for ALL levels. Use approximate, fuzzy rating bands and note online vs FIDE
differences: <800, 800-1200, 1200-1600, 1600-2000, 2000-2200, 2200+.

OUTPUT: Write in English. Give a short executive summary, then for each recommendation:
Recommendation -> config-ready Parameters in a TABLE (numbers/ranges/mappings) -> Per-rating notes ->
Evidence grade (A/B/C/D) -> Key citations -> Confidence & caveats -> one honest plain-language
"why this / why now" line for end-users. End with "Myths to avoid" and "Where evidence is thin:
labelled best-guess defaults".
```

### #1 — Skill taxonomy  (feeds: the dimensions the app measures)

```
TOPIC: The distinct, measurable components of chess skill.
Identify the components the research distinguishes — e.g. tactical pattern recognition,
calculation/visualisation depth, positional/strategic understanding, opening knowledge, endgame
technique, time/clock management, blunder-avoidance & board vision, psychological factors (tilt,
anxiety). For each: how is it defined and measured in studies; how predictive is it of overall
rating; how trainable is it; and how does its importance shift by rating band? Conclude with a
recommended taxonomy of 6-10 trainable dimensions the app should track, each with a one-line
measurable definition.
```

### #2 — Diagnosis from games + assessment validity  (feeds: feature→weakness + onboarding assessment)

```
TOPIC: Diagnosing a player's weaknesses.
(a) From their own games: which measurable signals reliably indicate weakness in each skill
component — average centipawn loss overall and by phase (opening/middlegame/endgame), blunder/mistake
rates, time-trouble and move-time patterns, recurring missed tactical motifs/themes, opening result
stats, conversion of winning and holding of drawn/losing positions? State validity/reliability of
each signal and the data needed to compute it.
(b) From onboarding: is self-report or a short tactical "assessment quiz" valid for diagnosing chess
weaknesses? How should an onboarding assessment be designed to be genuinely informative (adaptive
calibration puzzles, what to ask, what NOT to claim)? Give a recommended assessment design.
```

### #3 — What actually raises rating, per level (the core question)  (feeds: activity mapping + prioritisation)

```
TOPIC: Evidence-ranked training activities by rating ROI, per band.
Rank common training activities by the EVIDENCE for their effect on rating improvement, separately
per band: solving tactics puzzles, analysing one's own games, endgame study, opening
study/repertoire, calculation/visualisation drills, playing (and which time controls),
blunder-checking routines, studying annotated master games, positional/strategy study, coaching.
Quote effect sizes, controlled studies, or large-scale data where they exist; where it is only
conventional wisdom, say so plainly. Then give a recommended priority ordering of activities per
band, each with its evidence grade.
```

### #4 — Optimal difficulty & practice design  (feeds: difficulty/calibration targets)

```
TOPIC: Optimal training difficulty and problem selection.
What does the evidence say about optimal difficulty for skill learning, applied to chess puzzles?
Cover desirable difficulty, the optimal success-rate / error-rate "sweet spot", and how to set
puzzle difficulty relative to a learner's puzzle rating (give a concrete target success rate or
rating offset and its basis). Cover interleaving vs blocking of themes and variability of practice.
Config-ready output: target success-rate band, rule for puzzle-rating vs user-rating, theme
interleaving rules.
```

### #5 — Spaced repetition, retention & "redo failed puzzles"  (feeds: scheduling algorithm + params)

```
TOPIC: Spaced repetition for chess pattern learning + scheduling.
What is the evidence for spaced repetition and retrieval practice for SKILL and PATTERN learning,
and does it transfer to chess pattern recognition specifically (not just verbal memory)? Compare
scheduling algorithms (Leitner, SM-2, SuperMemo, FSRS, half-life regression) on evidence and
practicality and recommend one with parameters. How should a "redo previously failed puzzles"
feature be scheduled (initial interval, interval growth, lapse handling)? Give a config-ready
scheduling spec.
```

### #6 — Volume, frequency, periodisation & plateaus  (feeds: periodisation/volume + honest caveats)

```
TOPIC: How much/how often to train; periodisation; plateaus.
How much practice, how often, how long per session — and where do diminishing returns set in?
Summarise the deliberate-practice literature AND its critiques honestly (variance explained,
individual differences, role of starting age/aptitude). Critically: does athletic-style PERIODISATION
(load cycling, deload weeks, peaking/tapering) have ANY evidence base for cognitive/chess training,
or is applying it speculative — say so plainly. What causes improvement plateaus and what (if
anything) reliably breaks them? Config-ready output: weekly volume/frequency ranges by
available-time and level, session-length guidance, and whether/how to vary load over time (with
evidence grade).
```

### #7 — Adherence, motivation & ethical engagement  (feeds: engagement mechanics + ethical limits)

```
TOPIC: What sustains practice, done ethically.
What sustains long-term practice adherence per evidence? Cover self-determination theory (autonomy,
competence, relatedness), goal-setting theory, implementation intentions, habit formation
(cue-routine-reward; time to form habits), and feedback. Which engagement mechanics (streaks, points,
badges, leaderboards, progress feedback, reminders, variable rewards) have evidence for increasing
SUSTAINED engagement and actual learning, and which backfire or undermine intrinsic motivation (dark
patterns)? Recommend a set of mechanics for an honest "no-BS" app, with explicit ethical guardrails
(what we will NOT do).
```

### #8 — Realistic expectations & measuring improvement  (feeds: expectation copy + progress measurement)

```
TOPIC: Honest expectations and reliable progress measurement.
What rating gains are realistically achievable over given timeframes and effort levels, and how
widely do outcomes vary across individuals (give ranges/distributions, not single numbers)? What
factors most influence the rate of improvement? Separately: how should improvement be measured
reliably given rating noise, the number of games needed for a stable estimate, online vs OTB
differences, and rating inflation/deflation? Give honest expectation statements the app can show
users, and a recommended way to measure and display progress.
```

### #9 — Synthesis: user-facing "why" copy  (run LAST, normal Gemini, not Deep Research)

```
Run AFTER the 8 reports; paste them in as context. Do NOT do new research.
You are writing user-facing "why this / why now" microcopy for a science-based, radically honest
chess training app. Using ONLY the findings and evidence grades from the 8 reports I provide, draft a
short, honest, plain-language explanation for each major recommendation (e.g. why these puzzles at
this difficulty, why redo failed puzzles, why analyse your own games, why this weekly volume, why
this expectation is realistic). Each item: 1-2 sentences, no hype, with its evidence grade (A/B/C/D)
and one citation. Flag any recommendation whose evidence is weak so we can soften the claim.
Output as a table: item | when shown | microcopy | evidence grade | citation.
```
