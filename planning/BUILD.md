# BUILD.md — the Phase 1 technical blueprint

> **Purpose of this document.** This is the **definitive 0→1 technical plan** for Phase 1
> (_Building_). It is written to be executed **literally by AI coding agents** with minimal ambiguity:
> precision and completeness are valued over brevity. It defines the **architecture, stack, data
> model, integrations, the generic Engine, the MethodologyConfig schema + loader, the build order, and
> the verification strategy.** It contains **specification notation** (typed contracts, schema
> sketches, function signatures) but **no application code** — the code is produced by the build, slice
> by slice, against the contracts defined here.
>
> **Read order.** `planning/VISION.md` (what / why — authoritative product intent) → **this file**
> (`planning/BUILD.md` — _how_: the Engine and the seam interfaces) → `planning/METHODOLOGY.md` (the
> science that fills the seams — values, grades, citations, copy) → `research/` (the evidence base
> behind every number).
>
> **The load-bearing rule (VISION §4):** **science enters the system in exactly one place.** This
> document defines the **Engine** (generic, deterministic, science-free) and the **`MethodologyConfig`
> schema + loader**. The seam **contents** (every number, grade, citation, and copy string) live in
> `planning/METHODOLOGY.md` and are **referenced here by seam ID, never duplicated.** No chess or
> learning-science constant is ever hardcoded in the Engine.
>
> **Language:** English (document + code). UI copy may be localised later.

---

## 0. Orientation — the three architectural laws, the glossary, the discipline

### 0.1 The three architectural laws (the spine of the build)

Every section below serves these three laws. They are non-negotiable and are **enforced by CI** (§13).

| #                                           | Law                                                                                                                                                                                                                                                                                                       | What it means in code                                                                                                                                      | Enforced by                                   |
| ------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------- |
| **L1 — Science lives only in config**       | The Engine contains **no chess knowledge and no learning-science constant.** Every threshold, weight, target, interval, band cutoff, and copy string comes from `MethodologyConfig`.                                                                                                                      | `engine/` and `analysis/` import from `methodology/` _types and functions_ only; they never contain a magic number that encodes a chess/learning decision. | Architecture-guard test (§13.4) + code review |
| **L2 — Decisions are pure & deterministic** | The generator, the adaptation loop, and every methodology function are **pure**: same `(inputs, methodologyVersion)` → same output. Wall-clock time and randomness are **injected as inputs**, never read inside.                                                                                         | No `Date.now()`, `Math.random()`, I/O, or DB access inside engine/methodology decision functions.                                                          | Golden tests (§13.1) + lint rule              |
| **L3 — Evidence never gets stripped**       | Every methodology leaf value is a `GradedValue` (carrying grade, tier, citation, optional `stub`/`best-guess` flag). The grade + rationale **travel with the artifact** (snapshotted onto each `ProgramItem`) so the transparency UI can always show "why this / why now" and how strong the evidence is. | The config Zod schema rejects any bare leaf number; `ProgramItem` denormalises the graded rationale at generation time.                                    | Config schema validation test (§13.4)         |

These laws are _why_ the project can move before the research is final and absorb the research later
without a rewrite (VISION §4). They are also the brand (VISION §2): the honesty is structural, not copy.

### 0.2 Glossary (disambiguation an agent needs)

- **Engine** (capital-E) — the **generic machinery** built now (`src/engine/` and friends). It is the
  "Engine" of VISION §4. It has **no chess knowledge.**
- **Chess engine / analysis engine** — **Stockfish (WASM)**, wrapped behind `AnalysisEngineAdapter`.
  Always called "the chess engine" or "Stockfish" to avoid colliding with the Engine above.
- **Methodology / `MethodologyConfig`** — the science as **versioned config data + pure reader
  functions**. The single place science enters.
- **Seam** — a well-defined slot the methodology fills (Seams 1–9 + Measurement). Defined as an
  interface here; filled with content in `METHODOLOGY.md`. The index is §11.
- **Band** — a fuzzy rating band (`<800 · 800–1200 · 1200–1600 · 1600–2000 · 2000–2200 · 2200+`).
  Bands are **data** (`MethodologyConfig.bands`); never hardcoded. The user's own data overrides band
  priors.
- **`GradedValue<T>`** — the evidence-carrying wrapper around every methodology value (§2.5, L3).
- **Raw feature** — a measurement emitted by `analysis/` with **no interpretation** (no "good/bad").
  Interpretation is Seam 3.

### 0.3 Cross-reference discipline

This document **never restates a methodology number.** When a mechanism needs a value (a blunder
threshold, a success-rate target, an FSRS retention, a copy string), it names the **seam** and the
**`MethodologyConfig` field**, and points to the `METHODOLOGY.md` anchor. If a number appears in this
doc, it is an **infrastructure** number (a free-tier limit, a timeout, a cache TTL), never a science
number. This is L1 expressed at the documentation level.

---

## 1. Product (technical framing)

The app is an **orchestration layer**. From a user's **constraints** (time/day, days/week, goals,
owned resources, preferences), their **connected-account data** (Lichess + Chess.com games and
ratings), and a short **behavioural assessment**, it deterministically **generates a daily training
session** that mixes **in-app activities** — puzzles, personalised blunder drills, interactive game
review, endgame drills, all rendered on a client-side board and judged by the client-side chess engine,
from **open data** — with **references to external resources** for what can't or shouldn't be
internalised (playing real games, books, courses). It **logs every outcome** — in-app activities are
**auto-tracked**, external ones are logged — in an append-only tracker, and **adapts** the next session
via deterministic algorithms parameterised by the methodology. It **hosts no copyrighted content, runs
no competing game-play platform, and uses no LLM/AI at runtime.** Every recommendation carries a **"why this / why now"** rationale and an
**evidence grade** (the framework is built now; the content is the methodology). It is **multi-user and
billing-capable from day one** (no billing built), runs on **free infrastructure**, is **web-first**
(responsive PWA), and makes **no hardcoded assumptions about rating** — a beginner and an expert both
get a coherent program because level lives in data.

---

## 2. Core architecture — the Engine ⟷ Methodology split

### 2.1 The split

The system is two cleanly separated halves connected by a typed boundary:

- **The Engine (built now, generic, science-free).** Deterministic machinery that knows _how_ to run
  the loop but nothing about chess or learning. It orchestrates; it decides nothing graded.
- **The Methodology (research fills later).** All chess/learning knowledge, expressed as a
  **versioned `MethodologyConfig`** (data, every leaf a `GradedValue`) **+ a small set of pure reader
  functions** that turn config + inputs into graded decisions. It ships as versioned stub and
   research configs so the whole loop remains reproducible. The active pointer selects the research
   release by default, while the stub remains available for historic artifacts and rollback. A new
   research release is one file plus a version bump, with **no architecture change** (VISION §4).

```
        ┌──────────────────────────── ENGINE (src/engine, analysis, integrations, server, app) ───────────────────────────┐
        │  accounts · imports · profile · raw analysis · GENERATOR · daily-session builder · tracker · adaptation loop ·   │
        │  schedule/skill state · transparency UI framework · engagement event bus · beta/ops                              │
        │     (no chess knowledge — calls the Methodology for every graded decision; L1)                                   │
        └──────────────────────────────────────────────┬──────────────────────────────────────────────────────────────────┘
                                                        │  typed boundary: MethodologyProvider (the ~18 pure fns) + MethodologyConfig
        ┌───────────────────────────────────────────────▼─────────────────────────────────────────────────────────────────┐
        │  METHODOLOGY (src/methodology):  MethodologyConfig (JSON, GradedValue leaves)  +  pure reader functions            │
        │  Seams 1–9 + Measurement.  Content lives in planning/METHODOLOGY.md; encoded here as validated config + fns.       │
        └──────────────────────────────────────────────────────────────────────────────────────────────────────────────────┘
```

### 2.2 The Engine — modules and the rule

The Engine comprises (each maps to a directory in §4 and a milestone in §10):

1. **Identity & accounts** — Auth.js sessions, users, multi-provider login.
2. **Platform integrations** — `PlatformAdapter` implementations (Lichess, Chess.com), behind one
   interface so platforms can be added/swapped.
3. **Profile & constraints** — `ConstraintSet`, owned resources, goals, if-then plan.
4. **Analysis** — `AnalysisEngineAdapter` (Stockfish WASM) → **raw features only** (L1: no
   interpretation here).
5. **Program generator + daily-session builder** — pure, deterministic; produces the ordered daily
   session by calling methodology functions and packing to the time budget (§7).
6. **Tracker** — append-only `ActivityEvent` log.
7. **Adaptation loop** — recompute `SkillState` + `ScheduleState`, re-prioritise, regenerate next
   session; "redo failed puzzles" scheduling (§7).
8. **State** — `SkillState` (per-dimension estimate + uncertainty), `ScheduleState` (FSRS/spacing).
9. **Transparency UI framework** — surfaces the graded rationale snapshotted on each `ProgramItem` and
   the `AdaptationLog`.
10. **Engagement event bus** — emits `RewardEvent`s and (capped) notifications from state changes (§9).
11. **Beta & ops** — allowlist, rate limiting, error tracking, analytics, PWA.
12. **Interactive activity surfaces** — the in-app board, the pure solve-session state machine, and the
    engine-play opponent (M10–M14). All **generic and science-free**: chess _rules_ (`chess.js`) and the
    client-side chess engine are mechanical, not chess _knowledge_ — they render, validate, and time the
    activities the methodology selects, and never judge chess merit themselves.

**The rule (L1):** none of the above contains a chess/learning constant. Where a decision is graded,
the module calls a **MethodologyProvider** function (§2.8). Generic _math_ that is not a chess decision
(FSRS stepping, Glicko-2 CI arithmetic, time-budget packing) lives in the Engine as pure utilities and
is **parameterised by config values** passed in — the Engine supplies the algorithm, the config
supplies every number.

### 2.3 The Methodology layer

`src/methodology/` exports exactly two things to the Engine:

1. **`MethodologyConfig`** — one versioned, immutable, fully-validated object (§2.5), loaded at boot
   (§2.6). Every leaf number/string is a `GradedValue` (§2.5, L3).
2. **The MethodologyProvider functions** — the ~18 pure reader functions (§2.8) that take
   `(domainInputs, config)` and return graded decisions. They contain **no numbers of their own**;
   they read config. Some call Engine math utilities with config parameters (e.g. `scheduleReview`
   calls the generic `fsrsStep` with `config.scheduling.weights`).

Nothing else crosses the boundary. The Engine never reads a raw config field to make a decision; it
calls a function. This keeps the swap surface tiny and the seams stable.

### 2.4 The three laws, operationalised

- **L1 (science in config):** enforced by an **architecture-guard test** (§13.4) that fails the build
  if `engine/`, `analysis/`, `server/`, or `app/` contain forbidden numeric literals in decision
  paths or import methodology _internals_ instead of the typed surface.
- **L2 (pure & deterministic):** the generator, adaptation, and all methodology functions take an
  injected **`Clock`** (`{ now(): EpochMs }`) and, where needed, an injected **seed**; a lint rule
  bans `Date.now()`/`Math.random()` in those modules. Golden tests pin outputs.
- **L3 (graded evidence):** the config Zod schema (§2.5) rejects bare leaves; `ProgramItem` stores a
  **denormalised snapshot** of `{ rationaleText, evidenceGrade, evidenceTier, citationKey, confidence,
soften }` at generation time so a later config bump never silently rewrites history.

### 2.5 The `MethodologyConfig` schema + the `GradedValue` wrapper

**`GradedValue<T>`** (from `METHODOLOGY.md` §0.3 — the wrapper that makes L3 structural):

```ts
// Contract (specification, not implementation). Lives in src/methodology/schema.
type Grade = "A" | "B" | "C" | "D"; // A strong … D myth-to-avoid (METHODOLOGY §0.2)
type Tier = 1 | 2; // 1 chess-specific · 2 general learning-science
type GradedFlag = "best-guess" | "semi-evidenced" | "contested" | "stub";

interface GradedValue<T> {
  value: T;
  grade: Grade;
  tier: Tier;
  citationKey: string; // → evidenceLedger anchor (METHODOLOGY §5)
  flag?: GradedFlag; // stub/best-guess values must never render as Grade-A fact
  note?: string; // e.g. "servo target, not a hardcoded constant"
}
```

**Top-level shape** — reproduced from `METHODOLOGY.md` §3 (that document is the **source of the
contents**; this is the **structural contract** the loader validates against):

```ts
// Contract (specification). The ONE object through which science enters the system (VISION §4).
interface MethodologyConfig {
  version: string; // semver; bump on ANY value/copy change
  bands: BandDefinition[]; // §0.4 — rating bands as DATA
  dimensions: SkillDimension[]; // Seam 1
  assessment: AssessmentConfig; // Seam 2
  interpretation: InterpretationConfig; // Seam 3
  activities: ActivityDefinition[]; // Seam 4
  weaknessResourceRules: Rule[]; // Seam 4
  difficulty: DifficultyConfig; // Seam 5
  scheduling: SchedulingConfig; // Seam 6
  prioritization: PrioritizationConfig; // Seam 7
  rationale: RationaleEntry[]; // Seam 8
  engagement: EngagementConfig; // Seam 9
  measurement: MeasurementConfig; // Measurement & expectations (Glicko-2 CI, expectations, FIDE rule)
  evidenceLedger: AnchorSource[]; // METHODOLOGY §5 — citation map the UI shows
  // Implemented Seam-4 extensions for the structured game-analysis and internal-first
  // surfaces. These remain methodology data, not new Engine seams.
  gameAnalysis: GameAnalysisConfig;
  board: BoardConfig;
  endgameCurriculum: EndgameCurriculumConfig;
  bookStudy: BookStudyConfig;
  modality: ModalityConfig;
}
```

