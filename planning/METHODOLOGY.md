# METHODOLOGY.md — the research, translated into the methodology layer

> **Purpose of this document.** This is the authoritative translation of the `research/` phase into
> the app's **Methodology layer**. It is the single source the build will encode as a versioned
> **`MethodologyConfig`** (data + a few pure functions behind interfaces). It is organised
> **seam-by-seam** against the nine research seams defined in `BUILD.md` §11, with a prioritised
> findings summary up front (Pass 1) and a "thin evidence / deliberately stubbed" section at the end.
>
> Read order: `planning/VISION.md` (what/why) → `planning/BUILD.md` (how, the engine/seam split) →
> this file (the science that fills the seams) → `research/` (the evidence base behind every number).
>
> **This file contains no application code and proposes no architecture change.** Everything here is
> expressible as config data + pure functions that the engine already knows how to read. Where this
> document sketches a schema or a function signature, that is *specification notation* for the build,
> not implementation.

---

## 0. How to read this file (binding conventions)

### 0.1 The central caveat — preserved everywhere

> **No training activity has been *proven* to *cause* a measured chess-rating gain.** The entire
> chess-specific literature is observational/correlational (cross-sectional or self-report
> longitudinal), both of which suffer reverse causation — stronger players study and play more. We
> therefore lean on **Tier 2** general learning-science for *mechanism* and **Tier 1** chess data for
> *direction*, and we flag causation explicitly. Defaults are conservative; copy never promises a
> rating. (`WHAT_RAISES_RATING.md`, central caveat; `TRAINING_PROGRAMMING.md`, "what I could not find".)

This caveat is not a footnote — it is a product feature (VISION §2). It must remain literally visible
in the app and must constrain every default and every line of copy in Seam 8.

### 0.2 Evidence grading (carried on every value)

| Grade | Meaning |
|---|---|
| **A** | Strong, replicated evidence |
| **B** | Suggestive but limited |
| **C** | Theory / expert opinion only |
| **D** | Popular belief that is unsupported or contradicted (a myth to avoid) |

| Tier | Meaning |
|---|---|
| **Tier 1** | Chess-specific evidence (often observational/weak, but *about chess*) |
| **Tier 2** | Strong general learning-science, *extrapolated* to chess by analogy |

A grade like **A/C** means "Grade A in general learning science (Tier 2), Grade C as a chess
prescription (Tier 1)". This split recurs constantly and must be preserved.

### 0.3 The rule: never strip evidence from a value

Per `CLAUDE.md`, **every methodology parameter carries its grade + citation**. The build should encode
numbers not as bare scalars but as a graded wrapper, conceptually:

```
GradedValue<T> = {
  value: T,
  grade: 'A' | 'B' | 'C' | 'D',
  tier: 1 | 2,
  citationKey: string,          // → §10 anchor sources
  flag?: 'best-guess' | 'semi-evidenced' | 'contested' | 'stub',
  note?: string                 // e.g. "servo target, not a hardcoded constant"
}
```

This wrapper is what lets the transparency UI (Seam 8) show the "why" and the evidence grade for any
number, and it is what keeps a Grade-D or stubbed value from ever masquerading as fact.

### 0.4 Rating bands (used throughout)

Online, **fuzzy**, ±150 points; Lichess runs materially higher than Chess.com, both differ from FIDE
(`WHAT_RAISES_RATING.md` methodological notes). Bands are a convenience for priors; **the user's own
data always overrides band priors.**

`<800 · 800–1200 · 1200–1600 · 1600–2000 · 2000–2200 · 2200+`

---

## 1. PASS 1 — Prioritised findings (what actually drives the product)

### 1.1 Governing findings (shape the whole product)

| # | Finding | Grade / Tier | Effect size / confidence | Caveat | Seam(s) |
|---|---|---|---|---|---|
| G1 | **No activity is proven to cause rating gain.** | — | All Tier-1 evidence observational | The brand-defining honesty constraint | All; esp. 8 |
| G2 | **Deliberate practice is necessary but not sufficient** — explains ~26% of variance in games, ~34% in chess (corrected). | A / mixed | 26% (Macnamara 2014); ~34% (Hambrick 2014); ~40% combined (Charness 2005) | Correlational; recall error | 7, 8 |
| G3 | **Hours-to-mastery vary ~8×** (3,016–23,608 h to master); some exceed 25,000 h and never reach it. | A / 1 | Gobet & Campitelli 2007 (N=90) | Self-report, modest N | 7, 8 |
| G4 | **Chess skill is fundamentally pattern/chunk recognition,** not raw calculation depth. Experts hold ~50k–100k chunks. | A / 1 | de Groot; Chase & Simon 1973; Gobet | Mechanism, not a training prescription | 1, 4, 5, 6 |
| G5 | **Below ~2000, games are decided by blunders/tactics, not strategy.** Decisive games decided by tactics ≈42% (master) → 72% (1800–2000) → >85% (<1500). | A (descriptive) / 1 | Smith & Tikkanen 2018; Anson & Kleinberg 2016 | "Tactics fix the leak" causally is C | 1, 3, 4, 7 |
| G6 | **Cognitive ability correlates only modestly with skill** (r≈0.22–0.24; ~6% variance), more at lower/younger. | B / 1 | Burgoyne et al. 2016 (k=19, N=1,779) | Range-restricted; corrigendum | 7, 8 |
| G7 | **Three Tier-2 effects are the strongest mechanisms we can lean on:** retrieval practice, spacing, desirable difficulty. | A / 2 | Retrieval g≈0.51 (Adesope 2017, 272 effects); spacing (Cepeda 2006, 839 assessments) | Proven on verbal/perceptual, **not** chess | 5, 6 |
| G8 | **Self-reported skill diagnosis is invalid** (Dunning-Kruger in chess). Diagnose behaviourally. | A / 1 | Heck, Benjamin, Simons & Chabris 2025; Kruger & Dunning 1999 | Self-report still valid for *constraints/goals* | 2, 3 |
| G9 | **Process goals beat outcome goals.** Training on controllable *process* targets ("15 puzzles from my mistake log today") lifts performance and self-efficacy; *outcome* goals ("hit 1800") add anxiety and negligible gain. The UI must act as a **"cognitive firewall"** — surface controllable process metrics, de-emphasise raw ELO. | A / 2 | Williamson et al. 2022 (meta-analysis, 27 studies) | Sport-psych, extrapolated to chess | 7, 8, 9, M |
| G10 | **Improvement is the exception, not the norm.** Over 7 years 96% of active players show no substantial lasting rating gain; progress is non-linear and slows sharply with level. Honest expectations are a retention feature, not a disclaimer. | A / 1 | Blanch 2023 (N=72,022); Lichess ETL (2.3M players) | Observational | 7, 8, M |

*(M = the cross-cutting Measurement & expectations section, after Seam 9.)*

### 1.2 Seam-critical findings (each becomes config)

| # | Finding | Grade / Tier | Key number | Seam |
|---|---|---|---|---|
| S1 | 6–8 measurable skill dimensions, but tactical & positional share high factor correlation — don't over-separate. | A–C / 1 | Van der Maas & Wagenmakers 2005 | 1 |
| S2 | Onboarding = behavioural: background game import + short adaptive tactical calibration; minimise cognitive load. | A / 1+2 | Cheung et al. 2014 (load) | 2 |
| S3 | **Blunder rate** (severe eval-drop frequency, decided-positions excluded) is the highest-ROI per-player diagnostic sub-2000. | A (descriptive) / 1 | blunder ≥150–300cp | 3 |
| S4 | **ACPL is a weak *standalone* diagnostic** (explains 5–7% of rating variance) though it correlates at the aggregate; prefer blunder rate + STDCPL; never headline raw ACPL. | A / 1 | Coulombe 2017 | 3, 8 |
| S5 | **Opening win-rate diagnosis needs ~194 games/ECO** for 80% power; below that it is noise → suppress, use early-opening CPL instead. | A (math) / 1 | binomial power | 3 |
| S6 | **Activity ROI is ranked and band-dependent:** playing rated games + blunder reduction + themed tactics dominate low bands; endgame/opening/master games earn weight only ≥~1600. | B/C / 1 | Howard 2012 (log games strongest) | 4, 7 |
| S7 | **Puzzle volume for its own sake is a myth** (r=−0.02 vs closing puzzle-game gap). Reflection, themes, spacing matter, not counts. | B (against) / 1 | chessanalysis.co (2,763 players) | 4, 5, 7 |
| S8 | **Optimal-difficulty sweet spot ≈85% success** for pattern learning; a separate **calculation track ~50–60%**. | B / 2 (A in ML, not chess) | Wilson 2019 (err 15.87%) | 5 |
| S9 | **FSRS v6 is the best-supported scheduler;** target 90% retention; ~20–30% fewer reviews than SM-2. | A / 2 (B–C chess) | Ye et al. 2022; OSR benchmark | 6 |
| S10 | **Redo failed puzzles** with scaffolded hint → delayed intra-session retest → next-day FSRS; never immediate massed retest, never passive solution-reveal. | A / 2 (C chess) | Finn & Metcalfe 2010; Roediger & Karpicke 2006 | 6 |
| S11 | **Interleave themes, but adaptively:** block for beginners (cognitive-load limit), interleave from intermediate up; gate by per-motif mastery. | A / 2 (C chess) | Rohrer & Taylor 2010 (+43%); Sweller 1988 | 5, 6 |
| S12 | **Athletic periodisation (deload/taper/load-cycling) has no cognitive/chess evidence.** "Periodisation" in this product = daily re-prioritisation only. | C–D / — | TRAINING_PROGRAMMING; no source found | 7 |
| S13 | **Consistency > volume:** 5–7 short days/week beats cramming; mental fatigue degrades accuracy; **no chess dose-response curve exists.** | A (direction) / 2; C–D (numbers) | Cepeda 2006; Lally 2010 | 7 |
| S14 | **Time management is a distinct trainable skill;** experts scale think-time to position value (VOC). | A / 1 | Kuperwajs et al. 2025 (>12M games) | 1, 3, 4 |
| S15 | **Plateaus are usually under-targeted practice or normal diminishing returns, not a genetic ceiling.** Break by changing stimulus. | B (returns) / C (OK-plateau) / D (ceiling) | Bjork & Bjork 2011; Vaci & Bilalić 2014 | 7, 8 |
| S16 | **Engagement that lasts = autonomy + competence (SDT);** contingent/manipulative rewards undermine intrinsic motivation. | A (mechanism) / 2 | Deci, Koestner & Ryan 1999 (128 exp.) | 9 |
| S17 | **Rating is noisy; most short-term swings are statistical noise.** Use the Glicko-2 95% CI (≈ R ± 2·RD); only call progress *real* when the new CI lower bound clears the old upper bound. | A / 1 | Glicko-2 CI = R ± 1.96·RD (Glickman 2012) | M, 8, 9 |
| S18 | **Diminishing returns are steep and quantified.** +100 pts ≈ 1–2 months at 800–1000 but ≈ 3–4 years at 1600–2000. Personalise to the user's own baseline, never population averages. | A / 1 | Lichess ETL (2.3M players, 450M games) | 7, 8, M |
| S19 | **Implementation intentions ("if-then" plans) sharply raise follow-through.** Anchor training to an existing daily cue at onboarding. | A / 2 | Gollwitzer & Sheeran 2006 (d≈0.65) | 9 |
| S20 | **Feedback must target the task/process, never the self.** "You missed a deflection" helps; "you're talented" harms resilience. | A / 2 | Wisniewski et al. 2020 (435 studies) | 6, 9 |
| S21 | **Engagement dark patterns backfire.** Infinite streaks (loss-aversion → "quit moment") and global leaderboards (downward social comparison) cut long-term motivation; use capped/forgiving streaks, a consistency grid, and same-level peer comparison only. | A / 2 | Hanus & Fox 2015; Silverman & Barasch 2023 | 9 |
| S22 | **Online↔FIDE conversion is invalid post-2024.** FIDE's March-2024 reform (floor→1400, sub-2000 one-time bump, 400-pt rule) voided pre-2024 tables; never show OTB below ~1200 online. | A (math) / 1 | FIDE Mar-2024 reform (Sonas) | M, 8 |

### 1.3 Contradictions across reports — reconciled (the no-BS core)

These four genuine conflicts appear *between* the reports. Resolving them honestly is itself a product
feature; the build must encode the reconciliation, not one side.

| Conflict | Report A says | Report B says | **Reconciliation encoded in config** |
|---|---|---|---|
| **ACPL value** | `SKILL_TAXONOMY`: ACPL "most robust proxy", Grade A | `WEAKNESS_DIAGNOSIS`: ACPL "diagnostically invalid standalone" (5–7% variance), Grade A | Both true at different scales. ACPL **correlates with rating in aggregate** (use only as a coarse band benchmark, wide bands) but is a **weak per-player, small-sample diagnostic** and a poor progress metric. **Primary signal = blunder rate; secondary = STDCPL/phase ACPL; never headline raw ACPL.** The two reports also give *different* ACPL baselines — carry both, mark `contested`, default conservative, calibrate from telemetry. |
| **Success-rate target / Elo offset** | `PRACTICE_DESIGN` & `SPACED_REPETITION`: ~85%, offsets −150 to −250 | `SKILL_TAXONOMY`: offset −50; `TRAINING_PROGRAMMING`: be conservative, 75–80% | **Make success rate the control variable and the Elo offset the actuator.** Do not hardcode an offset; a controller servos the offset to hit the *measured* rolling success target. Ship the offset tables only as seeds, flagged `contested`. |
| **Woodpecker / massed repetition** | `WEAKNESS_DIAGNOSIS`, `PRACTICE_DESIGN`: Woodpecker builds recognition (+10pp acc, −21% time, cycle 2) | `SKILL_TAXONOMY`, `SPACED_REPETITION`: reject massed cramming; spacing wins long-term | Separate **intra-task fluency** (real, observed, Grade B) from **long-term retention** (spacing wins, Grade A/2). Repeated exposure helps — but deliver it via **spaced** "redo failed puzzles," not massed cycles. |
| **Scheduler / intervals** | `PRACTICE_DESIGN`: modified SM-2 / Leitner (1-3-7-21-45-90) | `SPACED_REPETITION`, `WHAT_RAISES_RATING`, `TRAINING_PROGRAMMING`: FSRS v6, 90% retention | **FSRS v6 is the scheduler** (consensus of 3 reports). The SM-2/Leitner ladder is retained only as an **explainable fallback** when FSRS state is unavailable. |

> **Two earlier conflicts now resolved at source.** The first draft also listed `USER_FACING` vs `MOTIVATION`
> conflicts on **streaks** and the **SDT grade**. The revised `USER_FACING.md` now itself prescribes
> **forgiving / grace-period streaks** (a missed day never resets progress to zero) and grades **SDT as A**,
> so both conflicts vanish at the source rather than needing arbitration. The landing point is unchanged and
> still encoded in Seam 9: capped/forgiving streaks + a consistency grid; SDT carried as
> **A (mechanism) / C (chess)**.

### 1.4 Interesting-but-minor / deliberately downgraded

- **Far transfer** ("chess makes you smarter / boosts math"): weak and confounded (Sala & Gobet 2016, g=0.34, no active controls). **Grade D for marketing — never claim it.** Irrelevant to rating.
- **de la Maza "400 points in 400 days"**: n=1, confounded, never replicated. **Grade D.** Do not cite as proof tactics-only works.
- **Regan IPR (Consistency/Sensitivity)**: gold-standard but needs depth-18+ server analysis — out of scope for the client-side engine; **stub**, use blunder rate + STDCPL as proxies.
- **VOC (Value of Computation) for time diagnosis**: excellent but needs multi-depth eval; **stub the precise version**, proxy with time-vs-eval-swing.
- **Psychological tilt interventions**: documented in poker/esports, thin in chess. **Stub** a forgiving cooling-off default only.

---

## 2. PASS 2 — Seam-by-seam implementation

Each seam below gives: the findings that fill it → config (values/ranges/defaults, each carrying
grade+citation) → the pure function(s) the engine calls → per-band directives → what stays a **STUB**.
User-facing copy is centralised in **Seam 8** but each seam names its copy key.

---

### Seam 1 — Skill dimensions & taxonomy
*Feeds: the dimensions the app measures. Source: `SKILL_TAXONOMY.md`.*

**Decision.** Track **7 dimensions** (plus one stubbed psychological dimension). Keep them as data, not
code. Honour the psychometric caveat that **tactical and positional ability share a high factor
correlation** (Van der Maas & Wagenmakers 2005) — measure them separately but expect correlation; do
not present them as independent.

**Config — `dimensions: SkillDimension[]`**