Every numeric/string **leaf** inside these sub-objects is a `GradedValue<…>` (L3). The per-seam field
shapes (e.g. `DifficultyConfig`, `SchedulingConfig`) are defined seam-by-seam in `METHODOLOGY.md` §2
and §3 and are encoded as Zod schemas under `src/methodology/schema/`. **This document does not
restate those fields' values** (§0.3); it guarantees the _container_ exists and is validated.

### 2.6 The loader

```ts
// Contract (specification). src/methodology/loader.ts
// Configs ship as immutable repo JSON: src/methodology/configs/<version>.json.
// Additive compatibility data for a historic version may live in <version>.compat.json.
function loadMethodology(version?: string): MethodologyConfig;
//  1. resolve version: explicit arg > env METHODOLOGY_VERSION > "active" pointer (default: research-1.0.0)
//  2. read the JSON file for that version
//  3. add any version-matched compatibility data without replacing historic fields
//  4. validate with the Zod schema (structure + EVERY leaf is a GradedValue); throw on any violation
//  5. deep-freeze and return a typed, immutable MethodologyConfig
```

Loader rules:

- **Immutable & cached at boot.** Loaded once per process; never mutated. Determinism (L2) depends on
  this.
- **Fail-closed.** An invalid config (missing leaf, bare number, unknown citationKey, bad semver) is a
  **boot error**, not a silent fallback. A stub value is allowed (flagged `stub`); an _ungraded_ value
  is not.
- **Versioned & reproducible.** `Program`, `AdaptationLog`, and `Assessment` persist the
  `methodologyVersion` they were produced under. Any past decision can be re-derived.
- **Historic files stay byte-stable.** When a typed seam is extracted from old provider behavior,
  an additive compatibility JSON carries those graded values. The released config file is not edited.
- **Active-version selection.** Environment chooses the active config: `research-1.0.0` by default,
  with `stub-0.1.0` retained for rollback. Swapping is a one-line env/pointer change plus the new
  JSON file.

### 2.7 Stub config vs research config

|                    | **Stub config (historic/rollback)**                                     | **Research config (active)**                                          |
| ------------------ | ----------------------------------------------------------------------- | --------------------------------------------------------------------- |
| File               | `configs/stub-<semver>.json`                                            | `configs/research-<semver>.json`                                      |
| Source of contents | Safe, conservative placeholders; everything flagged `stub`/`best-guess` | `planning/METHODOLOGY.md` (its values/grades/citations/copy, encoded) |
| Purpose            | Preserve historic behavior and provide an intentional rollback baseline | Run the approved, graded methodology release                          |
| Swap cost          | n/a                                                                      | **One file + one version bump.** No engine change (VISION §4).        |

The 2026-07-10 release status is: `research-1.0.0` is active by default and `stub-0.1.0` remains
loadable for historic programs. The research release retains explicit best guesses and deliberate
stubs from `METHODOLOGY.md`; see `planning/METHODOLOGY_CHANGELOG.md` for the release inventory.

The stub remains _coherent_, not empty: real band cutoffs, a dimension list, defensible default
targets, and honest copy, all flagged so the transparency UI can say "placeholder." It originally
proved the seams were wired correctly before the research release became active.

### 2.8 The MethodologyProvider — the pure-function boundary

The Engine calls **only** these functions (the typed surface of `src/methodology/`). They mirror
`METHODOLOGY.md` §3's function index. Each is **pure** (L2) and **golden-tested** (§13.1). Column 3
names any **generic Engine math utility** the function may call with config params (the Engine owns the
algorithm; the config owns the numbers).

| Function                                                                                                | Seam        | May call (generic Engine util) |
| ------------------------------------------------------------------------------------------------------- | ----------- | ------------------------------ |
| `dimensionsForBand(band, cfg)`                                                                          | 1           | — (data lookup)                |
| `nextCalibrationItem(history, cfg)` · `scoreCalibration(responses, cfg)`                                | 2           | —                              |
| `interpretGameFeatures(rawFeatures, band, cfg)`                                                         | 3           | —                              |
| `confidenceFromSampleSize(n, signalType, cfg)`                                                          | 3           | —                              |
| `mapWeaknessToActivities(signals, band, constraints, cfg)`                                              | 4           | —                              |
| `targetPuzzleRating(userRating, track, band, recentSuccess, cfg)`                                       | 5           | servo controller (generic)     |
| `practiceStructure(band, motifMastery, cfg)` · `useWorkedExample(band, complexity, cfg)`                | 5           | —                              |
| `gradeFromOutcome(correct, solveMs, bandMedianMs, cfg)` · `scheduleReview(item, grade, fsrsState, cfg)` · `redoFlowPolicy(cfg)` | 6           | `fsrsStep` (generic FSRS math) |
| `prioritizeDailyMix(skillState, dueItems, signals, constraints, band, cfg)`                             | 7           | weighted-sort (generic)        |
| `detectPlateau(glickoHistory, cfg)`                                                                     | 7           | `glickoConfidenceInterval`     |
| `rationaleFor(triggerKey, context, cfg)`                                                                | 8           | —                              |
| `engagementEventsFor(stateChange, cfg)` · `buildImplementationIntention(cue, module)`                   | 9           | —                              |
| `isProgressReal(glickoHistory, cfg)` · `isStableBaseline(rd, cfg)` · `expectationForBand(band, cfg)`    | Measurement | `glickoConfidenceInterval`     |

**Outputs carry their grade.** Functions that produce recommendations return objects already carrying
`{ evidenceGrade, evidenceTier, citationKey, confidence, rationaleKey }` (e.g. `WeaknessSignal`,
`CandidateActivity`, `RationaleEntry`) so the Engine can snapshot them onto persisted artifacts (L3).
`RationaleEntry` additionally carries a **`soften`** flag (set whenever its underlying grade is C/D); the
transparency UI must then phrase that copy tentatively and never as fact. This is the Seam-8 honesty rule
that the now-expanded multi-seam `USER_FACING.md` rationale synthesis depends on (Seam 8 in
`METHODOLOGY.md`).

### 2.9 Determinism & reproducibility

The generator and adaptation loop are pure functions of `(persisted state, injected Clock, config
version)`. Consequences the build relies on:

- **Golden-testable** (§13.1): freeze inputs + pin config version → assert exact output, including the
  rationale keys and grades.
- **Reproducible**: persisting `methodologyVersion` + the generation input snapshot means any "Today"
  screen or adaptation decision can be regenerated and explained.
- **No hidden inputs**: time and any randomness are arguments. The DB read happens in the Engine
  _around_ the pure core, never inside it.

---

## 3. Tech stack + rationale (chosen for AI-agent buildability)

The overriding selection criterion: **what an AI coding agent builds correctly with the tightest
feedback loop.** That means one language, end-to-end types, ubiquitous-in-training-data frameworks,
strong conventions, and pure functions that are trivially unit-testable.

| Concern            | Choice                                                                               | Why (esp. for agent execution)                                                                                                               |
| ------------------ | ------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------- |
| Language           | **TypeScript (strict)** everywhere                                                   | One language end-to-end; the compiler is the agent's first reviewer. `strict`, `noUncheckedIndexedAccess` on.                                |
| App framework      | **Next.js (App Router)**                                                             | Massive training-data presence + strong conventions → fewer agent errors; one repo serves UI + API + cron.                                   |
| API contracts      | **tRPC + Zod**                                                                       | End-to-end typed procedures; **Zod schemas are shared** between client, server, and the methodology loader (one source of validation truth). |
| DB                 | **PostgreSQL (Supabase free tier)**                                                  | Free, managed, relational; pairs with Prisma.                                                                                                |
| ORM                | **Prisma**                                                                           | Typed schema + migrations; agents handle its declarative schema reliably.                                                                    |
| Auth               | **Auth.js (NextAuth v5)**                                                            | Multi-provider OAuth (Google + custom Lichess PKCE); standard `User`/`Account`/`Session` tables.                                             |
| UI                 | **Tailwind CSS + shadcn/ui**                                                         | Convention-driven, copy-in components agents follow without sprawl.                                                                          |
| Chess UI/logic     | **`chess.js`** (legality/PGN/FEN), **`react-chessboard`** or **chessground** (board) | Mature, typed, ubiquitous.                                                                                                                   |
| Chess engine       | **`stockfish.wasm`** (multi-thread) + single-thread WASM fallback                    | **Client-side** analysis → ~zero server compute, no compute-abuse vector (§12). Behind `AnalysisEngineAdapter`.                              |
| Spacing math       | **FSRS** reference algorithm (generic), wrapped as an Engine util                    | Generic math in Engine; **all parameters from config** (Seam 6).                                                                             |
| Unit tests         | **Vitest**                                                                           | Fast; golden tests for every pure function (§13.1).                                                                                          |
| E2E tests          | **Playwright**                                                                       | Drives the real onboarding→program→log→adapt loop (§13.2).                                                                                   |
| Lint/format        | **ESLint + Prettier** + custom rules (L1/L2 guards)                                  | Mechanical conventions = fewer agent mistakes.                                                                                               |
| Hosting            | **Vercel (Hobby)**                                                                   | Free; native Next.js; **Vercel Cron** for background jobs.                                                                                   |
| Background jobs    | **Vercel Cron → route handlers** (+ a DB-backed job/queue table)                     | No extra infra; jobs are idempotent route handlers.                                                                                          |
| Errors / analytics | **Sentry (free)** + minimal privacy-friendly analytics                               | Cheap observability; no heavy tracking (on-brand).                                                                                           |
| Repo shape         | **Single Next.js app, modular `src/`** (not a formal monorepo)                       | Minimal ops for a solo non-dev; module boundaries kept strict so agents don't sprawl (§4).                                                   |

**Why this is the right stack for agents (stated explicitly):** end-to-end types give the agent an
immediate, local feedback loop (a wrong shape fails to compile); the frameworks are the most
represented in training data (fewer hallucinations); strong conventions remove ambiguity; and the
core algorithms are **pure deterministic functions** that are easy to specify, test, and verify — which
is exactly what L2 and §13 demand.

---

## 4. Repository layout (every directory annotated)

```
chess/
├─ planning/                 # VISION.md, BUILD.md (this), METHODOLOGY.md, SHIPPING.md, GROWTH.md
├─ research/                 # the evidence base (inputs to METHODOLOGY.md)
├─ prisma/
│  ├─ schema.prisma          # the data model (§5) — single source of DB truth
│  └─ migrations/            # generated migrations (never hand-edited destructively)
├─ scripts/
│  └─ ingest-puzzles.ts      # one-off/periodic Lichess open puzzle-DB ingest (§6) → LichessPuzzle
├─ src/
│  ├─ app/                   # Next.js App Router: routes + server components
│  │  ├─ (auth)/             #   sign-in, OAuth callbacks
│  │  ├─ onboarding/         #   connect → import → assess → constraints → first program (§8)
│  │  ├─ today/              #   the daily session ("Today") screen (§7 transparency)
│  │  ├─ dashboard/          #   skill/schedule/progress state, expectations (Measurement seam)
│  │  ├─ settings/           #   constraints, connections, data export/delete (GDPR)
│  │  └─ api/cron/           #   background-job route handlers (import sync, adaptation)
│  ├─ server/                # tRPC routers + procedures (the typed API surface)
│  │  ├─ routers/            #   one router per domain (auth, connections, program, tracker, …)
│  │  └─ trpc.ts             #   context, auth middleware, rate-limit middleware
│  ├─ db/                    # Prisma client singleton + typed query helpers (NO business logic)
│  ├─ integrations/          # PlatformAdapter interface + implementations
│  │  ├─ adapter.ts          #   PlatformAdapter interface (§6)
│  │  ├─ lichess/            #   OAuth2 PKCE, account, game export, puzzle activity, tablebase (M13)
│  │  └─ chesscom/           #   read-only PubAPI by username (NOT a login provider)
│  ├─ analysis/              # AnalysisEngineAdapter (Stockfish WASM) → RAW FEATURES ONLY (L1)
│  │  ├─ engine-adapter.ts   #   AnalysisEngineAdapter interface
│  │  ├─ stockfish.worker.ts #   Web Worker host for stockfish.wasm
│  │  └─ features.ts         #   raw feature extraction (no interpretation)
│  ├─ engine/                # THE ENGINE — generic, pure, science-free (L1/L2)
│  │  ├─ generator.ts        #   program generator + daily-session builder (§7)
│  │  ├─ adaptation.ts       #   adaptation loop + redo-failed-puzzles orchestration (§7)
│  │  ├─ tracker.ts          #   append-only event application
│  │  ├─ math/               #   GENERIC math utils: fsrsStep, glickoConfidenceInterval, servo, packing
│  │  ├─ events.ts           #   engagement event bus (plumbing only, §9)
│  │  └─ interactive/        #   PURE solve-session state machine + engine-play opponent (M10; science-free)
│  ├─ methodology/           # THE METHODOLOGY — the ONE place science enters (§2)
│  │  ├─ schema/             #   Zod schemas for MethodologyConfig + GradedValue (L3)
│  │  ├─ loader.ts           #   loadMethodology() (§2.6)
│  │  ├─ provider.ts         #   the ~18 pure reader functions (§2.8)
│  │  └─ configs/            #   stub-<semver>.json now; research-<semver>.json later (§2.7)
│  ├─ components/            # shadcn UI; InteractiveBoard + ReviewBoard (M10/M12); TransparencyCard
│  └─ lib/                   # shared types, Zod schemas, Clock, utils (no domain logic)
├─ tests/
│  ├─ unit/                  # Vitest golden tests for engine + methodology pure fns (§13.1)
│  ├─ e2e/                   # Playwright core-loop tests (§13.2)
│  └─ guards/                # architecture guards: L1 (no science in engine), L3 (config validates)
├─ CLAUDE.md                 # conventions for agents (kept in sync with this doc)
├─ .github/workflows/ci.yml  # CI gates: typecheck · lint · unit · build · e2e · guards (§13.3)
└─ package.json, tsconfig.json, next.config.js (COOP/COEP headers, §6), tailwind, eslint, prettier
```

**Directory boundaries are load-bearing.** `engine/` and `analysis/` may import from `methodology/`
(types + provider functions) and `lib/`, but **not** the reverse, and they may not contain science
constants (L1, guarded in `tests/guards/`). `methodology/` imports only `lib/` and `engine/math` (for
generic algorithms). `db/` holds no business logic. `app/`/`server/` orchestrate; they don't decide.

---

## 5. Data model (all entities, key fields, relations)

Single source of truth: `prisma/schema.prisma`. Notation below is specification. Conventions: every
entity has `id` (cuid), `createdAt`, `updatedAt` unless noted; user-owned rows have `userId` (indexed,
cascade-delete for GDPR); JSON columns are typed via Zod in `lib/`. **Soft-delete** via `deletedAt`
where GDPR export/erase applies.

### 5.1 Identity & accounts

- **User** — the account. `id`, `email` (unique), `name?`, `image?`, `locale` (default `en`), `role`
  (`user|admin`), **`patronStatus`** (`none|patron`, default `none` — **billing-capable reservation**,
  no billing built), `betaAccessGrantedAt?`, `deletedAt?`. The M15 migration backfills the beta grant
  for existing non-deleted accounts; new accounts receive it only when admission finalizes against
  an owner/admin path or a claimed allowlist entry. Relations: 1—\* everything below.
- **Account / Session / VerificationToken** — **Auth.js standard tables** (OAuth provider, provider
  account id, tokens, expiry). One `User` ↔ many `Account` (Google, Lichess).
- **AllowlistEntry** — closed-beta gate. `email?`, `inviteCode?` (unique), `usedByUserId?`,
  `createdAt`, `expiresAt?`. Sign-in is refused unless the persisted user grant or a current
  email/code admits it (§12).

### 5.2 Platform connections & chess data

- **PlatformConnection** — a linked chess account. `userId`, `platform` (`lichess|chesscom`),
  `externalUsername`, `accessToken?` / `refreshToken?` / `scopes?` (Lichess only; **Chess.com stores
  no tokens** — username-only), `status` (`active|error|revoked`), `connectedAt`, `lastSyncedAt?`.
  Unique `(userId, platform)`. Relations: 1—\* `ChessProfileSnapshot`, `ImportedGame`.
- **ChessProfileSnapshot** — point-in-time ratings (time series for the Measurement seam). `userId`,
  `platform`, `capturedAt`, `ratings` JSON (`{ format: { rating, rd, games } }` for
  bullet/blitz/rapid/classical/puzzle), `totalGames`, `raw` JSON. Index `(userId, platform,
capturedAt)`.
- **ImportedGame** — one imported game. `userId`, `platform`, `externalGameId`, **`dedupeKey`**
  (unique per user — e.g. `platform:externalGameId` — idempotent import), `pgn`, `playedAt`,
  `timeControl`, `color` (`w|b`), `result` (`win|loss|draw`), `userRatingAtGame?`, `opponentRating?`,
  `eco?`, `opening?`, `source`, `importedAt`. Indexes `(userId, playedAt)`, unique `(userId,
dedupeKey)`. Relation: 1—0..1 `AnalysisResult`.
- **AnalysisResult** — **raw features only** (L1). `gameId` (unique), `engineVersion`, `depth`,
  `analyzedAt`, **`rawFeatures`** JSON. No interpreted/graded fields. Shape:

```ts
// Contract (specification). Emitted by analysis/; consumed by Seam 3 interpretGameFeatures().
// NOTHING here encodes good/bad — only measurements. Interpretation is methodology (Seam 3).
interface RawGameFeatures {
  acplOverall: number;
  acplByPhase: { opening: number; middlegame: number; endgame: number };
  phaseBoundaries: { openingEndsPly: number; endgameStartsPly: number };
  moveEvals: {
    ply: number;
    cpBefore: number;
    cpAfter: number;
    cpLoss: number;
  }[];
  blunders: {
    ply: number;
    fen: string;
    cpLoss: number;
    motifTags?: string[];
  }[]; // tags via puzzle-DB cross-ref, raw
  errorCounts: {
    inaccuracies: number;
    mistakes: number;
    blunders: number;
    grossBlunders: number;
  };
  clock?: { ply: number; remainingMs: number; spentMs: number }[];
  conversion?: {
    reachedWinningPlus: boolean;
    converted: boolean;
    reachedLosingMinus: boolean;
    saved: boolean;
  };
  openingDeviation?: { firstDeviationPly: number; earlyCpl: number };
}
```

### 5.3 Resource catalog

- **ResourceRef** — an **external** resource (never hosted content). `type`
  (`lichess_puzzle_theme|book|course|endgame_trainer|study|master_game_collection|video|play_games`),
  `title`, `externalUrl?`, `provider`, `metadata` JSON, `methodologyKey?` (links a catalog entry to a
  Seam-4 `ActivityDefinition`). 1—\* `ProgramItem`. **Internal** activities (in-app puzzles, drills,
  endgames — M10–M13) carry **no** `ResourceRef`; they reference **open data** (`LichessPuzzle` /
  `PracticeItem`) by id in `ProgramItem.params` and resolve to an internal route via the
  `ActivityDefinition.delivery` flag (Seam 4).
- **LichessPuzzle** — ingested open puzzle DB (CC0). PK `puzzleId`; `fen`, `moves`, `rating`,
  `ratingDeviation`, `popularity`, `nbPlays`, `themes` (string[], **GIN-indexed**), `gameUrl`,
  `openingTags` (string[]). Index on `(rating)` and `themes` for theme+rating selection. (Free-tier
  size constraint and mitigation: §12.) Rendered **in-app** for both training and calibration (M11).
- **PracticeItem** — a generated/curated **in-app** practice position (M12/M13). `userId?` (null =
  shared/curated; set = personal, e.g. a blunder drill), `kind` (`blunder_drill|endgame|…`), `fen`,
  `solutionLine` (San[]), `sourceRef?` (e.g. `blunder:<gameId>:<ply>`, or a Seam-4
  endgame-curriculum key), `methodologyKey?`, `createdAt`. Scheduled via `ScheduleState`
  (`itemRef = PracticeItem.id`). Holds **no graded merit** — _which_ position to drill is the
  methodology's call (Seam 4); this row is only the position + its known solution line.
- **TablebaseCache** — cached Lichess **tablebase** lookups (M13) so endgame ground truth is fetched
  once and reused. `fen` (unique), `result` JSON (WDL/DTZ/best move), `fetchedAt`.
  (Respect-the-platform caching, §6.6/§12.)

### 5.4 Assessment & constraints

- **Assessment** — onboarding behavioural calibration (Seam 2). `userId`, `completedAt?`,
  `calibrationResponses` JSON, `tacticalRatingEstimate?`, `uncertainty?`, `derivedSkillSeed` JSON,
  `methodologyVersion`. (Self-report is used for constraints/goals only, **never** for skill diagnosis
  — Seam 2.)
- **ConstraintSet** — the user's reality (current + history). `userId`, `minutesPerDay`, `daysPerWeek`,
  `goals` JSON, `ownedResources` (ResourceRef ids), `formatPrefs` JSON, **`targetFocus`**
  (`online | otb | hybrid` — the user's primary play medium; **self-report is valid here** — it is a
  goal/constraint, not a skill claim (Seam 2) — and it drives the Seam-4 2D/3D modality, OTB-prep, and
  board interface-restriction recommendations, METHODOLOGY §4.4), **`ifThenPlan`** JSON
  (`{ cue, plan }` — Seam 9 implementation intention), `isCurrent` (bool), `version`. Latest current
  row feeds the generator. (`targetFocus` may ride in `formatPrefs` JSON until its consumers land in
  M11/M14 — no migration needed before then.)

### 5.5 Program & tracking

- **Program** — a generated plan instance. `userId`, `methodologyVersion`, `status`
  (`active|superseded`), `generationInput` JSON (snapshot of the inputs → reproducibility, L2),
  `createdAt`. 1—\* `ProgramItem`.
- **ProgramItem** — one activity in a day. `programId`, `date`, `orderIndex`, `activityType`
  (internal: `in_app_puzzle|blunder_drill|endgame_drill|game_review`; external:
  `book|course|play_games|study|video|…`), `resourceRefId?` (external only), `params` JSON (e.g.
  `{ theme, targetRating, count, track, puzzleIds, practiceItemIds }`), **transparency
  snapshot** (`rationaleKey`, `rationaleText`, `evidenceGrade`, `evidenceTier`, `citationKey`,
  `confidence`, `soften`), `dimensionsTargeted` (string[]), `status` (`pending|done|skipped`). The transparency
  fields are **denormalised at generation time** (L3) so history is immune to later config bumps. 1—\*
  `ActivityEvent`.
- **ActivityEvent** — **append-only** tracker log (never updated/deleted). `userId`, `programItemId?`,
  `type` (`puzzle_attempt|game_played|drill_done|book_session|skip|self_report|…`), `occurredAt`,
  `payload` JSON (`{ correct?, solveTimeMs?, durationMin?, selfReport?, externalRef?, position? }`),
  `source`. Index `(userId, occurredAt)`. This is the immutable substrate the adaptation loop reads.
  **In-app** activities (M11–M13) write these **automatically** with precise `{ correct, solveTimeMs }`;
  **external** activities (M14) are logged (`book_session`, `game_played`) — both feed the same loop.
- **SkillState** — per-dimension estimate. `userId`, `dimension` (Seam 1 id), `estimate`,
  `uncertainty`, `sampleSize`, `updatedAt`. Unique `(userId, dimension)`. Updated by the adaptation
  loop via methodology functions; never written with a hardcoded threshold.
- **ScheduleState** — spacing/due state per spaced item (FSRS). `userId`, `itemRef` (puzzle id or
  drill key), `itemType`, **`fsrsState`** JSON (`{ stability, difficulty, due, reps, lapses,
lastReview }`), `lastGrade?`, `source`. Index `(userId, due)` for "what's due today." Math is the
  generic Engine `fsrsStep`; **all parameters from Seam 6 config**.
- **ResourceProgress** — current position in an owned **external** resource (book/course — M14).
  `userId`, `resourceRefId`, `position` JSON (`{ chapter?, page?, exercise?, percent? }`),
  `updatedAt`. Unique `(userId, resourceRefId)`. Rolled up from `book_session` `ActivityEvent`s; feeds
  the tracker/adaptation like any other outcome (external content stays external; only progress is
  internal).

### 5.6 Methodology & adaptation

- **MethodologyVersionPointer** — pins the active config version per environment (the loader's
  `active` source, §2.6). `env`, `version`, `activatedAt`. (The config JSON itself ships in the repo;
  this table records which version is live, for reproducibility.)
- **AdaptationLog** — why the program changed (transparency for the loop). `userId`, `runAt`,
  `trigger` (`new_events|new_import|daily_cron`), `inputsSnapshot` JSON, `decisions` JSON (ordered,
  each with its `rationaleKey`/grade), `methodologyVersion`. Surfaced in the dashboard.

### 5.7 Engagement & ops

- **RewardEvent** — engagement plumbing (Seam 9 decides which/when/copy; Engine fires/persists).
  `userId`, `type` (`streak_tick|competence_milestone|consistency_grid|…`), `occurredAt`, `copyKey`,
  `payload` JSON, `seen` (bool). No tangible/contingent rewards (Seam 9 forbid list).
- **NotificationPref** — capped reminders. `userId`, `channel`, `cadenceCap` (config-bounded),
  `enabled`, `quietHours?`. Default off / ≤ config cap (anti-nag, Seam 9).
- **JobRun** — idempotent background-job ledger (import sync, ingest, adaptation cron). `kind`,
  `key` (unique idempotency key), `status`, `startedAt`, `finishedAt?`, `error?`.
- **ApiCallBudget** — per-user external-API rate-limit buckets (§12). `userId`, `platform`,
  `windowStart`, `count`. Enforced by tRPC middleware before any outbound platform call.

### 5.8 Relationship summary

```
User 1─* Account · Session
User 1─* PlatformConnection 1─* ChessProfileSnapshot
                            └─* ImportedGame 1─0..1 AnalysisResult
User 1─1 Assessment (current)        User 1─* ConstraintSet (one isCurrent)
User 1─* Program 1─* ProgramItem 1─* ActivityEvent
User 1─* SkillState     User 1─* ScheduleState     User 1─* AdaptationLog
User 1─* RewardEvent · NotificationPref · ApiCallBudget
User 1─* ResourceProgress *─1 ResourceRef            User 0..1─* PracticeItem
ProgramItem *─1 ResourceRef        ResourceRef *─0..1 ActivityDefinition(methodologyKey)
ScheduleState *─0..1 (LichessPuzzle | PracticeItem) via itemRef
LichessPuzzle (global, ingested)   PracticeItem (personal|curated)   TablebaseCache (global, cached)
AllowlistEntry (global, beta gate)  MethodologyVersionPointer (per env)
```

---

## 6. External integrations (with hard constraints surfaced)

All platforms sit behind one interface so adding/swapping a platform (or adding Chess.com OAuth if it
is ever granted) is a clean change:

```ts
// Contract (specification). src/integrations/adapter.ts
interface PlatformAdapter {
  platform: "lichess" | "chesscom";
  isLoginProvider: boolean; // lichess: true · chesscom: false
  fetchProfile(conn: PlatformConnection): Promise<ProfileSnapshotInput>;
  fetchGames(
    conn: PlatformConnection,
    since?: EpochMs,
    max?: number,
  ): Promise<ImportedGameInput[]>;
  // Lichess only (others throw NotSupported):
  fetchPuzzleActivity?(
    conn: PlatformConnection,
    since?: EpochMs,
  ): Promise<PuzzleActivityInput[]>;
}
```

### 6.1 Auth / login

- **Auth.js (NextAuth v5)** providers: **Google** (OIDC) and **Lichess** (custom **OAuth2 + PKCE**,
  **no client secret** — Lichess is a public client). Discord optional later.
- **Chess.com is NOT a login provider.** Its OAuth is gated/partner-oriented; Chess.com is integrated
  as a **username link** (read-only PubAPI). The `PlatformAdapter.isLoginProvider` flag encodes this.