| id | label | one-line measurable definition | primary signal | predictive sub-2000 | trainability | grade |
|---|---|---|---|---|---|---|
| `tactics` | Tactical pattern recognition | Solves themed motifs at/under puzzle rating at target success | puzzle rating; blunder rate | ★★★ | high | A/1 |
| `board_vision` | Blunder avoidance / board vision | Rate of unforced severe eval drops (decided positions excluded) | blunder rate | ★★★ | high | A/1 |
| `calculation` | Calculation / visualisation depth | Accuracy on multi-ply, slow, "solve before moving" puzzles | hard-puzzle accuracy | ★ (rises ≥1400) | mixed | B/1 |
| `positional` | Positional understanding | Quality of quiet-move/plan choices in non-forcing positions | phase ACPL (mid) | ★ (rises ≥1600) | slow | C/1 |
| `openings` | Opening knowledge | Ply of first theory deviation incurring CPL loss | early-opening CPL | ★ (≥2000) | high | A/1 |
| `endgames` | Endgame technique | Conversion of ≥+1.5 and save of ≤−1.5 after move 40 | conversion/save rate | ★ (rises ≥1200) | high | B/1 |
| `time_mgmt` | Time management | Correlation of think-time with position value (VOC) | clock vs complexity | ★★ | high | A/1 |
| `psych` *(stub)* | Tilt / self-regulation | Consecutive-loss + ACPL deterioration pattern | loss streak + ACPL | unknown | unknown | C–D/1 |