### 6.2 Lichess (login + read)

- **OAuth2 PKCE** (authorize + token endpoints; minimal read scopes). Tokens stored on
  `PlatformConnection`.
- **Account/profile**: read ratings (incl. RD) + counts → `ChessProfileSnapshot`.
- **Game export**: NDJSON/PGN export by username, requesting **evals, clocks, opening** so the analysis
  module has rich raw features; paginate by `since`/`max`; **idempotent** via `dedupeKey`.
- **Puzzle activity**: read solved/failed puzzle history → enables the **"redo failed puzzles"** flow
  (Seam 6).
- **Hard constraints (respect the platform — VISION §6):** honour **rate limits** (back off on HTTP
  429, single concurrent request, conservative pacing), send a **descriptive `User-Agent`**, cache
  aggressively, and never hammer. Verify exact endpoints/params against current Lichess API docs at
  build time.

### 6.3 Chess.com (read-only PubAPI, username only)

- **No auth, no tokens.** Read by username: profile/stats (rating + RD), and **monthly game
  archives** (list archives → fetch each month's games).
- **Hard constraints:** Chess.com **rejects requests without a proper `User-Agent`** (returns 403) —
  always send a descriptive one (contact/app identifier). Serve behind Cloudflare → respect
  caching/back-off; use conditional requests (ETag/`Last-Modified`) and cache archives (they are
  immutable once a month closes). Serial, polite fetching only.

### 6.4 Lichess open puzzle DB (ingest)

- Source: the public **CC0** puzzle database (CSV, columns `PuzzleId, FEN, Moves, Rating,
RatingDeviation, Popularity, NbPlays, Themes, GameUrl, OpeningTags`).
- `scripts/ingest-puzzles.ts` streams the CSV → upserts `LichessPuzzle` (idempotent), building the
  theme (GIN) + rating indexes that power **theme + rating** selection (Seam 4/5).
- **Hard constraint (free tier):** the **full** DB (~several million rows) **will not fit** the
  Supabase free 500 MB tier. Mitigation (§12): ingest a **rating-×-theme-stratified subset** sized to
  the free tier with full band coverage; document the ceiling; fall back to on-demand Lichess fetch +
  cache for gaps. Selection logic is unaffected (it queries the same table).

### 6.5 Client-side chess engine (Stockfish WASM)

- **Stockfish runs in the browser** (Web Worker), behind `AnalysisEngineAdapter` → ~zero server
  compute and **no server-side compute-abuse vector** (§12).

```ts
// Contract (specification). src/analysis/engine-adapter.ts
interface AnalysisEngineAdapter {
  init(opts: { threads: number; hashMb: number }): Promise<void>;
  analyzePosition(
    fen: string,
    limit: { depth?: number; movetimeMs?: number },
  ): Promise<EvalResult>;
  analyzeGame(pgn: string, limit: AnalysisLimit): Promise<RawGameFeatures>; // raw features ONLY (L1)
  dispose(): void;
}
```

- **Hard constraints:** multi-threaded WASM needs **`SharedArrayBuffer`** → the app must serve
  **cross-origin isolation** headers (`Cross-Origin-Opener-Policy: same-origin`,
  `Cross-Origin-Embedder-Policy: require-corp`) configured in `next.config.js`; ship a **single-thread
  fallback** when isolation/threads are unavailable. **Bound** depth/movetime to keep the UI
  responsive and battery use sane. Heavy backfill analysis is **incremental and optional** (analyse ~5
  recent games instantly at onboarding, queue the rest — Seam 2).

### 6.6 Lichess tablebase (read-only, M13)

- **Endgame ground truth** for in-app endgame drills (≤7-piece positions): the public Lichess
  tablebase API returns WDL/DTZ + the best move for a FEN. **Read-only, no auth.**
- **Hard constraints (respect the platform — VISION §6):** **cache every lookup** in `TablebaseCache`
  (results are immutable for a given FEN — fetch once, reuse forever), send a descriptive
  `User-Agent`, fetch serially with back-off on 429 (the shared `politeFetch`, §6.2/§6.3). Engine
  sparring uses the **client-side Stockfish** adapter (no extra server compute); the tablebase is only
  the correctness oracle where it applies, with a graceful engine-only fallback otherwise.

---

## 7. Program engine mechanics (generic; no science specifics)

The Engine's job is to run the loop deterministically (L2) and call the methodology for every graded
choice (L1). "Auto-periodisation" here means **daily re-prioritisation from current state** — there is
no fixed calendar (consistent with `METHODOLOGY.md` §7, which redefines "periodisation" as exactly
this daily re-prioritisation; athletic load-cycling is off-by-default config, not engine behaviour).

### 7.1 Generator + daily-session builder

```ts
// Contract (specification). src/engine/generator.ts — PURE (L2), science-free (L1).
function generateProgram(input: {
  profile: UserProfile;
  constraints: ConstraintSet;
  skillState: SkillState[];
  dueItems: ScheduleState[];
  weaknessSignals: WeaknessSignal[]; // from Seam 3 (methodology), computed upstream
  band: Band; // derived via config bands; user data overrides priors
  clock: Clock; // injected (L2)
  config: MethodologyConfig;
}): { program: ProgramItemDraft[] }; // ordered, time-budget-fitted, each carrying its graded rationale
```

Flow:

1. **Determine band** from the user's own rating data (config `bands`); band is a prior only — user
   data dominates.
2. **Gather candidates** via methodology: `mapWeaknessToActivities(signals, band, constraints, cfg)`
   (Seam 4) + due reviews (Seam 6) + variety.
3. **Prioritise** via `prioritizeDailyMix(skillState, dueItems, signals, constraints, band, cfg)`
   (Seam 7) → an ordered candidate list with weights and grades.
4. **Set difficulty** per item via `targetPuzzleRating(...)`/`practiceStructure(...)` (Seam 5).
5. **Pack to the time budget** (generic Engine math: greedy/knapsack over `minutesPerDay`), respecting
   owned resources and constraint fit. **This is the only place the Engine "decides," and it decides
   only fit/packing — never chess merit.**
6. **Attach transparency** to each item via `rationaleFor(triggerKey, ctx, cfg)` (Seam 8) and
   **snapshot** grade/citation/confidence onto the `ProgramItemDraft` (L3).

The **daily-session builder** is the same function scoped to a single `date`; multi-day plans are just
repeated daily generation (no fixed syllabus).

### 7.2 Analysis → raw features

`analysis/` produces `RawGameFeatures` (§5.2) **only**. The Engine passes those features to Seam 3's
`interpretGameFeatures()`; it **never** thresholds a feature itself (L1). "Insufficient data" is a
first-class result from Seam 3, surfaced honestly (not an error).

### 7.3 Tracker

Every outcome is one **append-only** `ActivityEvent` (§5.5). The tracker provides `applyEvent(event)`
which writes the immutable row and enqueues an adaptation run; it never mutates prior events.

### 7.4 Adaptation loop

```ts
// Contract (specification). src/engine/adaptation.ts — PURE core (L2), science-free (L1).
function runAdaptation(input: {
  events: ActivityEvent[]; // new since last run
  skillState: SkillState[];
  scheduleState: ScheduleState[];
  glickoHistory: RatingPoint[];
  clock: Clock;
  config: MethodologyConfig;
}): {
  skillStateUpdates: SkillState[];
  scheduleUpdates: ScheduleState[]; // via gradeFromOutcome + scheduleReview (Seam 6)
  adaptationLog: AdaptationLogDraft; // ordered decisions, each graded (transparency)
};
```

Triggers: new tracker events, new game imports, or the daily cron. Steps: map outcomes → FSRS grades
(`gradeFromOutcome`, Seam 6) → reschedule (`scheduleReview` calling generic `fsrsStep` with config
weights) → update `SkillState` → recompute weakness signals → **the next `generateProgram` run yields a
different session.** Plateau/progress use `detectPlateau`/`isProgressReal` (Measurement seam) over
Glicko-2 CIs. Everything is logged to `AdaptationLog` (§5.6).

### 7.5 Redo-failed-puzzles flow

On a `puzzle_attempt` failure event, the Engine plumbs the **3-phase** flow whose _timing, grades, and
hint copy come from Seam 6_ (the Engine supplies no numbers): scaffolded hint (no passive
solution-reveal) → delayed intra-session retest → next-day FSRS load. The Engine owns the state
machine and persistence; Seam 6 owns the intervals and the outcome→grade mapping. Phases 1–2
(scaffolded hint, intra-session retest) require the **in-app board** and land in **M10/M11**; the
external-resource era shipped only the next-day (inter-session) phase, against the same `stepSolve`
session.

### 7.6 Transparency

Every `ProgramItem` carries its snapshotted `{ rationaleText, evidenceGrade, evidenceTier,
citationKey, confidence, soften }` (L3); the `AdaptationLog` records _why the plan changed_. The
`TransparencyCard` component renders "why this / why now" + the evidence grade for any item, and the
dashboard renders the loop's decisions. The Seam-8 copy is now the **per-recommendation "why this?"
synthesis** from the expanded `USER_FACING.md` — one rationale entry per major recommendation type — and
where an entry's underlying grade is C/D its **`soften`** flag makes the card phrase it tentatively, never
as fact. **Framework now; copy from Seam 8.**

---

## 8. Onboarding flow (technical)

A linear, resumable flow; each step writes typed state and is independently testable.

| Step                     | Route / action                                                 | Writes                                              | Methodology called                                  | Phase-1 status            |
| ------------------------ | -------------------------------------------------------------- | --------------------------------------------------- | --------------------------------------------------- | ------------------------- |
| 1. Sign in               | `(auth)` — Auth.js (Google / Lichess PKCE)                     | `User`, `Account`, `Session`                        | —                                                   | built                     |
| 2. Connect platforms     | `onboarding` — Lichess OAuth / Chess.com username              | `PlatformConnection`                                | —                                                   | built                     |
| 3. Background import     | `api/cron` job via `PlatformAdapter.fetchGames`                | `ImportedGame` (idempotent), `ChessProfileSnapshot` | —                                                   | built                     |
| 4. Instant analysis      | analyse ~5 most-recent games client-side; queue rest           | `AnalysisResult` (raw features)                     | — (raw only, L1)                                    | built                     |
| 5. Tactical calibration  | adaptive ladder over puzzles, solved **in-app** (M11)          | `Assessment`                                        | `nextCalibrationItem` / `scoreCalibration` (Seam 2) | built, in-app             |
| 6. Constraints + if-then | `onboarding` form                                              | `ConstraintSet` (incl. `ifThenPlan`, `targetFocus`) | `buildImplementationIntention` (Seam 9)             | built                     |
| 7. The "reveal"          | interactive game review contrasting signals vs self-bias (M12) | n/a                                                 | `interpretGameFeatures` (Seam 3)                    | built, interactive review |
| 8. First program         | `generateProgram(...)` → land on `/today`                      | `Program`, `ProgramItem`, `SkillState` seed         | Seams 3→4→5→7→8                                     | built, research active    |

Self-report is captured for **constraints/goals/owned resources/play-medium only** — never for skill
diagnosis (Seam 2). The constraints step also records the user's **target focus** (`online | otb |
hybrid`); this is a preference, not a skill claim, and feeds the Seam-4 visual-modality and OTB-prep
recommendations (METHODOLOGY §4.4) — the field lands with its consumers in M11/M14. When game history
is thin (`<800` / no games), step 5's calibration carries the diagnosis and a basic board-vision
fallback applies (Seam 2 `noHistoryFallback`).

---

## 9. Engagement framework (event plumbing only)

The Engine builds the **mechanism**; Seam 9 supplies the **policy** (which events fire, thresholds,
copy, and the allow/forbid lists).

```ts
// Contract (specification). src/engine/events.ts — plumbing only.
function onStateChange(
  change: StateChange,
  config: MethodologyConfig,
): RewardEvent[];
//  delegates the WHICH/WHEN/COPY to engagementEventsFor(change, config) (Seam 9);
//  the Engine persists RewardEvent rows and schedules (capped) notifications.
```

- **Engine owns:** the event taxonomy (`streak_tick`, `competence_milestone`, `consistency_grid`,
  `recovery_prompt`, …), the bus, persistence (`RewardEvent`), and a **capped** notification scheduler
  (`NotificationPref`, ≤ config cap).
- **Methodology owns (Seam 9):** the process-goal "cognitive firewall," SDT bounded-choice, forgiving
  habit design, and the **forbid list** (no infinite streaks, no global leaderboards, no
  tangible/contingent rewards, no self-level praise, no nagging).
- **Phase-1 build = plumbing + stub policy** (safe defaults: forgiving capped streak, consistency
  grid, peer comparison off, reminders ≤ cap). Real policy lands with the research config.

---

## 10. Build order — vertical slices M0–M15

Each milestone is a **vertical slice**: an agent-executable unit with a **typed contract**, **tests**,
and a **Definition of Done** (DoD). Slices ship a runnable increment. Dependency order is linear
(M0→M15); the loop is end-to-end and demoable by **M7**, fully transparent and engaging by **M9**,
**internal-first** (in-app training surfaces) across **M10–M14**, and hardened for closed beta by
**M15**.

**Slice template:** _Goal · Depends on · Typed contract (key interfaces introduced) · Tasks · Tests ·
DoD checklist._

### M0 — Scaffold

- **Goal:** a deployable empty app with the toolchain and CI gates.
- **Contract:** `tsconfig` (strict), Prisma datasource, Auth.js base config, `lib/Clock`.
- **Tasks:** Next.js (App Router) + TS strict; Tailwind + shadcn; Prisma + Supabase; Auth.js (Google);
  ESLint/Prettier + L1/L2 lint rules; Vitest + Playwright; GitHub Actions CI; Vercel deploy;
  `next.config.js` COOP/COEP headers; seed `CLAUDE.md`.
- **Tests:** CI runs typecheck + lint + (empty) unit/e2e + build; a smoke Playwright test loads `/`.
- **DoD:** ✅ green CI on push ✅ app deploys to Vercel ✅ Google sign-in works ✅ migrations run on
  Supabase ✅ COOP/COEP headers configured and included in production builds.
- **Status (2026-07-10): ✅ DONE.** Repo pushed to GitHub
  (`kleinebossie/Mainline`, private); **GitHub Actions CI is green on `main`** (npm ci · prisma generate ·
  typecheck · lint · unit · guards · `next build` · e2e). CI/`.nvmrc` pinned to Node 25.2.0 (npm 11.6.2)
  to match the lockfile. COOP/COEP headers active; Google OAuth working; `0_init` migration applied to
  Supabase. GitHub records successful Vercel production deployments, most recently for commit `3ca1e37`
  on 2026-07-09. Anonymous route and header smoke tests are blocked by the deployment's Vercel SSO gate.

### M1 — Identity & connections

- **Goal:** users link chess accounts.
- **Contract:** `PlatformAdapter` (§6); Lichess OAuth2 PKCE provider; `PlatformConnection`.
- **Tasks:** Lichess PKCE login (no secret); Chess.com **username link** (validate via PubAPI, no
  tokens); connection management UI; `isLoginProvider` flag wired.
- **Tests:** unit — adapter username validation, token storage shape; e2e — connect Lichess + add
  Chess.com username.
- **DoD:** ✅ Lichess login creates `Account`+`PlatformConnection` ✅ Chess.com username validated &
  stored tokenless ✅ revoke/disconnect works.
- **Status (2026-06-20): ✅ DONE.** `PlatformAdapter` (`src/integrations/`) with Lichess + Chess.com
  adapters; Lichess OAuth2 PKCE provider (public client, no secret; tokens mirrored to
  `PlatformConnection` via Auth.js events); Chess.com username link validated through PubAPI and stored
  tokenless (enforced by the pure `buildPlatformConnectionData`); tRPC API surface (`server/trpc.ts`,
  `server/routers/connections.ts`) + React Query client; `/signin` + `/connections` UI with
  disconnect/revoke. Tests: 16 unit (adapter validation + token-storage shape), e2e (sign-in/redirect).
  **Verified live against Supabase:** real Lichess sign-in created an `Account` + a `PlatformConnection`
  (token stored), and a Chess.com username link persisted tokenless — both confirmed in the DB.

### M2 — Import & profile

- **Goal:** real games + ratings in the DB.
- **Contract:** `fetchGames`/`fetchProfile`; idempotent import via `dedupeKey`; `JobRun` ledger.
- **Tasks:** background import (Vercel Cron route) for Lichess export + Chess.com archives;
  `ChessProfileSnapshot`; rate-limit + `User-Agent` + caching (§6); basic dashboard listing games &
  ratings.
- **Tests:** unit — dedupe idempotency (re-import = no dupes), PGN/result parsing, rate-limit
  middleware; e2e — import populates dashboard.
- **DoD:** ✅ import is idempotent ✅ snapshots captured ✅ 429/403 handled with back-off ✅ dashboard
  shows imported data.
- **Status (2026-06-20): ✅ DONE — verified live.** Migration applied to Supabase and a real Lichess
  import populated the dashboard (ratings + games) via "Sync now"; `CRON_SECRET` set locally + Vercel.
  Schema: `ChessProfileSnapshot`,
  `ImportedGame` (unique `(userId, dedupeKey)`), `JobRun` ledger (§5.2/§5.7) + migration
  `20260620000000_m2_import_profile`. Adapters: Lichess NDJSON game export + puzzle activity;
  Chess.com monthly-archive import; both via `politeFetch` (descriptive User-Agent, serial, bounded
  429 back-off — `src/integrations/http.ts`). Pure parsers (`lichess/parse.ts`, `chesscom/parse.ts`,
  `pgn.ts`) + in-batch `dedupeImportedGames`. Orchestration `src/server/import.ts` (`withJobRun`
  idempotency, snapshot capture, `createMany skipDuplicates`); `import` tRPC router
  (`sync`/`recentGames`/`latestProfiles`); Vercel Cron route `/api/cron/import` (CRON_SECRET-gated) +
  `vercel.json` daily schedule; `/dashboard` UI with "Sync now". Tests: 34 unit/guard green (parse
  golden, dedupe idempotency, back-off + 429 retry, JobRun ledger), build green, 5 e2e green
  (dashboard auth-gate; live import verified manually). The configured local `.env.local` has
  `CRON_SECRET`; the Vercel environment value still needs owner-side verification because deployment
  secrets are not represented in this repository.

### M3 — Resource catalog (puzzle DB)

- **Goal:** select external puzzle references by theme + rating.
- **Contract:** `selectPuzzles(theme, ratingTarget, n, cfg): LichessPuzzle[]`; `ResourceRef`.
- **Tasks:** `scripts/ingest-puzzles.ts` (streaming, idempotent, **stratified subset** for free tier,
  §12); theme(GIN)+rating indexes; `ResourceRef` catalog seed.
- **Tests:** unit — selection returns puzzles within rating window and matching theme; ingest is
  idempotent; golden test on a fixed puzzle fixture.
- **DoD:** ✅ stratified subset is present within the configured free-tier strategy ✅ ResourceRefs are
  resolvable to external URLs ⚠️ the blueprint defines no target latency; the current indexed check
  returned 10 puzzles in 2036.9 ms and remains an owner performance check.
- **Status (2026-07-10): ✅ DONE for code, schema, and current live data; fresh environments still need the
  ingest command.**
  Schema: `LichessPuzzle` (PK `puzzleId`, **GIN index on `themes`** + btree on `rating`) and
  `ResourceRef` (§5.3) + migration `20260620010000_m3_resource_catalog` (generated offline via
  `prisma migrate diff`). Selection: `selectPuzzles` (`src/db/puzzles.ts`) — theme + rating-window
  query with deterministic proximity ranking. Ingest: `scripts/ingest-puzzles.ts` streams the CC0 CSV
  → rating-×-theme **stratified** subset (`src/integrations/puzzles/stratify.ts`; default ≤200k rows,
  well under the Supabase free 500 MB tier) → idempotent `createMany(skipDuplicates)` on the
  `puzzleId` PK. Catalog: `scripts/seed-resources.ts` seeds one resolvable Lichess training-page
  `ResourceRef` per theme (`src/integrations/catalog.ts`; deterministic ids → idempotent re-seed).
  Tests: 17 new unit/golden (CSV parse, stratify caps/ceiling/determinism, query + proximity ranking,
  catalog URLs), full suite **50 unit + guards + `next build` + 5 e2e green**; ingest **dry-run**
  verified on a fixture (`--dry-run`/`--max-rows`/`--cap`). The configured Supabase database currently
  returns puzzle and ResourceRef rows, and `npm run check:puzzles -- fork 1500` selected 10 rows in
  2036.9 ms. No target latency is defined in this blueprint, so performance remains an owner check.
  `tsx` added (dev) to run the ops scripts.
  **`cfg` deviation (L1, deliberate):** the M3 contract sketches `selectPuzzles(…, cfg)`, but
  METHODOLOGY.md Seam 5 defines **no** puzzle-selection rating window — difficulty is the servo's
  single `targetPuzzleRating`. Inventing a graded window would inject ungraded "science," so the
  window is an **infrastructure retrieval radius** (caller-supplied) and the methodology layer
  (`GradedValue` + loader + stub config) lands in **M4**, its first real consumer (Seam 2 provider
  fns). **Fresh-environment setup:** download + decompress the Lichess puzzle CSV, run
  `npm run ingest:puzzles`, run `npm run seed:resources`, then run the optional
  `npm run check:puzzles` latency check.

### M4 — Constraints + assessment

- **Goal:** capture the user's reality + a behavioural calibration shell.
- **Contract:** `ConstraintSet` schema (incl. `ifThenPlan`); Seam 2 provider fns
  (`nextCalibrationItem`/`scoreCalibration`) against **stub config**.
- **Tasks:** constraints form; adaptive calibration UI rendering items from config; the "reveal"
  dashboard scaffold.
- **Tests:** unit — `scoreCalibration` golden (fixed responses → fixed estimate+uncertainty);
  constraints Zod validation; e2e — complete calibration + constraints.
- **DoD:** ✅ `ConstraintSet` persisted & current ✅ calibration produces a graded estimate ✅ self-report
  never used for skill (only constraints/goals) ✅ if-then plan captured.
- **Status (2026-07-10): ✅ DONE for code and current schema.** The configured Supabase database reports
  all repository migrations applied. This slice also lands the **methodology layer** (M3's deferred piece, its
  first real consumer): the `GradedValue` wrapper + `MethodologyConfig` Zod schema
  (`src/methodology/schema/`), the **fail-closed, immutable** `loadMethodology()` loader, the
  `stub-0.1.0` config (every leaf a graded value, every `citationKey` resolving), and the pure
  provider fns `nextCalibrationItem` / `scoreCalibration` (Seam 2) + `buildImplementationIntention`
  (Seam 9) — read config only, no chess constants (L1), no clock (L2). Data model: `Assessment`
  (one-per-user; **behavioural** responses only — skill is never self-reported) + `ConstraintSet`
  (versioned, one `isCurrent`) + migration `20260621000000_m4_constraints_assessment` (generated
  offline via `prisma migrate diff` between schema datamodels — no DB needed). API: `assessment`
  (`state`/`submit`/`reset`) and `constraints` (`getCurrent`/`save` with supersede + version bump)
  tRPC routers; shared `lib/constraints.ts` Zod is the one validation truth for form + router. UI:
  resumable `/onboarding` overview + adaptive `/onboarding/calibration` (items rendered from config;
  the graded estimate shows its evidence grade/flag so a stub value never reads as fact, L3) +
  `/onboarding/constraints` form (time, goals, formats, Seam-9 if-then) + `/onboarding/reveal`
  scaffold (calibration estimate surfaced honestly; game-signal interpretation deferred to Seam 3 /
  M5–M6). New guards now in CI: **L3** (`tests/guards/methodology-config.test.ts` — every shipped
  config validates, citations resolve, config is deep-frozen; negative cases prove a bare/ungraded
  leaf or dangling citation is rejected) and **L1** (`engine`/`analysis`/`server`/`app` import the
  `@/methodology` surface, never its internals). Tests: **80 unit + guards green** (12 calibration
  golden, 8 constraints Zod, 8 L3 config-integrity, +L1 import boundary), **`next build` green** (11
  routes), **9 e2e green** (onboarding auth-gates; the full signed-in calibration + constraints flow
  is verified manually per §13.5, as in M1/M2). **`instantEvalGames` deviation (deliberate):** the
  Seam-2 config field ships flagged `best-guess` but is consumed in M5 (client-side analysis), not
  here.

### M5 — Analysis (client-side Stockfish)

- **Goal:** raw features from games, in the browser.
- **Contract:** `AnalysisEngineAdapter` (§6.5); `RawGameFeatures` (§5.2).
- **Tasks:** Stockfish WASM in a Web Worker (multi-thread + single-thread fallback); bounded
  depth/movetime; instant-eval of ~5 recent games + queued backfill; persist `AnalysisResult`.
- **Tests:** unit — feature extraction golden on a known PGN (deterministic at fixed depth); worker
  init under/without cross-origin isolation.
- **DoD:** [x] raw features computed client-side [x] **no interpreted field present** (L1 guard passes) [x]
  graceful fallback when threads unavailable [x] zero server compute.
  **Status (2026-07-10): ✅ DONE for code and current schema.** Deliberate deviations: (a) the §4 `stockfish.worker.ts` host role is fulfilled by the vendored nmrugg engine + adapter's UCI bridge (avoids bundling custom worker); (b) cp-loss buckets / phase split live in `src/analysis/thresholds.ts` as RAW measurement conventions, not graded methodology; (c) `analyzeGame` takes `AnalyzeGameContext` extending §6.5; (d) migration hand-written offline. The configured Supabase database reports this migration applied. setup:stockfish runs automatically on build/dev.

### M6 — Program engine v0

- **Goal:** a generated "Today" from stub config.
- **Contract:** `generateProgram(...)` (§7.1); Seam 3/4/5/7/8 provider fns (stub).
- **Tasks:** wire interpret→map→prioritise→difficulty→pack→rationale; build `/today` with
  `TransparencyCard` (rationale/evidence/confidence plumbed); persist `Program`/`ProgramItem` with
  snapshots (L3).
- **Tests:** **golden** — fixed inputs + pinned stub version → exact ordered program incl. rationale
  keys + grades; time-budget packing respects `minutesPerDay`; e2e — onboarding → first program.
- **DoD:** [x] deterministic program (golden green) [x] every item shows a graded "why" [x] fits the time
  budget [x] no science constant in `engine/` (L1 guard green).
  **Status (2026-06-21): code-complete & locally green.** This slice lands the program-engine seams
  the generator consumes: the `MethodologyConfig` schema + `stub-0.1.0` now carry **dimensions** (Seam 1,
  taxonomy), **interpretation** (Seam 3), **activities + weaknessResourceRules** (Seam 4), **difficulty**
  (Seam 5), **prioritization** (Seam 7) and the **rationale** copy table (Seam 8) — every leaf graded,
  every citation resolving, every per-band record covering all bands, and **every C/D rationale carries
  `soften`** (new L3-guard checks + negative cases). Pure provider fns (`bandForRating`,
  `interpretGameFeatures`, `confidenceFromSampleSize`, `mapWeaknessToActivities`, `targetPuzzleRating`,
  `practiceStructure`, `useWorkedExample`, `prioritizeDailyMix`, `rationaleFor`) read config only (L1),
  no clock/random (L2). Generic Engine math (`engine/math/{servo,packing,weighted-sort}`) is the only
  thing the Engine itself decides (fit only, §7.1). `generateProgram` (`engine/generator.ts`) wires
  interpret→map→prioritise→difficulty→pack→rationale and snapshots the graded "why" onto each draft (L3);
  it's golden-tested (deterministic order + budget fit + grades) via an injected `Clock`. Data model:
  `Program` + `ProgramItem` (§5.5, denormalised transparency snapshot) + migration
  `20260621020000_m6_program` (hand-written offline via `prisma migrate diff`). Server: `db/program.ts`
  helpers, `server/program.ts` orchestration (band via `bandForRating`, signals via `interpretGameFeatures`
  over persisted `AnalysisResult`s, `generateProgram`, persist + supersede), `program` tRPC router
  (`getToday`/`generate`). UI: `/today` + `TransparencyCard` (grade/tier/confidence/soften, never renders a
  stub as fact) + the onboarding "first program" step. Tests: **123 unit + guards green** (math, the nine
  seam fns, generator goldens, server round-trip, extended L3 guard), **`next build` green** (12 routes),
  **10 e2e green** (`/today` auth-gate; the full signed-in onboarding→first-program flow is verified
  manually per §13.5, as in M1/M2/M4/M5). **Deviations (deliberate, documented in code):** (a) Seam 3
  ships the **blunder-rate signal only** (the highest-ROI sub-2000 diagnostic, S3); phase/conversion/time/
  VOC stay STUB per METHODOLOGY Seam 3. (b) `generateProgram` input concretises §7.1: `skillState`/`profile`
  reduce to `band` + `tacticalRating` (the dimension that drives difficulty); fuller `SkillState` use +
  `detectPlateau` land with adaptation (M7), and `dueItems` is always empty until the scheduler (Seam 6, M7).
  (c) `targetPuzzleRating`/`practiceStructure` return richer objects than the "→ ratingTarget" sketch.
  (d) At M6, `stub-0.1.0` was extended in place with additive pre-release seams. P1 restored its
  original bytes and moved later typed fields into an additive compatibility overlay; the calibration
  goldens are untouched. (e) `estMinutes` rides in the `ProgramItem.params` JSON (display),
  not its own column. The configured Supabase database reports this migration applied.

### M7 — Tracker + adaptation v0 (loop closes)

- **Goal:** logging an outcome visibly changes the next session.
- **Contract:** `applyEvent(...)`; `runAdaptation(...)` (§7.4); `ScheduleState`/`SkillState`;
  redo-failed-puzzles state machine (§7.5).
- **Tasks:** append-only event logging; FSRS scheduling (generic `fsrsStep` + Seam 6 stub params);
  skill update; regenerate next session; `AdaptationLog`; redo flow.
- **Tests:** **golden** — outcome → FSRS grade → next-due (Seam 6 stub); adaptation changes the next
  program deterministically; e2e — **log activities → next session differs**; redo item reappears
  spaced.
- **DoD:** [x] end-to-end loop runs (the Phase-1 success criterion, VISION §10) [x] adaptation is
  deterministic & logged [x] redo-failed-puzzles works [x] events are immutable.
  **Status (2026-06-21): code-complete & locally green.** The loop closes: logging an outcome on
  `/today` appends an immutable `ActivityEvent`, runs the adaptation loop, and a regenerated session
  reflects it. New methodology seams land in `stub-0.1.0` (extended in place, no version bump — as M6):
  **scheduling** (Seam 6 — FSRS-6 desired retention + 21-weight vector + solve-time→grade thresholds)
  and **measurement** (Glicko-2 CI multiplier + RD baseline + plateau window) — every leaf graded,
  every citation resolving (+2 ledger anchors `fsrs_spaced_repetition`/`glickman2012`, +2 rationale
  `skill_update`/`plateau`). Pure provider fns: `gradeFromOutcome`/`scheduleReview` (Seam 6),
  `detectPlateau` (Seam 7), `isProgressReal`/`isStableBaseline` (Measurement) — config-only (L1), no
  clock/random (L2). Generic Engine math: `engine/math/{fsrs,glicko,estimate}` (FSRS-6 step, Glicko CI,
  running proportion) — every parameter injected from config. `runAdaptation` (`engine/adaptation.ts`)
  is the pure core (outcome→FSRS grade→reschedule + per-dimension skill update + plateau, each a graded
  `AdaptationLog` decision); `logOutcome` (`server/tracker.ts`) is `applyEvent` — append-only write +
  run + persist. Data model: `ActivityEvent` (append-only), `SkillState`, `ScheduleState` (FSRS), and
  `AdaptationLog` (§5.5/§5.6) + migration `20260621030000_m7_tracker_adaptation` (hand-written offline).
  `generateAndSaveProgram` now reads due reviews + rolling success → a regenerated day surfaces a
  **spaced-review item carrying the due refs** and a **servo-shifted puzzle target**. `/today` gains
  per-item logging (solved / struggled / done / skip) + a "reviews due" nudge. Tests: **156 unit +
  guards green** (33 new: FSRS/glicko/estimate goldens, the five seam fns, `runAdaptation` goldens,
  generator due-review + servo, the server `logOutcome` round-trip incl. append-only immutability, the
  L3 guard extended to the new seams), **`next build` green** (12 routes), **10 e2e green** (`/today`
  auth-gate; the full signed-in log→regenerate→redo loop is verified manually per §13.5, as in
  M1/M2/M4/M5/M6). **Deviations (deliberate, documented in code):** (a) the redo flow (§7.5) ships its
  **inter-session** phase only — a miss is scheduled (FSRS) to return spaced; phases 1–2 (scaffolded
  hint, intra-session retest) need an in-app board the external-resource model doesn't have, so they
  are deferred. (b) the v0 redo unit is a **puzzle theme** (the puzzle DB isn't ingested, so there are
  no per-puzzle ids yet). (c) `fsrsStep` implements the FSRS-6 **long-term** equations; the sub-day
  short-term path is omitted (the daily scheduler never reviews sub-day). (d) the 21-weight FSRS vector
  is **one graded leaf** (a single trained artifact, one provenance). (e) `SkillState` is a v0
  running-proportion competence proxy — persisted + logged for the M8 dashboard, not yet consumed by
  generation (difficulty still rides the calibrated tactical rating, as M6). (f) `expectationForBand` +
  the per-band expectation table are deferred to **M8** (where expectations are surfaced). (g)
  `gradeFromOutcome`'s fast/slow→Easy/Hard needs band-median timing (STUB); v0 logs correct-only →
  Good/Again. (h) `ScheduleState.due` is a top-level indexed column mirroring `fsrsState.due` (the
  queryable "due today" key). The configured Supabase database reports this migration applied.

### M8 — Transparency UI

- **Goal:** the honesty brand is visible.
- **Contract:** `TransparencyCard`; dashboards for `SkillState`, due items, `AdaptationLog`,
  expectations (Measurement seam).
- **Tasks:** "why this / why now" cards (grade + citation + confidence + `stub` labelling); state
  dashboards; expectations/rating-noise copy surfaced from Seam 8/Measurement.
- **Tests:** unit — a `stub`/Grade-D value renders with its caveat (never as fact), and a C/D-grade
  `RationaleEntry` honors its `soften` flag (copy phrased tentatively); e2e — open a card, see grade +
  rationale; dashboard shows due items & skill estimates.
- **DoD:** [x] every recommendation explainable in-app [x] stub/low-grade values visibly flagged (L3) [x]
  skill/schedule/expectations dashboards render.
  **Status (2026-06-21): code-complete & locally green.** Transparency UI deployed: TransparencyCard renders
  caveats ("Placeholder") for 'stub' or 'best-guess' values, and a full dashboard surfaces SkillState, due FSRS
  schedule items, the Engine's AdaptationLog, and per-band Measurement expectations. L3 honesty guard is intact.

### M9 — Engagement framework

- **Goal:** event plumbing for motivation (policy stubbed).
- **Contract:** `onStateChange(...)` (§9); `RewardEvent`; `NotificationPref`.
- **Tasks:** event bus; `RewardEvent` persistence; capped notification scheduler; consistency
  grid/forgiving-streak UI fed by stub Seam-9 policy.
- **Tests:** unit — forbidden mechanics never emitted (no global leaderboard, no infinite streak, no
  tangible reward) from stub config; reminder cap respected; e2e — completing a session emits a
  competence event.
- **DoD:** [x] events fire from state changes [x] forbid-list enforced by config (not engine) [x] reminders
  capped & user-configurable.
  **Status (2026-06-22): code-complete & locally green.** The engagement loop is wired: completing a
  (non-skip) activity on `/today` now fires Seam-9 reward events through the engine bus, and the dashboard
  surfaces a forgiving, capped consistency streak, a GitHub-style consistency grid, genuine competence
  recognition (each carrying its evidence grade), and capped, user-configurable reminders. New methodology
  seam lands in `stub-0.1.0` (extended in place, no version bump — as M6/M7): **engagement** (Seam 9 — SDT
  bounded-choice + forgiving habit numbers + the ethical guardrails) with +4 ledger anchors
  (`deci1999`/`lally2010`/`silverman_barasch2023`/`hanus_fox2015`) and +4 rationale entries
  (`streak_tick`/`competence_milestone`/`recovery_prompt`/`consistency_grid`) — every leaf graded, every
  citation resolving. The **forbid list is structural, not a runtime check**: the reward-event taxonomy is
  an enum (no `global_leaderboard`/`tangible_reward` member), the streak is a finite cap, and
  `globalLeaderboards` must be `false` (all enforced in the config schema + L3 guard). Pure provider fn
  `engagementEventsFor` (Seam 9) reads config only (L1), no clock/random (L2). Generic Engine plumbing:
  `engine/events.ts` (`onStateChange` + `clampReminderCadence`, the anti-nag cap) and
  `engine/math/consistency.ts` (day-bucketing for the streak + grid — pure epoch arithmetic). Data model:
  `RewardEvent` (append-only) + `NotificationPref` (capped, one-per-user) (§5.7) + migration
  `20260622000000_m9_engagement` (hand-written offline). Server: `db/engagement.ts` helpers,
  `server/engagement.ts` orchestration (streak/milestone rollup → `onStateChange` → persist; clamped
  reminder save), `engagement` tRPC router (`summary`/`markSeen`/`saveNotificationPref`); `logOutcome` now
  fires engagement after persisting adaptation. Tests: **180 unit + guards green** (24 new: the Seam-9 fn
  goldens, `onStateChange`/`clampReminderCadence`/consistency math, the `server/engagement` round-trip,
  the extended L3 guard incl. forbid-list negatives; the tracker round-trip now asserts a completion fires
  a capped streak tick), **`next build` green** (12 routes), **10 e2e green** (dashboard/today auth-gates;
  the signed-in completion→recognition flow is verified manually per §13.5, as in M1/M2/M4–M8).
  **Deviations (deliberate, documented in code):** (a) the **`day_missed` recovery trigger** ships as
  policy + a unit-tested pure path, but the _automatic_ daily sweep that fires it needs the M15 cron, so
  only the **completion path** is wired now (the e2e criterion). (b) `RewardEvent` stores its `copyKey`
  (not a denormalised grade snapshot, per §5.7); the grade is resolved from the copyKey at render — still
  graded/honest (L3). (c) the SDT **bounded-choice paths** (`dailyChoiceCount`/`freeSkipsPerWeek`) and
  **peer comparison** ship as graded config for the swap but their UI is not built in Phase-1 (consumed
  later). (d) `tiltCooldownLossStreak` ships flagged `stub` (thin chess evidence — METHODOLOGY Seam 9),
  not yet consumed. The configured Supabase database reports this migration applied. The automatic
  daily `day_missed` sweep remains an M15/P2 gap.

> **M10–M14 — the internal-first arc.** VISION §1/§8 now reads: _internalise what we can, reference
> what we can't._ These five slices add **in-app training surfaces** (an interactive board, puzzles,
> game review, blunder drills, endgames) and make the deliberately-external activities (real games,
> books, courses) first-class via **recommendation + logging**. **The architecture does not move:**
> every new surface is **generic, science-free Engine machinery** — chess _rules_ (`chess.js`) and the
> client-side chess engine are mechanical, not chess _knowledge_ (§0.2 glossary). _Which_ position,
> difficulty, and schedule to use stays a **methodology decision** through the **existing seams**.
> Internalising therefore adds **no new seam** — only new **graded `ActivityDefinition`s in Seam 4**,
> each carrying a `delivery: 'internal' | 'external'` flag (data, not an engine branch), plus new
> Engine UI. The Seam-4 surface likewise now carries the **2D/3D visual-modality + OTB-calibration**
> doctrine (METHODOLOGY §4.4) and the **book-study protocol + per-band book catalog** (§4.2–4.3) as
> **graded config** — the anti-arrow / anti-hover / eval-bar / legal-move-dots **interface restrictions**
> per band × `targetFocus`, the modality split, OTB tournament-simulation cadence, and book
> recommendations. The interactive board exposes these as **affordance props** whose graded values come
> from config (L1); still **no new seam**. **No LLM enters the product** (L-rule 4); in-app activities run **client-side** (~zero
> server compute, §12). M10–M14 also retire two M7 deviations: the §7.5 redo-flow phases 1–2 and
> per-puzzle (not per-theme) scheduling, both of which were blocked only by the absence of an in-app
> board.

### M10 — Interactive board substrate

- **Goal:** a generic, science-free in-app chessboard the internal activities build on — render a
  position, accept user moves, validate them locally, time the solve, and (optionally) spar against
  the client-side chess engine. The reusable foundation for M11–M14 (precedent: M4 landed the
  methodology layer as its first consumer's foundation).
- **Depends on:** M5 (`AnalysisEngineAdapter` / Stockfish WASM), M6 (`ProgramItem` / activity types).
- **Contract:** a new **`src/engine/interactive/`** module (Engine-side, pure, science-free — L1/L2):

```ts
// Contract (specification). src/engine/interactive/session.ts — PURE state machine (L2), science-free (L1).
function stepSolve(
  state: SolveState, // { position, solutionLine: San[], cursor, startedMs, attempts }
  move: { san: San; atMs: EpochMs }, // atMs from the injected Clock (L2) — no Date.now()
): {
  state: SolveState;
  step: "correct" | "wrong" | "solved" | "continue";
  solveMs: number;
};
//  Matches `move` against the SUPPLIED solutionLine (puzzle.moves / drill bestLine); it never
//  judges chess MERIT (that came from methodology/data upstream) — only line-match + timing.

// src/engine/interactive/engine-play.ts — wraps an INJECTED AnalysisEngineAdapter as a move-making
//  opponent (endgames, M13). Pure given the adapter + Clock; the adapter type lives in analysis/lib.
```

Plus an **activity-resolution** change: a `ProgramItem` resolves to an **internal route**
(`/train/...`) or an external `ResourceRef.externalUrl`, decided by the `ActivityDefinition`'s
graded **`delivery`** field (Seam 4 — data, not a code branch).

- **Tasks:** an `InteractiveBoard` component (`chess.js` legality + `react-chessboard`/chessground)
  under `src/components/`; the pure `stepSolve` state machine (line-match, solve-timing, retry); the
  `engine-play` opponent harness over the existing client-side Stockfish adapter (dependency-injected
  to stay pure); internal-vs-external resolution for `ProgramItem`; a demo `/train` route exercising
  the board end-to-end. The board also exposes **interface-affordance props** (`showEvalBar`,
  `showLegalMoveDots`, `allowArrows`, `allowHover`) — science-free toggles with safe defaults; their
  **graded per-band × `targetFocus` values are Seam-4 config** (METHODOLOGY §4.4(c), the anti-crutch
  doctrine), carried on the activity's `params` and wired by the consuming activities in M11+. The
  board itself hardcodes **no** affordance policy (L1).
- **Tests:** unit (golden) — `stepSolve` over a fixed line (correct / wrong / solved transitions,
  deterministic `solveMs` from an injected Clock); board legality on a known FEN; **L1 guard** (no
  chess/learning constant in `engine/interactive/`); **L2** (Clock injected, no `Date.now()`). e2e —
  open `/train`, make a move, see it validated locally.
- **DoD:** ✅ interactive board renders & validates moves locally ✅ `stepSolve` golden-green &
  deterministic (Clock injected) ✅ `ProgramItem` resolves internal vs external by config `delivery`
  ✅ zero server compute (board + engine client-side) ✅ L1/L2 guards green.
- **Status (2026-07-10): ✅ DONE.** `src/engine/interactive/`, `src/components/interactive-board.tsx`,
  `/train`, and the associated unit/e2e coverage are present. The internal-first dependency used by
  M11-M14 is complete.

### M11 — In-app tactical training & assessment

- **Goal:** solve selected puzzles **in-app** with auto-tracked outcomes, and run the onboarding
  **tactical calibration in-app** — replacing the external-link / self-report path with precise local
  outcomes (the user-requested internalisation of both puzzles and the assessment).
- **Depends on:** M3 (ingested `LichessPuzzle`), M4 (Seam-2 calibration provider fns), M7 (FSRS
  scheduling + redo flow), M10 (board substrate).
- **Contract:** an `in_app_puzzle` activity (`delivery: internal`) + the internalised Seam-2
  calibration; **per-puzzle** `ScheduleState` (`itemRef = puzzleId`, `itemType = 'puzzle'`); the
  **§7.5 redo flow's two deferred phases** (scaffolded hint, intra-session retest) now in scope.
- **Tasks:** render a `selectPuzzles(...)` result on the board; validate the (possibly multi-move)
  solution line locally via `stepSolve`; **auto-append** a `puzzle_attempt` `ActivityEvent`
  (`{ correct, solveTimeMs }`) → the existing M7 adaptation/FSRS loop, **unchanged**; **internalise
  calibration** — the onboarding ladder renders `nextCalibrationItem` items on the board and scores via
  `scoreCalibration` from **real local outcomes** (no Lichess round-trip, no self-report); **complete
  §7.5** — scaffolded hint then delayed intra-session retest (timing/copy from Seam 6), now possible
  with an in-app board; per-puzzle FSRS keyed by `puzzleId`; **apply the Seam-4 interface-restriction
  doctrine** (METHODOLOGY §4.4(c)) on the solving board — eval bar and legal-move dots off across all
  bands; right-click arrows and piece-hover gated by band × `targetFocus` — carried on the activity's
  `params` (set by `mapWeaknessToActivities` from config) and rendered through the M10 affordance props;
  never an engine constant (L1), with the `anti_arrow_hover` Seam-8 rationale shown to explain the
  restriction.
- **Tests:** unit (golden) — multi-move solution-line validation; `puzzle_attempt` event shape;
  **calibration scoring from in-app outcomes equals the M4 golden** (same `scoreCalibration`, new
  source); redo state machine (hint → retest → next-day FSRS). e2e — solve a puzzle in-app → outcome
  logged → next session adapts; **complete calibration fully in-app → graded estimate**; fail a puzzle
  → hint → intra-session retest → it reappears spaced.
- **DoD:** ✅ puzzles solved in-app with **auto-tracked** outcomes (no self-report) ✅ tactical
  calibration runs fully in-app ✅ difficulty stays **servo-driven** — **no competing puzzle-rating
  ladder or leaderboard**; progress stays tied to real game rating + `SkillState` ✅ §7.5 redo hint +
  intra-session retest work ✅ per-puzzle FSRS ✅ solving board honors the Seam-4 interface-restriction
  doctrine (eval bar / legal dots off; arrows/hover gated by band × `targetFocus`) — values from config,
  not engine (L1) ✅ outcomes feed the **existing** adaptation loop with no
  engine change (resolves M7 deviations a & b).
- **Status (2026-06-24): ✅ DONE.**

### M12 — Interactive game review & personalised blunder drills

- **Goal:** see your own analysed games in-app (eval graph, blunders, "find the better move"), and
  train your **actual mistakes** as spaced in-app drills.
- **Depends on:** M5 (`AnalysisResult` / `RawGameFeatures`), M10 (board), M11 (solve / auto-log / FSRS).
- **Contract:** an interactive review over `RawGameFeatures` (`moveEvals`, `blunders`); a
  `blunder_drill` activity (`delivery: internal`); generated `PracticeItem`s (§5.3) scheduled via
  `ScheduleState`.
- **Tasks:** an annotated `ReviewBoard` — step through the game, eval graph projected from
  `moveEvals`, blunder markers, **on-demand "best line"** via the existing client-side Stockfish
  adapter; **make the onboarding "reveal" (step 7) this interactive review**; derive `blunder_drill`
  `PracticeItem`s from `RawGameFeatures.blunders[]` ("you played X here — find the better move"),
  validated against the engine line via `stepSolve`, **auto-logged** (`drill_done`) and spaced via
  FSRS; a Seam-4 `blunder_drill` `ActivityDefinition` + the weakness→drill mapping rule (**graded
  data**, research config later — never an engine constant). The `ReviewBoard` honors the same Seam-4
  interface-restriction affordances as M11 (METHODOLOGY §4.4(c) — eval bar / legal dots off; arrows /
  hover gated by band × `targetFocus`), from config.
- **Tests:** unit (golden) — eval-graph projection from fixed `moveEvals`; **deterministic**
  blunder→`PracticeItem` derivation; drill validation + scheduling. e2e — open a game review, step
  through, reveal the best line; a blunder drill surfaces in `/today`, solve it, it logs + reschedules.
- **DoD:** ✅ analysed games reviewable in-app (eval graph + blunders + best line) ✅ the onboarding
  reveal **is** the interactive review ✅ personal blunder drills generated, trained, auto-logged &
  spaced ✅ no science constant in the review/drill Engine code (L1) — drill **selection/mapping** is
  Seam-4 config.
- **Status (2026-06-24): ✅ DONE.**

### M13 — In-app endgame drills

- **Goal:** train endgame technique **in-app against the chess engine**, with optional tablebase
  ground truth — internalising the former `endgame_trainer` external activity.
- **Depends on:** M10 (board + `engine-play` harness), M11 (auto-log / FSRS).
- **Contract:** an `endgame_drill` activity (`delivery: internal`); `PracticeItem` (kind `endgame`);
  an optional Lichess **tablebase** adapter (§6.6) + cache (§5.3).
- **Tasks:** render curated/generated endgame positions (the **per-band endgame curriculum is Seam-4
  config** — graded data, research later); play them out vs the client-side Stockfish opponent
  (`engine-play`); judge technique against the engine and, where available, the **Lichess tablebase
  API** (read-only, **rate-limited, cached, polite** — §6.6/§12); **auto-log** (`drill_done`) + FSRS
  scheduling; Seam-4 `endgame_drill` `ActivityDefinition`s.
- **Tests:** unit — tablebase adapter parse + **cache hit (no refetch)** + back-off on 429; endgame
  position scoring golden; the curriculum is read from config (L1 guard). e2e — play a known endgame
  drill in-app to a correct result, outcome logged + scheduled.
- **DoD:** ✅ endgame positions trained in-app vs the engine (curated curriculum played out vs the
  client-side Stockfish `engine-play` opponent) ✅ tablebase ground truth used where available,
  **rate-limited & cached** (cache-first `TablebaseCache`, polite `politeFetch` 429 back-off,
  ≤7-piece guard, graceful engine-only fallback — respect the platform, §12) ✅ outcomes
  auto-logged (`drill_done`) & spaced on their own `endgame` FSRS queue ✅ endgame curriculum is
  Seam-4 config (`endgameCurriculum`, graded `objective`), not engine code (L1).
- **Status (2026-06-24): ✅ DONE.** Notes: (a) endgame drills are due-gated like blunder drills and
  **seeded from the band curriculum at generation time** (`ensureEndgameDrills`, idempotent) so they
  reach `/today`; (b) the play-out is judged by the pure `scoreEndgame`/`classifyTerminal` engine
  scorer against the position's `objective`, with the Lichess tablebase as an **optional** ground-truth
  oracle (null ⇒ engine-only); (c) the stub curriculum ships conservative, decisive "win" positions
  (basic mates → conversions), legality-verified — the research config swaps in the full ladder with no
  Engine change; (d) the e2e drives a deterministic engine-free mate-in-1 endgame on the `/train` demo,
  while the full signed-in play-out (real Stockfish) is manually verified per §13.5. The configured
  Supabase database reports this migration applied.

### M14 — Recommended resources, book-study & OTB-calibration protocols (the deliberately-external layer)

- **Goal:** make the genuinely-external activities (books, courses, playing real games) **first-class**
  — recommend the right ones, guide _how_ to study them, calibrate practice to the user's play medium
  (online vs OTB), and let users log progress — **without hosting anything**.
- **Depends on:** M3 (`ResourceRef` catalog), M4 (`ConstraintSet.targetFocus`), M6/M7 (program + tracker).
- **Contract:** Seam-4 `book` / `course` `ActivityDefinition`s (`delivery: external`) + the **per-band
  book catalog** and **book-study protocol** (active recall, 85% difficulty calibration, Woodpecker
  cycle scheduling — METHODOLOGY §4.2–4.3) and the **2D/3D modality + OTB-calibration protocol**
  (modality split, OTB tournament-simulation cadence, physical-board recommendation — §4.4 a/b), all
  **graded data** (research source `BEST_BOOKS.md` / `2D_VS_3D.md`); `ResourceProgress` (§5.5) carries
  **self-reported success rate** (for the 85% rule) + **Woodpecker cycle state** in its `position` JSON
  and the `book_session` `selfReport` payload (**no schema change**); an external `play_games` activity
  = deep-link out + rely on the existing import to capture the result.
- **Tasks:** band-appropriate book/course recommendations surfaced as `ResourceRef`s with a graded
  "why this" from the §4.3 catalog (Seams 4/8; lower-band strategy/opening books **blocked** per the
  catalog's cognitive-load rule); a **book-study logging surface** — track chapters / exercises / time
  → an `ActivityEvent` (`book_session`) capturing the user's **self-reported success rate** (drives the
  85%-rule calibration nudge) + Woodpecker-cycle progress + a rolled-up `ResourceProgress`, feeding the
  **same** tracker/adaptation loop; **OTB-calibration recommendations** gated by `targetFocus` —
  physical-board setup advice, the per-band 2D/3D modality split, and OTB tournament-simulation cadence
  (Zen mode, no arrows, notation, touch-move) surfaced as graded activities; wire the new Seam-8 copy
  keys (`book_active_recall`, `book_difficulty_calibration`, `book_woodpecker_cycle`, `modality_2d_vs_3d`,
  `otb_tournament_simulation`); keep **game-play external** — a "go play _N_ games on Lichess/Chess.com"
  activity that deep-links out and depends on M2 import to pick up the result.
- **Tests:** unit — per-band recommendation lookup (graded; low-band strategy/opening books suppressed);
  `book_session` event with self-reported success rate + `ResourceProgress` roll-up; Woodpecker-cycle
  interval derivation (golden); modality / OTB-prep recommendations gated by `targetFocus`; the
  `play_games` activity resolves to a **deep-link**, never an internal route. e2e — log a book session
  (with success rate) → it appears in the tracker and influences the next session; an OTB-focused user
  sees physical-board / tournament-simulation guidance; a play-games activity links out and the imported
  game is picked up by the loop.
- **DoD:** ✅ books/courses recommended per band with **graded** rationale (content stays external;
  low-band overload books blocked) ✅ book-study protocol (active recall, 85% calibration, Woodpecker
  cycles) surfaced + logged ✅ 2D/3D modality + OTB-calibration recommendations driven by `targetFocus`
  ✅ users log progress (incl. self-reported success rate) through external resources in-app ✅ game-play
  stays **external** (deep-link + import) ✅ logged external outcomes feed the **same** adaptation loop.
- **Status (2026-06-24): ✅ DONE.** Notes: (a) the deliberately-external layer lives on a new
  **`/library`** surface, all config-driven — two graded Seam-4 sections (`bookStudy`: active-recall +
  the 85% difficulty rule + Woodpecker cycles + the per-band catalog + the cognitive-load
  `blockedCategoriesByBand`; `modality`: the per-band 2D/3D split + OTB tournament-simulation cadence +
  physical-board advice) read by four pure provider fns (`recommendBooks` / `woodpeckerSchedule` /
  `bookDifficultyFeedback` / `modalityRecommendation`), each graded (L3) and golden-tested; (b) the
  cognitive-load block rule suppresses low-band strategy/opening books (`recommendBooks` filters by
  `blockedCategoriesByBand`); (c) **no schema change** — a new `book_session` `ActivityEvent` carries the
  self-reported success rate + position + Woodpecker cycle in the existing `payload` JSON, and
  **`ResourceProgress` (§5.5) is a derived roll-up** of those events (no table); the session feeds the
  **same** `logOutcome` → `runAdaptation` loop unchanged, with `correct` left null so it never moves
  skill (the self-report tunes the 85% nudge only — Seam-2 boundary); (d) `ConstraintSet.targetFocus`
  rides in the `formatPrefs` JSON (no migration, §5.4), is captured in the constraints form, and now
  drives the Seam-4 modality/OTB recommendations **and** the M11 board interface-restrictions (the
  hardcoded `"online"` stub in calibration + train is replaced by the user's stored medium); (e) game-play
  stays **external** via the existing `play_games` deep-link (golden-tested to resolve to a platform URL,
  never an internal `/train` route); (f) the `book` Seam-4 activity ships `delivery: external` with a
  conservative stub daily-mix priority of 0 (surfaced on `/library`, not forced into the timed session —
  the research config can raise it with no Engine change); (g) the e2e drives the public `/library`
  auth-gate redirect, while the full signed-in book-session loop is manually verified per §13.5.
  **No migration / infra hand-off** — all M14 state rides in existing JSON columns, and book
  recommendations are config-driven (identified by the config book id), so `seed:resources` is unchanged.

### M15 — Beta hardening

- **Goal:** safe closed-beta on free tiers.
- **Contract:** allowlist gate; `ApiCallBudget` middleware; PWA manifest/SW.
- **Tasks:** invite/allowlist sign-in gate; per-user external-API rate limits + caching; Sentry;
  minimal privacy-friendly analytics; PWA; perf pass; GDPR export/delete.
- **Tests:** unit — non-allowlisted sign-in refused; rate-limit bucket blocks over-budget calls; e2e —
  invited user completes full loop; data export/delete works.
- **DoD:** ✅ closed-beta gating ✅ within Vercel/Supabase free limits under expected load ✅ errors
  tracked ✅ installable PWA ☐ GDPR export/erase verified.
- **Status (2026-07-11): IN PROGRESS, P2 RUNTIME COMPLETE.** `AllowlistEntry` now gates new OAuth
  admission while preserving pre-gate owner access, and `ApiCallBudget` atomically limits every
  actual Lichess/Chess.com attempt, including retries and cron work. The shared `JobRun` runner uses
  leases, sanitized error codes, retry attempts, and immutable successful keys. One free-tier daily
  cron runs imports, daily adaptation, the configured missed-day sweep, and bounded operational
  pruning; admins can inspect and retry failed known jobs from Settings. Sentry error handling and
  typed core-loop events are fail-closed through a tested privacy scrubber, with tracing and replay
  disabled. The manifest, icons, static-only service worker cache, and PWA headers preserve the
  Stockfish COOP/COEP contract. Runtime setup and recovery are documented in
  `planning/OPERATIONS.md`. P3 still owns versioned research consent, complete export coverage, and
  the actual idempotent hard-delete purge, so the final GDPR box remains open.

---

## 11. Research seams — the index that keeps the doc adjustable

Each seam is an **interface defined here**, filled with **stub config now** and **research config
later** (`METHODOLOGY.md`); **none change the architecture** (VISION §4, §9). Contents are in
`METHODOLOGY.md` — this table is the **map**, not the content (§0.3).

| #   | Seam                                       | `MethodologyConfig` field(s)                                                   | Pure function(s) (§2.8)                                       | METHODOLOGY.md anchor | Research source                                                                                                                                                     | Phase-1 |
| --- | ------------------------------------------ | ------------------------------------------------------------------------------ | ------------------------------------------------------------- | --------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------- |
| 1   | Skill dimensions & taxonomy                | `dimensions`, `bands`                                                          | `dimensionsForBand`                                           | Seam 1                | `SKILL_TAXONOMY.md`                                                                                                                                                 | research |
| 2   | Assessment content + scoring               | `assessment`                                                                   | `nextCalibrationItem`, `scoreCalibration`                     | Seam 2                | `WEAKNESS_DIAGNOSIS.md`                                                                                                                                             | research |
| 3   | Game-feature → weakness                    | `interpretation`                                                               | `interpretGameFeatures`, `confidenceFromSampleSize`           | Seam 3                | `WEAKNESS_DIAGNOSIS.md`, `SKILL_TAXONOMY.md`                                                                                                                        | research |
| 4   | Weakness/level → resource + params         | `activities`, `weaknessResourceRules`, `gameAnalysis`, `bookStudy`, `modality` | `mapWeaknessToActivities`                                     | Seam 4                | `WHAT_RAISES_RATING.md`, `GAME_ANALYSIS.md`, `BEST_BOOKS.md`, `2D_VS_3D.md` (recs, game-analysis protocol, book-study, 2D/3D + OTB calibration, endgame curriculum) | research |
| 5   | Difficulty / calibration targets           | `difficulty`                                                                   | `targetPuzzleRating`, `practiceStructure`, `useWorkedExample` | Seam 5                | `PRACTICE_DESIGN.md`                                                                                                                                                | research |
| 6   | Spacing / scheduling                       | `scheduling`                                                                   | `gradeFromOutcome`, `scheduleReview`, `redoFlowPolicy`        | Seam 6                | `SPACED_REPETITION.md`                                                                                                                                              | research |
| 7   | Periodisation / prioritisation (daily mix) | `prioritization`                                                               | `prioritizeDailyMix`, `detectPlateau`                         | Seam 7                | `TRAINING_PROGRAMMING.md`                                                                                                                                           | research |
| 8   | Rationale & evidence copy                  | `rationale`, `evidenceLedger`                                                  | `rationaleFor`                                                | Seam 8                | `USER_FACING.md` (multi-seam "why this?" synthesis), `EXPECTATIONS.md`                                                                                              | research |
| 9   | Engagement mechanics + guardrails          | `engagement`                                                                   | `engagementEventsFor`, `buildImplementationIntention`         | Seam 9                | `MOTIVATION.md`                                                                                                                                                     | research |
| n/a | Measurement & expectations (cross-cutting) | `measurement`                                                                  | `isProgressReal`, `isStableBaseline`, `expectationForBand`    | Measurement           | `EXPECTATIONS.md`, `2D_VS_3D.md` (remote↔OTB performance gap)                                                                                                       | research |

Updating any seam = a `MethodologyConfig` edit + a version bump. **The Engine, the data model, and the
contracts above do not move.**

**Internalising activities (M10–M14) added no new seam.** The new in-app surfaces (board, puzzles,
review, drills, endgames) are **generic Engine machinery**; _which_ position, difficulty, and schedule
to use stays a methodology call through the seams above. The only methodology change is **new graded
`ActivityDefinition`s in Seam 4**, each carrying a `delivery: 'internal' | 'external'` flag — data, not
an engine branch — so the internal-vs-external split is itself swappable config.

---

## 12. Cost & abuse guardrails

- **Closed-beta allowlist** (`AllowlistEntry`) — bounded user count keeps usage inside free tiers.
- **OAuth-only** — no passwords to store or leak; Lichess PKCE has no client secret.
- **Client-side chess engine** — Stockfish runs in the user's browser; **there is no server compute to
  abuse** and ~zero compute cost.
- **In-app activity surfaces are client-side** (M10–M13) — the board, move validation, solve-timing,
  and engine sparring all run in the browser over **open data** (the CC0 puzzle DB, the user's own
  games, engine output). Internalising adds **no server compute and hosts no copyrighted content**. The
  only new outbound call is the **Lichess tablebase** (M13), which is **cached per-FEN** in
  `TablebaseCache` and rate-limited/backed-off like every platform call (§6.6).
- **No LLM at runtime** — removes the single largest cost/abuse surface (VISION §8).
- **Cache the puzzle DB locally** — query our own `LichessPuzzle` table, never hammer Lichess for
  selection. **Free-tier size constraint:** the full DB exceeds Supabase free (§6.4); ship a
  **rating-×-theme-stratified subset** with full band coverage + an on-demand cached fallback;
  document the ceiling honestly.
- **Per-user external-API rate limits** (`ApiCallBudget`, enforced in tRPC middleware) + conditional
  requests/ETag caching + descriptive `User-Agent` + back-off on 429/403 — **respect Lichess and
  Chess.com as partners** (VISION §6).
- **Idempotent background jobs** (`JobRun`) — imports/adaptation are safe to retry; no runaway loops.
- **Free-tier budget awareness** — Vercel Hobby (function/cron limits) + Supabase free (500 MB DB,
  storage caps): keep analysis client-side, store only what the loop needs, prune raw blobs where
  possible. Closed beta is the primary cost cap.

---

## 13. Verification (end-to-end)

Verification is how an AI agent knows it succeeded; it is the safety net for L1/L2/L3.

### 13.1 Vitest golden tests for pure functions (the core)

Every Engine and methodology pure function (§2.8, §7) gets a **golden test**: fixed inputs **+ a pinned
config version** → an asserted exact output, **including the rationale keys and evidence grades** (L3).
Because the functions are deterministic (L2), these are stable. Coverage targets: `generateProgram`,
`runAdaptation`, `interpretGameFeatures`, `targetPuzzleRating` (servo), `scheduleReview` (FSRS),
`gradeFromOutcome`, `prioritizeDailyMix`, `detectPlateau`, `isProgressReal`, `scoreCalibration`,
`selectPuzzles`, feature extraction, and the in-app substrate `stepSolve` (solve-session state
machine, M10) + the blunder-drill derivation from `RawGameFeatures.blunders[]` (M12), the
interface-restriction affordance params attached by `mapWeaknessToActivities` (band × `targetFocus`,
M11), and the per-band book-recommendation + Woodpecker-cycle interval derivation (M14).

### 13.2 Playwright e2e for the core loop

One canonical journey, run against a built app with a seeded test DB and a **Lichess test account**:
**sign in → connect → import → calibration + constraints → first program → log activities → confirm the
next session changed** (the Phase-1 success criterion, VISION §10). Plus: redo-failed-puzzle reappears
spaced; transparency card shows grade + rationale; export/delete works.

### 13.3 CI gates (the agent's safety net)

GitHub Actions on every push/PR, **all required green** before merge:
`typecheck (tsc --noEmit)` → `lint (eslint, incl. L1/L2 rules)` → `unit (vitest run)` →
`guards` → `build (next build)` → `e2e (playwright)`. This is the order implemented by
`.github/workflows/ci.yml`; branch protection enforces that every gate passes.

### 13.4 Architecture guards (enforce the three laws)

- **L1 guard:** a test that fails if `engine/`, `analysis/`, `server/`, or `app/` contain forbidden
  numeric literals in decision paths or import methodology internals instead of the typed surface.
- **L3 guard:** load **every** shipped config (stub + research) through the Zod schema and assert it
  passes — i.e. **every leaf is a `GradedValue`**, every `citationKey` resolves in `evidenceLedger`,
  semver is valid, and **every C/D-grade `RationaleEntry` carries `soften: true`** (so weak-evidence copy
  can never render as fact). A bare/ungraded value fails the build.
- **Determinism guard (L2):** lint ban on `Date.now()`/`Math.random()` in `engine/` and `methodology/`
  decision code (Clock/seed must be injected).
- **Reproducibility check:** golden snapshots must be regenerated only via an explicit command; a
  drift fails CI (forces intentional review when a config or function changes).

### 13.5 Manual local verification

Seed a user, connect a real Lichess **test** account, run the full loop by hand, confirm: the next
session genuinely adapts; transparency cards render rationale/evidence/confidence; `stub`/low-grade
values are visibly flagged; failed-puzzle redo appears.

---

## 14. Out of scope for Phase 1

Deliberately excluded (VISION §8; Phases 2 _Shipping_ / 3 _Acquiring Users_ live in `SHIPPING.md` /
`GROWTH.md`):

- **Payments / subscriptions** — stay **billing-capable** (`User.patronStatus` reserved) but build no
  billing, no Stripe, no paywall (training quality is free forever, VISION §7).
- **Native mobile/desktop apps** — web-first responsive PWA only.
- **Social / multiplayer** — not in beta, not after (not the app's goal).
- **A competing game-play platform** — no in-app human-vs-human games, matchmaking, rated play, or
  clocked live games. Playing real games stays on Lichess/Chess.com (we deep-link out and import the
  result, M14). _(In-app **training** surfaces — puzzles, blunder drills, game review, endgames vs the
  engine — are now **in scope**, M10–M14: sparring the engine for a drill is training, not competing
  with the game platforms.)_
- **Hosting copyrighted content** — books, courses, and videos are **recommended and logged, never
  hosted** (M14). Only **open data** is rendered in-app: the CC0 puzzle DB, the user's own games, and
  engine/tablebase output.
- **LLM / AI features in the product** — none at runtime (internalising changes nothing here: the
  in-app surfaces use the chess engine, not an LLM).
- **Opening-repertoire trainers.**
- **Server-side / large-scale engine analysis** — analysis stays client-side (§12).
- **Chess.com OAuth login** — username-only read import (§6.3); revisit only if access is granted.

---

_This document is the authoritative technical blueprint. It defines the Engine and the
`MethodologyConfig` schema/loader; the science that fills the seams lives in `planning/METHODOLOGY.md`
and is referenced here, never duplicated. The three architectural laws (§0.1) — science only in config,
pure & deterministic decisions, evidence never stripped — are the product, not the packaging. When the
build adds code, keep this doc and `CLAUDE.md` in sync, and update §3/§4/§10 as reality lands._