**Per-band salience prior — `dimensionSalience[band][dimension]`** (a coaching-consensus prior matrix,
**Grade C**, `best-guess`, always overridden by the user's own data): low bands weight
`board_vision`/`tactics` heavily and `positional`/`openings` near zero; weight shifts toward
`calculation`/`positional`/`endgames`/`openings` from ~1600 up (per the per-band directives in
`SKILL_TAXONOMY.md` Components 1–7).

**Pure function.** `dimensionsForBand(band, config) → orderedDimension[]` (data lookup; no logic).

**STUB.** The `psych` dimension and the salience-prior weights (Grade C). The whole matrix is a prior;
the real signal is Seam 3.

---

### Seam 2 — Assessment quiz content + scoring
*Feeds: onboarding assessment design + initial `SkillState`. Source: `WEAKNESS_DIAGNOSIS.md` §2.*

**Decision.** **Reject self-report skill questionnaires for diagnosis** (Dunning-Kruger, Grade A/1).
Self-report remains valid and necessary for **constraints, goals, owned resources, preferences** (these
are not skill claims). Onboarding diagnosis is **behavioural + low-cognitive-load**:

1. **Background import** of recent games (target ~100). Evaluate the most recent ~5 instantly; queue the
   rest for background analysis (compute realism caveat from the report).
2. **Short adaptive tactical calibration** (~3 min, Item-Response-style ladder over Lichess puzzles by
   rating) to get a fast tactical-rating estimate with an uncertainty — especially needed when game
   history is thin/absent.
3. **The "reveal"** — present the data-driven dashboard that contrasts objective signals with common
   self-bias (gracefully defuses Dunning-Kruger).

**Config — `assessment`**

| field | default | grade | note |
|---|---|---|---|
| `selfReportForSkill` | `false` (forbidden) | A/1 | Heck et al. 2025 |
| `selfReportForConstraints` | `true` | — | goals/time/resources only |
| `calibration.items` | 8–12 adaptive | C | `best-guess` IRT length |
| `calibration.timeBudgetMin` | 3 | C | minimise load (Cheung 2014) |
| `calibration.startRating` | platform puzzle/rapid rating if present, else band midpoint | B | |
| `calibration.itemOffsetRule` | servo toward ~75–85% (see Seam 5) | B/2 | |
| `calibration.stopRule` | rating SE < threshold OR items exhausted | C | `best-guess` |
| `instantEvalGames` | 5 | A | compute-cost realism |
| `noHistoryFallback` | basic board-vision / one-move set | A/1 | <800 path |

**Pure functions.**
`nextCalibrationItem(history, config) → targetPuzzleRating` (adaptive ladder);
`scoreCalibration(responses, config) → { tacticalRatingEstimate, uncertainty }` →
seeds `SkillState` with explicit uncertainty.

**STUB.** Exact IRT parameters; any attempt to diagnose **semantic** strategic weakness from a quiz
("you don't understand the minority attack") — explicitly unsupported (report: AI/quiz attempts
hallucinate). Calibration estimates **tactical vision only**; everything else comes from game data.

---

### Seam 3 — Game-feature → weakness interpretation
*Feeds: turning raw analysis features into graded weakness signals. Sources: `WEAKNESS_DIAGNOSIS.md`
§1, `SKILL_TAXONOMY.md`.*

This is the diagnostic heart. The engine's analysis module produces **raw features only**; this seam is
the interpretation. **Every emitted signal carries a confidence and a sample size**, and an explicit
**"insufficient data"** state — surfacing that is the radical-honesty feature, not a failure.

**Config — `interpretation`**

**(a) Blunder / error thresholds** (reconciling the two reports' differing cutoffs):

| param | value | grade | source |
|---|---|---|---|
| `inaccuracy` | 50–100 cp drop | A/1 | (ignored as signal for <1800) |
| `blunder` | ≥ 150 cp drop | A/1 | WEAKNESS_DIAGNOSIS |
| `grossBlunder` | ≥ 300 cp drop | A/1 | SKILL_TAXONOMY |
| `excludeDecidedAbove` | |eval| already > 600–800 cp | A/1 | filter irrelevant blunders |
| `sub100IgnoreBelowRating` | 1800 | B/1 | ignore micro-inaccuracies for amateurs |

**(b) Per-band baselines** — used to compare a user against peers. **Contested across reports; carry
both, mark `contested`, default conservative, recalibrate from app telemetry.**

| band | expected blunder rate (drop ≥150) | ACPL baseline (aggregate only) | STDCPL target | conversion (+1.5) | save (−1.5) |
|---|---|---|---|---|---|
| <800 | >20% | >80 / >95* | >100 | <40% | <5% |
| 800–1200 | 10–20% | 60–80 / ~95* | 80–100 | 40–60% | 5–10% |
| 1200–1600 | 5–10% | 45–60 | 60–80 | 60–75% | 10–20% |
| 1600–2000 | 2–5% | 30–45 / ~54* | 45–60 | 75–85% | 20–30% |
| 2000–2200 | 1–2% | 20–30 | 35–45 | 85–92% | 30–40% |
| 2200+ | <1% | <20 / ~34* | <35 | >92% | >40% |

*\*Second ACPL figure is `SKILL_TAXONOMY.md`'s differing baseline (1200→95, 1800→54, 2200→34). The
disagreement is exactly why ACPL is `contested` and never a headline metric.* (Grade A that the metric
correlates in aggregate; the specific baselines are B/`contested`.)

**(c) Signal-specific rules**

| signal | rule | needs | grade | stub? |
|---|---|---|---|---|
| Blunder-rate weakness | user rate > 1.2× band baseline over trailing ≥20 games → flag `board_vision`/`tactics` | client eval | A desc / C train | — |
| Missed-motif weakness | cross-ref blundered positions with Lichess motif tags → recurring failed themes → Seam 4 | puzzle tags | A/1 | filter over-deep tags |
| Phase localisation | compare ACPL/error by opening/middle/endgame to localise | phase split | B/1 | — |
| Time impulsivity | think-time <5% of budget in high-VOC position + loss >100cp | move clocks + VOC | A/1 | **VOC = stub**, proxy by eval swing |
| Time hesitation | think-time >15% in low-VOC position | move clocks + VOC | A/1 | **VOC = stub** |
| Endgame leak | conversion/save below band table | tablebase eval | B/1 | **Syzygy integration = stub** |
| Opening leak | **only if ≥194 games/ECO**; else early-opening CPL>100 (moves 1–10) or >30% clock in first 10 moves | game stats | A (math) / 1 | — |

**(d) Sample-size / confidence gates** (the honesty engine): emit `insufficient-data` rather than a
fabricated diagnosis whenever `n` is below the gate. Opening win-rate gate = **194 games/ECO**
(suppress <50 outright). Blunder-rate gate = **≥20 games**. (Grade A/1, binomial power.)

**Pure functions.**
`interpretGameFeatures(rawFeatures, band, config) → WeaknessSignal[]` where each
`WeaknessSignal = { dimension, severity, confidence, sampleSize, evidenceGrade, rationaleKey }`;
`confidenceFromSampleSize(n, signalType, config) → 'insufficient'|'low'|'medium'|'high'`.

**STUB.** Regan IPR Consistency/Sensitivity (depth-18+ server cost) → proxy with blunder rate + STDCPL;
VOC multi-depth → proxy; Syzygy-accurate endgame eval (engines misjudge fortresses) → flag; **semantic
strategic weakness** (no reliable method exists — report says human review required); the contested ACPL
baselines.

---

### Seam 4 — Weakness/level → resource + params mapping
*Feeds: which external activity, at what params, for which weakness/band. Sources:
`WHAT_RAISES_RATING.md`, `SKILL_TAXONOMY.md`.*

**Decision.** A data-driven catalog of **activities** (each pointing only to *external* resources) plus
**rules** mapping weakness signals + band → candidate activities, ordered by the report's
evidence-graded ROI ranking. **Carry the causal-evidence grade on every activity** — most are C.

**Config — `activities: ActivityDefinition[]`** with per-band priority (from
`WHAT_RAISES_RATING.md`'s ranking table; ★★★→3 … ★→1; `D` flagged):

| activity | dimensions | <800 | 800–1200 | 1200–1600 | 1600–2000 | 2000–2200 | 2200+ | causal grade |
|---|---|---|---|---|---|---|---|---|
| Play rated games (longer TC) | all | 3 | 3 | 3 | 3 | 2 | 2 | B/1 |
| Blunder-check habit | board_vision | 3 | 3 | 2 | 1 | 1 | 1 | C (B desc) |
| Themed tactics (reflective) | tactics | 3 | 3 | 3 | 2 | 2 | 1 | C (B corr) |
| Spaced review of failed tactics | tactics | 2 | 3 | 3 | 2 | 2 | 1 | C chess / A gen |
| Analyse own games | all | 2 | 2 | 3 | 3 | 3 | 3 | C/1 |
| Calculation / visualisation | calculation | 1 | 1 | 2 | 3 | 3 | 3 | C/1 |
| Endgame study | endgames | 1 | 1 | 2 | 2 | 3 | 3 | C/1 |
| Master / annotated games | positional | 1 | 1 | 2 | 2 | 3 | 3 | C/1 |
| Coaching analogue (targeted feedback) | all | 2 | 2 | 2 | 3 | 3 | 3 | B/C/1 |
| Opening study | openings | **D** | 1 | 1 | 2 | 3 | 3 | C/1; **D if heavy memorisation <1600** |

**Config — `weaknessResourceRules: Rule[]`** (condition → external resource template + params):

| weakness signal | external resource template | params | grade |
|---|---|---|---|
| High blunder rate | Lichess puzzles, defensive/board-safety themes, **easy** track | success ~85% (Seam 5) + blunder-check habit prompt | C |
| Recurring missed motif `X` | Lichess puzzles `theme=X` | rating per Seam 5; into FSRS on fail | A (selection) / C (effect) |
| Low endgame conversion | endgame trainer / study, **band-specific scenario** | <1200 basic mates → 1200–1600 K+P, opposition, rule of square → 1600–2000 Lucena/Philidor, minor-piece → 2000+ complex/fortress | C/1 |
| Opening early-CPL leak | review **only the specific lines actually faced + failed** | cap depth by band (5–7 plies <1600) | A/1 (against over-prescription) |
| Time impulsivity | calculation-discipline sets + enforced blunder-check | track success ~50–60% | A diag / C train |
| Time hesitation | pattern-recognition speed drills (e.g. Puzzle Storm) | fast track | A diag / C train |
| Plateau (Seam 7) | change stimulus: harder sweet-spot puzzles + interleave + target recurring blunder types | — | B/C |

**Named external resources** the catalog may reference (books/trainers, not hosted): Silman's *Complete
Endgame Course*, de la Villa *100 Endgames You Must Know*, Smith & Tikkanen *Woodpecker* (as a
themed-set source, **scheduled spaced not massed**), Lichess puzzle DB by theme+rating, Lichess
studies/endgame trainers, master-game collections matched to the user's pawn structures.

**Pure function.**
`mapWeaknessToActivities(signals, band, constraints, config) → CandidateActivity[]` (each candidate
carries `dimensionsTargeted`, `evidenceGrade`, `rationaleKey`, and a concrete external `resourceRef`).

**STUB.** Exact per-band study-mix percentages (e.g. the folkloric 50/30/10/10) — coaching opinion,
**Grade C/D**, expose as tunable; the causal claim that any given resource raises rating (**C** — say so
in copy); resource-quality ratings for books.

---

### Seam 5 — Difficulty / calibration targets
*Feeds: how hard each item should be. Sources: `PRACTICE_DESIGN.md`, `SPACED_REPETITION.md`,
`TRAINING_PROGRAMMING.md`.*

**Decision — dual-track, servo-controlled.** Two tracks with different success targets; **success rate
is the control variable, Elo offset is the actuator.** A controller adjusts the puzzle-rating offset to
keep the *measured* rolling success rate (last ~50–100 attempts) on target. This dissolves the
cross-report offset conflict (§1.3): offsets are seeds, not constants.

**Config — `difficulty`**

| param | value | grade | flag |
|---|---|---|---|
| `patternTrack.successTarget` | **0.80** (band 0.75–0.85) | B/2 | `semi-evidenced` (85% is ML-derived, not chess) |
| `calculationTrack.successTarget` | **0.55** (band 0.50–0.60) | C/2 | `best-guess` (productive struggle) |
| `controller.window` | last 50–100 attempts | C | `best-guess` |
| `controller.actuator` | adjust offset to hit measured success | B | servo, not hardcoded |
| `patternTrack.offsetSeed[band]` | −100 (low) … −250 (high) | B/`contested` | seed only; reports disagree (incl. −50) |
| `calculationTrack.offsetSeed[band]` | 0 … +200 | B/`contested` | seed only |
| `dailyPuzzleDose` | 10–20 themed | C | `best-guess`; **no volume-chasing** (S7) |

**Per-band track split** (time spent pattern : calculation, from `PRACTICE_DESIGN.md`): <800 ≈ 90:10 →
1200–1600 ≈ 70:30 → 2000+ ≈ 40:60. (Grade C, `best-guess`.)

**Beginner motivational override.** For `<800` (and shaky `800–1200`) the success target is raised to
**~0.90** rather than 0.80 — a deliberate trade of optimal learning rate for **competence-need
satisfaction and churn prevention** in the fragile early phase (`MOTIVATION.md` §4; `EXPECTATIONS.md`
per-band). Flagged `best-guess`/Grade C: this is a motivation decision, not a learning-rate optimum.

**Interleaving vs blocking (adaptive, cognitive-load-gated)** — shared with Seam 6:

| band | structure | rule | grade |
|---|---|---|---|
| <800 | fully **blocked** + worked examples | build base schemas; testing effect reverses at high load | A/2 (Sweller 1988; van Gog & Sweller 2015) |
| 800–1200 | clustered blocks | introduce switching once motif recognisable | A/2 |
| 1200–1600 | limited interleaving | discriminate among known motifs | A/2 (Rohrer & Taylor 2010, +43%) |
| 1600+ | full interleaving (mixed tags) | simulate real games | A/2 |

**Motif-mastery gate:** block a *new* motif until ~80% accuracy, then interleave it. (Grade C,
`best-guess`.) **Worked-example cutoff:** show worked example / heavy hints before active testing for
`<800–1200` or any high-element-interactivity item (van Gog & Sweller 2015, Grade A/2 for the
moderation, B for the chess extrapolation).

**Pure functions.**
`targetPuzzleRating(userPuzzleRating, track, band, recentSuccessRate, config) → ratingTarget` (the
servo); `practiceStructure(band, motifMastery, config) → 'blocked'|'clustered'|'interleaved'`;
`useWorkedExample(band, itemComplexity, config) → boolean`.

**STUB.** The precise 85% value (ML/perceptual, not chess — Grade B/C); the calculation-track 50–60%
(`best-guess`); all offset seeds (`contested`; servo handles them); the motif-mastery and worked-example
cutoffs.

---

### Seam 6 — Spacing / scheduling algorithm + parameters
*Feeds: the scheduler + the "redo failed puzzles" flow. Source: `SPACED_REPETITION.md` (authoritative).*

**Decision.** **FSRS v6** for all spaced content (failed tactics, endgame/opening drills). Generic FSRS
math lives in the engine; this seam supplies the **parameters and the outcome→grade mapping**. SM-2/
Leitner ladder retained only as an explainable **fallback**.

**Config — `scheduling`**

| param | value | grade | flag |
|---|---|---|---|
| `scheduler` | `FSRS_v6` | A/2 (B–C chess) | Ye et al. 2022; OSR benchmark |
| `desiredRetention` | **0.90** | A/2 | 0.93–0.95 pre-event; `borrowed` from Anki |
| `weights` | FSRS-v6 default 21 weights | A/2 | until personalisation |
| `personalizeAfterReviews` | **1000** | A/2 | then per-user optimise |
| `fallbackIntervalsDays` | 1, 3, 7, 21, 45, 90 | C/2 | SM-2/Leitner fallback only |

**Outcome → FSRS grade mapping** (Lichess/external result → grade 1–4):

| outcome | grade | effect |
|---|---|---|
| Wrong move | 1 (Again) | lapse; reset stability; **trigger redo flow** |
| Correct but **slow** (> band-median solve time) | 2 (Hard) | limited stability growth |
| Correct, normal time | 3 (Good) | standard growth |
| Correct & **fast** (< band-median) | 4 (Easy) | large growth |

Solve-time thresholds are **relative to the Lichess band median** and are a **STUB** until the app has
its own timing data.

**Redo-failed-puzzles flow (3-phase)** — directly from `SPACED_REPETITION.md` §Q4 (Finn & Metcalfe 2010;
Smith & Kimball 2010; Grade A/2, C chess):

1. **On fail:** hide the solution; give a **scaffolded hint** (mark the key square / name the motif).
   Never reveal the engine line passively.
2. **Intra-session:** re-present at session end, **min 10–15 min delay, no hints** (avoids massed
   retest on working memory).
3. **Inter-session:** on intra-session success → load into FSRS as a **lapse (initial interval ~1 day)**;
   on fail → carry to next day.

**Feedback level (carries into the hint copy).** All feedback must target the **task or the process**
("you missed a deflection"; "you ignored the opponent's threat") and **never the self/identity**
("you're talented/smart") — self-level feedback is ineffective or harmful to resilience
(`MOTIVATION.md` §5; Wisniewski et al. 2020, 435 studies; **Grade A/2**). Errors should be tagged with
process labels (e.g. "premature exchange", "back-rank ignored") that also feed Seam 3's missed-motif
signal.

**Beginner accommodation (`<800–1200`):** worked examples first (Seam 5) and a permitted **micro-spacing**
loop (repeat ≥2× correct within the session) to survive fragile first encoding — flagged `best-guess`
and noted as a *deliberate, bounded* exception to "avoid massed," because beginners need initial
consolidation before spacing helps (Sweller; van Gog & Sweller 2015).

**Pure functions.**
`gradeFromOutcome(correct, solveTimeMs, bandMedianMs, config) → 1|2|3|4`;
`scheduleReview(item, grade, fsrsState, config) → { nextDue, newState }` (FSRS step; engine owns the
math, config owns the params).

**STUB.** Solve-time→grade thresholds; chess-specific FSRS weights (use defaults, personalise from
telemetry after 1000 reviews); whether 90% retention is right for *spatial* patterns (interval
compression plausible — unvalidated); the beginner micro-spacing exception.

---

### Seam 7 — Periodisation / prioritisation weights (the daily mix)
*Feeds: how the daily program is ordered + volume + plateaus. Source: `TRAINING_PROGRAMMING.md`.*

**Decision — redefine "periodisation."** In this product **"periodisation" = daily dynamic
re-prioritisation from current state** (exactly as `BUILD.md` §7 already frames "auto-periodization").
**Athletic load-cycling / deload / taper has no cognitive or chess evidence (Grade C–D)** and ships, if
at all, as an **optional, clearly-labelled, off-by-default** feature.

**Config — `prioritization`**

**(a) Daily-mix scoring weights** (tunable; each carries its basis). The daily program is an ordered set
maximising a weighted score over candidate activities:

| weight | basis | grade | flag |
|---|---|---|---|
| `weaknessSeverity` | Seam 3 signals × salience | A desc / C train | — |
| `activityROIPrior` | Seam 4 per-band ranking | B/C/1 | — |
| `dueReviews` | Seam 6 items past due get priority | A/2 | — |
| `varietyRecency` | interleaving / anti-monotony | A/2 (chess C) | — |
| `constraintFit` | fit time budget & owned resources | — | engine constraint |

**(b) Volume / frequency / session** — **direction is A, all specific numbers are `best-guess` C–D**
(the single biggest product gap is the absence of any chess dose-response curve):

| param | default | grade | flag |
|---|---|---|---|
| `daysPerWeek` | 5–7 (consistency > total hours) | B/2 | Cepeda 2006; Lally 2010 |
| `sessionMin` | 20–30 (<1600), 30–45 (≥1600), with breaks | C | `best-guess` (fatigue extrapolation) |
| `dailyPuzzleDose` | 10–20 | C | `best-guess` |
| `loadCycling` | **off** | C–D | `speculative`, optional, labelled |

**(c) Plateau handling** — now backed by population data (`EXPECTATIONS.md`). Context: **96% of active
players show no substantial lasting gain over 7 years** (Blanch 2023, N=72,022, Grade A) and gains slow
steeply with level (Lichess ETL: +100 pts ≈ 1–2 months at 800–1000 vs ≈ 3–4 years at 1600–2000). So a
"plateau" is the statistical norm, not a personal failing.

- **Detection (semi-evidenced default, replaces the old pure stub):** flag a plateau when the **upper
  bound of the user's Glicko-2 95% CI** has not exceeded its historical maximum over **~90 active days**
  (`EXPECTATIONS.md` best-guess default; depends on the Measurement section's CI math). Grade B.
- **Response:** **change the stimulus** (harder sweet-spot puzzles, interleave, target recurring blunder
  types) **not just more volume**. Personalise to the user's own trajectory; early gains are faster
  (Vaci & Bilalić 2014: year-1 ≈ 2× year-2).
- **Framing:** never tell a typical improver they've hit a genetic ceiling (cognitive ability ≈6% of
  variance, G6). Grade B for diminishing-returns math; C for the "OK-plateau" mechanism; **D for
  "genetic ceiling."**

**Process-goal framing (cross-cuts Seam 9 + Measurement).** The *visible* daily targets the program
sets must be controllable **process goals** ("solve 15 puzzles from your mistake log"), not outcome
goals ("reach 1800") — outcome goals add anxiety with negligible benefit (Williamson 2022, Grade A/2,
G9). The generator may use rating internally for difficulty, but the surfaced objective is process.

**Pure functions.**
`prioritizeDailyMix(skillState, dueItems, weaknessSignals, constraints, band, config) →
orderedProgramItem[]`;
`detectPlateau(glickoHistory, config) → { isPlateau, suggestedStimulusChange }` (uses the Measurement
CI rule).

**STUB.** Every session-length / weekly-volume number; the mix-weight magnitudes; load-cycling entirely;
the exact plateau window (90 days is a labelled best-guess, though the CI-crossing *rule* is evidenced).
**All flagged so the app's telemetry can generate the dose-response evidence the literature lacks (the
built-in study, VISION §7).**

---

### Seam 8 — Rationale & evidence copy (the "why this / why now")
*Feeds: the transparency UI text + evidence grade for every recommendation. Sources: `USER_FACING.md`
(the canonical Q9 user-facing rationale paper — now expanded into a full multi-seam synthesis that
carries a per-recommendation "why this?" block for each deep analysis) + the "why" lines across all
reports + `EXPECTATIONS.md` (Q8 expectations/measurement).*

**Decision.** A versioned copy table keyed by trigger. **Each entry carries its grade so the UI shows
it; any entry whose underlying grade is C/D must be softened in wording.** Copy is versioned *with* the
numbers it explains (change a number → review its copy).

**Config — `rationale: RationaleEntry[]`** (`{ key, whenShown, microcopy, grade, tier, citationKey, soften }`):

| key | when shown | microcopy (no hype) | grade |
|---|---|---|---|
| `puzzle_difficulty` | on a puzzle set | "You learn fastest at ~85% success — hard enough to think, easy enough to encode the pattern." | B/2 |
| `redo_failed` | on a redo item | "Re-solving misses, spaced over days, is the most science-backed way to make patterns stick — proven mostly on flashcards, not chess yet." | A gen / C chess |
| `analyse_own_games` | after a loss | "Reviewing your own losses finds *your* specific leaks — generic advice can't. (Coaching consensus; not formally proven.)" | C |
| `blunder_focus` | high blunder rate | "Below master level, games are won by whoever blunders second-to-last. Today targets board safety." | A desc / C train |
| `endgame_focus` | low conversion | "You reached winning endgames and didn't convert. A few key positions turn draws into wins." | C |
| `opening_suppressed` | <194 games/ECO | "We won't judge your opening on 14 games — that's noise. We're reviewing core ideas instead." | A/1 |
| `time_mgmt` | time leak | "Your clock is a piece. You lost on time, but the cause was a slow routine move on 14 — we'll train faster pattern recognition." | A/1 |
| `interleaving` | mixed set | "Mixed themes feel harder and that's the point — in a real game nobody tells you what to look for." | A gen / C chess |
| `weekly_volume` | program setup | "A little most days beats cramming — one of the most reliable findings in learning science. We keep sessions short so fatigue doesn't wreck accuracy." | A dir / C number |
| `expectations` | onboarding + dashboard | "We can't promise a rating. No activity is *proven* to cause rating gains, and how much people improve varies enormously. We personalise to *your* trajectory and show our evidence." | A/1 |
| `plateau` | plateau detected | "A plateau almost never means a ceiling — usually you're practising what you already know. We'll change the stimulus, not just add volume." | B/C |
| `no_periodisation` | if load-cycling offered | "Coaches borrow 'deload weeks' from the gym. Straight talk: there's no evidence it works for chess. We suggest lighter days only to prevent burnout." | C–D |
| `process_goal` | daily target shown | "Your goal today is what you can control — finishing these reps — not your rating. Research on athletes shows process goals beat outcome goals for both results and confidence." | A/2 |
| `rating_noise` | rating dips/spikes | "We're not flagging this 40-point swing — the math says it's noise. Your strength is a range, not a number; we'll only celebrate a gain once it clears that range for sure." | A/1 |
| `expectations_timeline` | progress / onboarding | "Climbing 100 points takes a month or two near 1000, but often 3–4 years around 1800 — that's normal, not you stalling. We measure you against your own past, never an average." | A/1 |
| `feedback_framing` | after a mistake | "We tell you what went wrong in the position — a missed deflection, a hung piece — not whether you're 'talented.' Process feedback is what actually builds skill." | A/2 |
| `if_then_plan` | onboarding / weekly | "Tell us exactly when and where you'll train ('after my morning coffee'). Tying practice to an existing habit roughly doubles the odds you actually do it." | A/2 |
| `woodpecker` | on a re-solve / fluency set | "We sometimes re-show puzzles you already solved. Masters don't recalculate — they recognise patterns as whole 'chunks'; cycling a small core set a few times moves the answer from slow calculation to fast recognition. (Builds fluency; not proven to raise rating.)" | B/1 |
| `streak_forgiveness` | after a missed day | "You didn't lose your progress for missing a day. A habit takes on the order of two months to automate and one skipped day barely dents that — punitive streak-resets mostly just make people quit. Consistency over weeks is what counts." | A/2 |

**Global honesty statements** (always-available copy block):
- The central caveat (§0.1), verbatim and prominent.
- The evidence-grade legend (A/B/C/D), shown to users (VISION §2).
- The built-in-study note: what outcome data is collected and why (VISION §7) — "training with weak but
  honest evidence beats training with none, but only when that's actually true."
- **Expectations & measurement (Q8 — see the Measurement section):** ratings are noisy (Glicko-2 CI);
  most short-term swings are statistical noise; **96% of players don't substantially improve over years**;
  treat ratings in **bands/percentiles**, not exact points; **online ≠ FIDE** and post-March-2024
  conversions are unreliable; show trajectory vs the user's own baseline with uncertainty, never claim
  causation.

**Pure function.** `rationaleFor(triggerKey, context, config) → RationaleEntry` (data lookup).

**STUB.** Online↔FIDE conversion (pools disparate — use percentiles); none of the copy may overclaim
where the underlying grade is C/D (enforced by the `soften` flag).

---

### Seam 9 — Engagement mechanics + ethical guardrails
*Feeds: which reward mechanics + the ethical limits. Source: `MOTIVATION.md` (dedicated Q7 report) +
VISION §3. **This seam is now well-sourced** — the earlier "thinnest evidence" caveat is retired;
several mechanisms are Grade A.*

**Decision.** Engagement = **evidence-based motivation design**, never dopamine engineering. The engine
owns event plumbing; this seam supplies the **allow/forbid lists, thresholds, and copy.** Four pillars,
each well-evidenced:

**(a) Process-goal architecture (the "cognitive firewall").** Make controllable **process** goals the
primary, mandatory focus; show **performance** goals as secondary; **hide/deprecate outcome** (ELO)
goals from the daily view. Process goals beat outcome goals on both performance and self-efficacy;
outcome fixation adds anxiety (Williamson et al. 2022, meta-analysis; **Grade A/2**). This is the
through-line that connects Seam 7 (what's surfaced), Seam 8 (copy), and the Measurement section (hide
rating noise).

| goal type | visibility | example |
|---|---|---|
| Process | **primary, mandatory** | "Finish 15 puzzles from your mistake log today" |
| Performance | secondary, evaluative | "Hold ~85% accuracy on today's set" |
| Outcome (ELO) | hidden / deprecated | "Reach 1800 rapid" — never shown as a daily target |

**(b) SDT bounded-choice architecture** (Deci, Koestner & Ryan 1999, 128-experiment meta-analysis;
**Grade A mechanism / C chess-adherence**). The app is an autonomy-supporting *guide*, not a taskmaster:

| SDT need | implementation | trigger / metric |
|---|---|---|
| Autonomy | bounded choice: offer **2–3** science-backed external paths/day; allow skipping **1 module/week** with no penalty | user picks the final route |
| Competence | translate external API outcomes into **skill growth** ("concepts mastered"), not ELO points; winnable difficulty (Seam 5) | competence feedback events |
| Relatedness | **anonymised** comparison to a peer group of similar available-time and ≤~200-ELO gap (optional) | opt-in only |
| Internal causality | ask the user *why* a chosen module matters to their game (internalises the goal) | onboarding / weekly |

**(c) Implementation intentions + forgiving habit design** (Gollwitzer & Sheeran 2006, d≈0.65,
**Grade A/2**; Lally 2010 habit, **Grade B/2**). Force explicit **"if-then" plans** anchoring training
to an existing daily cue at onboarding ("after my morning coffee, I open today's study"). Track
consistency **asymptotically over ~90 days**, not as an unbroken streak; a single missed day triggers a
constructive "recovery" prompt, **never** a red fail-state (a missed day doesn't derail habit formation).

**(d) Ethical guardrails — allowed vs forbidden** (overjustification effect + dark-pattern evidence;
**Grade A**):

| allowed | forbidden |
|---|---|
| **Capped/forgiving** streak (≤7-day cycle) + **consistency grid** (GitHub-style) | **Infinite** streaks weaponising loss-aversion (→ "quit moment" at the break; Silverman & Barasch 2023) |
| Badges **only** for genuine competence milestones ("100 spaced reviews") | Tangible/contingent rewards for already-interesting tasks (Deci 1999: undermines intrinsic motivation) |
| Self-comparison + same-level anonymised peers | **Global leaderboards** (downward social comparison → discouragement; Hanus & Fox 2015) |
| Gentle, capped, user-configurable reminders | Nagging / high-frequency notifications; fake urgency |
| Informational, process-level feedback (Seam 6) | Self/identity-level praise ("you're a genius") |

**Config — `engagement` params**

| param | default | grade | flag |
|---|---|---|---|
| `dailyChoiceCount` | 2–3 external paths | A/2 | autonomy |
| `freeSkipsPerWeek` | 1 (no penalty) | A/2 | autonomy |
| `streakCapDays` | 7 (then resets to a fresh cycle) | A/2 | anti-loss-aversion |
| `missDayGrace` | constructive recovery, not fail-state | A/2 | Lally 2010 |
| `consistencyWindowDays` | 90 (asymptotic tracking) | B/2 | habit |
| `habitExpectationDays` | median 66 (communicate 18–254 range) | B/2 | Lally 2010 |
| `peerComparison` | opt-in, ≤~200-ELO gap, anonymised | A/2 | relatedness |
| `globalLeaderboards` | **off (forbidden)** | A/2 | dark pattern |
| `reminderCadenceCap` | ≤1/day, user-configurable | C | anti-nag |
| `tiltCooldown` | suggest break after 3 consecutive losses + deteriorating ACPL | C–D | **stub** |

**Per-band notes.** `<1200`: competence need is acute; over-normalise failure with encouraging
*process* feedback; non-controlling visual rewards have temporary utility to bridge the frustrating
early phase. `1200–2000`: peer-benchmarking on weekly *effort* is a strong motivator, and redirecting
chronic rating-anxiety to process is therapeutic. `1600+`: players see through shallow gamification as
infantile — keep mechanics purely analytic/data-driven (an objective "consistency score"). `2000+`:
absolute autonomy; the app is a logistics shell around their existing tools.

**Pure functions.**
`engagementEventsFor(stateChange, config) → RewardEvent[]` (the *which/when/copy*; engine fires them);
`buildImplementationIntention(userCue, module) → IfThenPlan` (data assembly).

**STUB.** The `tiltCooldown` (thin chess evidence — forgiving default only); exact streak-cap and
consistency-window numbers (mechanism is A, the *numbers* are best-guess); and the **effectiveness of
these mechanics for sustained *chess* adherence specifically** (no chess-specific study — strong
general/sport evidence, extrapolated) — tune from telemetry and say so.

---

### Measurement & expectations (cross-cutting — feeds Seams 7–9)
*Feeds: progress measurement, expectation copy, plateau detection. Source: `EXPECTATIONS.md` (Q8).
This was a one-line stub in the first draft; the new report gives it a real, mostly-Grade-A basis.*

**Decision.** Measure progress as a **signal-vs-noise** problem on the Glicko-2 distribution, project
**non-linear** expectations from population data, and **never convert online→FIDE precisely**. This is
the data layer behind the process-goal "cognitive firewall" (Seam 9) and the expectations copy (Seam 8).

**(a) Rating noise — Glicko-2 (Grade A/1, Glickman 2012).** A rating is a distribution, not a number.

| concept | rule |
|---|---|
| 95% confidence interval | `CI = R ± 1.96·RD` (often simplified to `R ± 2·RD`) |
| **Significant progress** | declare a real gain **only** when the **new CI lower bound > old CI upper bound**; otherwise it's noise |
| Noise examples | a 40–100 pt swing with overlapping CIs = statistically *no change* — do not celebrate or alarm |
| Baseline data-quality gate | use a rating as a baseline only when **RD is below threshold** (enough recent games); ignore high-RD (volatile) ratings |

**(b) Realistic expectations (Grade A/1).** 96% of active players show no substantial lasting gain over
7 years (Blanch 2023, N=72,022). When players *do* improve, the rate is steeply non-linear (Lichess ETL,
2.3M players). Reference frame (`best-guess` timeline from population data — adult, ~10–20 h/week):

| band | ~time per +100 pts | trajectory |
|---|---|---|
| <800 | 4–8 weeks | rules + blunder reduction (steep) |
| 800–1200 | 12–24 weeks | pattern recognition + basic tactics (logarithmic) |
| 1200–1600 | 50–100 weeks | "valley of despair"; plateau risk |
| 1600–2000 | 150–200 weeks | subtle weaknesses, calculation (heavy resistance) |
| 2000+ | exceptional / very slow | evaluation + theory (asymptote) |

Always compare a user to **their own baseline**, never to these population averages (cognitive ability ×
practice interact non-linearly — Vaci et al. 2019; G6).

**(c) Online ↔ FIDE (Grade A fact / C conversion).** FIDE's **March-2024 reform** (floor raised to 1400;
one-time bump for sub-2000 via Sonas's formula; 400-point rule reinstated) **invalidated all pre-2024
conversion tables.** Therefore: do **not** offer precise conversions; **never show an OTB equivalent
below ~1200 online** (no OTB data exists there); if shown at all, label as rough and post-2024 only
(e.g. 1600–2000 band ≈ online − ~150; treat as `stub`).

**Config — `measurement`**

| param | default | grade | flag |
|---|---|---|---|
| `ciMultiplier` | 1.96 (≈2) | A/1 | Glicko-2 |
| `significanceRule` | new CI lower > old CI upper | A/1 | celebrate only on this |
| `rdBaselineMax` | threshold for "stable enough" baseline | A/1 | `best-guess` value |
| `plateauWindowDays` | 90 (CI upper not exceeding historical max) | B/1 | feeds Seam 7 |
| `expectationTable` | per-band weeks-per-100 (above) | A (observational) | `best-guess` numbers |
| `fideConversion` | **none below ~1200; rough/labelled above** | A fact / C | `stub` (2024 reform) |

**Pure functions.**
`isProgressReal(glickoHistory, config) → boolean` (the CI-crossing rule, shared with `detectPlateau`);
`isStableBaseline(rd, config) → boolean`;
`expectationForBand(band, config) → { weeksPer100, trajectoryLabel }`.

**STUB.** The exact `rdBaselineMax` and `plateauWindowDays`; every number in the expectation table
(observational population averages, not guarantees); all FIDE conversion (2024 reform — pools disparate).

---

## 3. The `MethodologyConfig` object & pure-function index

**Top-level shape** (one versioned object; science enters here only):

```
MethodologyConfig = {
  version: string,                 // semver; bump on any value/copy change
  bands: BandDefinition[],         // §0.4
  dimensions: SkillDimension[],            // Seam 1
  assessment: AssessmentConfig,            // Seam 2
  interpretation: InterpretationConfig,    // Seam 3
  activities: ActivityDefinition[],        // Seam 4
  weaknessResourceRules: Rule[],           // Seam 4
  difficulty: DifficultyConfig,            // Seam 5
  scheduling: SchedulingConfig,            // Seam 6
  prioritization: PrioritizationConfig,    // Seam 7
  rationale: RationaleEntry[],             // Seam 8
  engagement: EngagementConfig,            // Seam 9
  measurement: MeasurementConfig,          // Measurement & expectations (Glicko-2 CI, expectation table, FIDE rule)
  evidenceLedger: AnchorSource[]           // §10
}
```

Every leaf number is a `GradedValue` (§0.3), so evidence is never stripped.

**The few pure functions** the engine calls into (all deterministic, all unit-testable with golden
tests — `BUILD.md` §13):

| function | seam | in → out |
|---|---|---|
| `dimensionsForBand` | 1 | band → ordered dimensions |
| `nextCalibrationItem` / `scoreCalibration` | 2 | responses → tactical estimate + uncertainty |
| `interpretGameFeatures` | 3 | raw features + band → graded weakness signals |
| `confidenceFromSampleSize` | 3 | n + signal type → confidence (incl. `insufficient`) |
| `mapWeaknessToActivities` | 4 | signals + band + constraints → candidate activities |
| `targetPuzzleRating` | 5 | user rating + track + recent success → rating target (servo) |
| `practiceStructure` / `useWorkedExample` | 5 | band + mastery → blocked/clustered/interleaved |
| `gradeFromOutcome` / `scheduleReview` | 6 | outcome → FSRS grade → next due + state |
| `prioritizeDailyMix` | 7 | state + due + signals + constraints → ordered program |
| `detectPlateau` | 7 | Glicko-2 history → plateau + stimulus change (uses `isProgressReal`) |
| `rationaleFor` | 8 | trigger + context → rationale entry |
| `engagementEventsFor` / `buildImplementationIntention` | 9 | state change → reward events; user cue → if-then plan |
| `isProgressReal` / `isStableBaseline` / `expectationForBand` | Measurement | Glicko-2 history → significant-gain bool; RD → baseline bool; band → expectation |

Swapping any value, rule, or copy string is a `MethodologyConfig` edit + a version bump — **no
architecture change**, by construction.

---

## 4. Open questions / thin evidence / deliberately stubbed

Everything here ships as a **clearly-labelled best-guess**, defaults conservatively, and is a candidate
for resolution by the app's own outcome telemetry (the built-in study, VISION §7). The app is uniquely
positioned to generate the dose-response and plateau evidence the literature lacks.

| # | Gap / stub | Why thin | Conservative default shipped | How telemetry resolves it |
|---|---|---|---|---|
| 1 | **No activity proven to cause rating gain** | All Tier-1 evidence observational | Copy never promises rating; grades visible | Longitudinal per-user outcome tracking |
| 2 | **No chess dose-response curve** (puzzles/day, hrs/week → rating by band) | Literature's single biggest gap | Volume/session numbers all `best-guess` (Seam 7) | Correlate logged volume vs rating change by band |
| 3 | **FSRS/spacing/interleaving/85% not chess-validated** | Proven on verbal/perceptual, not chess patterns | Use defaults (90% retention, 1000-review personalise) | Per-user FSRS optimisation; success-rate servo |
| 4 | **ACPL baselines disagree between reports** | Two reports, different numbers | Mark `contested`; blunder rate is primary; never headline ACPL | Recompute baselines from app's own game corpus |
| 5 | **Regan IPR / VOC need heavy server eval** | Depth-18+ / multi-depth; client-side engine only | Proxy: blunder rate + STDCPL; time-vs-eval-swing | Optional batch analysis if infra allows |
| 6 | **Semantic strategic weakness can't be auto-diagnosed** | No reliable method; AI hallucinates | Diagnose only what features support; emit `insufficient-data` | Human-reviewed labels (out of Phase 1 scope) |
| 7 | **Periodisation (deload/taper/load-cycling)** | No cognitive/chess evidence | `off` by default; labelled `speculative` C–D | A/B test light-load weeks for high-volume users |
| 8 | **Engagement mechanics unvalidated *for chess* specifically** (the seam now has a dedicated report, `MOTIVATION.md`; the gap is narrower) | Strong general/sport evidence (SDT, goals, habits, dark patterns), extrapolated to chess | Lean on Grade-A mechanisms; forbid dark patterns; streak-cap/window numbers `best-guess` | A/B test forgiving streak, reminder cadence, peer comparison |
| 9 | **Solve-time → FSRS grade thresholds** | No chess timing norms | Relative to Lichess band median | Recompute from app's own solve-time distribution |
| 10 | **Tilt / cooling-off** | Thin chess literature | Forgiving 3-loss + ACPL cooldown suggestion | Correlate breaks vs subsequent ACPL recovery |
| 11 | **Online ↔ FIDE conversion** | Pools disparate; **FIDE March-2024 reform voided pre-2024 tables** | No precise conversion; none below ~1200; percentiles/bands instead | In-pool percentile tracking; rebuild only on post-2024 linked-account data |
| 12 | **Beginner micro-spacing vs "avoid massed"** | Bounded exception, not directly tested | Allow ≥2× in-session for <1200 only, labelled | Compare retention of micro-spaced vs spaced beginners |
| 13 | **Process-goal framing unproven in chess** | Strong sport-psych meta-analysis (Williamson 2022), extrapolated | Surface process goals, hide ELO ("cognitive firewall") | A/B test process- vs outcome-goal cohorts on retention |
| 14 | **Plateau-detection window (90 days)** | The CI-crossing *rule* is evidenced (Glicko-2); the window is not | 90 active days as labelled `best-guess` | Tune window against observed real (CI-clearing) gains |
| 15 | **Worked-example & motif-mastery cutoffs (~80%)** | Theory-based (CLT), not chess-tuned | Ship the thresholds as `best-guess` | Tune cutoff against measured transfer |

**Two honesty notes for the build:**
1. Where a value is `stub`/`best-guess`, the transparency UI (Seam 8) should be able to *say so* — a
   stubbed number must never render as if it were Grade A.
2. The "myths to avoid" from the reports are **negative config**: the app must not implement heavy
   beginner opening memorisation (D), puzzle-volume chasing (D), far-transfer/IQ marketing (D), 10,000-
   hour promises (D), "always solve the hardest puzzles" (D), passive solution-reveal (D), or athletic
   periodisation as fact (D).

---

## 5. Anchor sources (evidence ledger)

Compact map of the highest-weight sources behind the numbers above. Full references and links are in the
corresponding `research/` reports; this table is the `evidenceLedger` the UI cites.

| key | source | what it anchors | grade |
|---|---|---|---|
| `wilson2019` | Wilson et al. 2019, *Nat. Commun.* 10:4646 | 85% / 15.87%-error optimal difficulty | B (ML, extrapolated) |
| `ye2022` | Ye, Su & Cao 2022, ACM SIGKDD (FSRS) | FSRS scheduler, DSR model | A (general) |
| `osr_benchmark` | open-spaced-repetition benchmark | FSRS beats SM-2 (99.6%); 20–30% fewer reviews | A (general) |
| `cepeda2006` | Cepeda et al. 2006, *Psych. Bull.* 132:354 | spacing > massing (839 assessments) | A (general) |
| `roediger2006` / `adesope2017` | Roediger & Karpicke 2006; Adesope et al. 2017 | retrieval/testing effect (g≈0.51) | A (general) |
| `finn2010` | Finn & Metcalfe 2010, *Mem. & Cogn.* | scaffolded feedback → redo flow | A (general) |
| `vangog2015` | van Gog & Sweller 2015 | testing effect reverses at high element-interactivity | A (general) |
| `rohrer2010` | Rohrer & Taylor 2010 | interleaving +43% long-term | A (general) |
| `sweller1988` | Sweller 1988 (CLT) | beginners need blocked/worked examples | A (general) |
| `macnamara2014` | Macnamara, Hambrick & Oswald 2014 | DP = 26% variance (games) | A |
| `hambrick2014` | Hambrick et al. 2014 | ~34% chess (corrected) | A |
| `gobet_campitelli2007` | Gobet & Campitelli 2007 | hours-to-master 3,016–23,608; starting age | A (chess) |
| `burgoyne2016` | Burgoyne et al. 2016 (+2018 corrigendum) | cognitive ability r≈0.22–0.24 | B (chess) |
| `howard2012` | Howard 2012, *Appl. Cogn. Psychol.* 26:359 | log(games) strongest rating predictor | B (chess) |
| `vaci2014` | Vaci & Bilalić 2014 | diminishing returns (yr1 ≈ 2× yr2) | B (chess) |
| `chase_simon1973` | Chase & Simon 1973 | chunking / pattern recognition core | A (mechanism) |
| `vandermaas2005` | Van der Maas & Wagenmakers 2005 | tactical/positional factor correlation | A (chess) |
| `kuperwajs2025` | Kuperwajs et al. 2025 (>12M games) | time management = resource-rational (VOC) | A (chess) |
| `coulombe2017` | Coulombe 2017 | ACPL explains only 5–7% of rating variance | A (chess data) |
| `regan2011` | Regan & Haworth 2011 | IPR Consistency/Sensitivity (stubbed) | A (chess) |
| `heck2025` | Heck, Benjamin, Simons & Chabris 2025 | Dunning-Kruger in chess → reject self-report | A (chess) |
| `chessanalysis_co` | chessanalysis.co (2,763 players) | puzzle↔rapid R=0.815; volume r=−0.02 | B (blog data) |
| `smith_tikkanen2018` | Smith & Tikkanen 2018 (Woodpecker) + DiscoChess (N=1,017) | tactics dominate decisive games; intra-task fluency | B/C |
| `lally2010` | Lally et al. 2010, *EJSP* 40:998 | habit median 66 d (18–254) | B (general) |
| `deci1999` | Deci, Koestner & Ryan 1999 (128 exp.) | extrinsic rewards undermine intrinsic motivation | B (general) |
| `bjork2011` | Bjork & Bjork 2011 | desirable difficulties; plateau-breaking | A (general) |
| `sala_gobet2016` | Sala & Gobet 2016 | far transfer weak/confounded (don't market) | A (design critique) |
| `williamson2022` | Williamson et al. 2022 (27-study meta-analysis) | process goals > outcome goals (perf. + self-efficacy) | A (sport, extrapolated) |
| `gollwitzer2006` | Gollwitzer & Sheeran 2006 | implementation intentions raise follow-through (d≈0.65) | A (general) |
| `wisniewski2020` | Wisniewski et al. 2020 (435 studies) | feedback must target task/process, not self | A (general) |
| `hanus_fox2015` | Hanus & Fox 2015 (longitudinal) | competitive gamification / leaderboards backfire | A (education) |
| `silverman_barasch2023` | Silverman & Barasch 2023 | broken infinite streaks → quit moment | B (consumer behaviour) |
| `blanch2023` | Blanch 2023, *OSF Preprints* (N=72,022, 7 yrs) | 96% show no substantial lasting gain | A (chess data) |
| `lichess_etl` | Lichess ETL / jcw024 (2.3M players, 450M games) | diminishing-returns timeline by band | A (observational, chess) |
| `glickman2012` | Glickman 2012 (Glicko-2 example) | rating noise / 95% CI math | A (ratings math) |
| `vaci2019` | Vaci et al. 2019, *PNAS* (longitudinal, N=90) | intelligence × practice non-linear; numeric ability strongest | A (chess) |

---

*This document is the authoritative methodology translation. When research updates land, edit the
relevant seam and the `MethodologyConfig` values here and bump the version — the architecture does not
move. Keep the central caveat (§0.1), the grade-on-every-value rule (§0.3), and the stub labelling (§4)
intact: they are the product, not the packaging.*
