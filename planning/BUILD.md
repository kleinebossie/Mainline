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
session** composed entirely of **references to external resources** (Lichess puzzles selected by
theme + rating, the "redo failed puzzles" flow, books, endgame trainers, master-game collections). It
**logs every outcome** in an append-only tracker, and **adapts** the next session via deterministic
algorithms parameterised by the methodology. It **hosts no exercises, runs no games, and uses no
LLM/AI at runtime.** Every recommendation carries a **"why this / why now"** rationale and an
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
  functions** that turn config + inputs into graded decisions. It ships **now** as a safe **stub
  config** so the whole loop runs end-to-end, and is **swapped** for the research-derived config later
  by adding a file and bumping a version — **no architecture change** (VISION §4).

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
}
```

Every numeric/string **leaf** inside these sub-objects is a `GradedValue<…>` (L3). The per-seam field
shapes (e.g. `DifficultyConfig`, `SchedulingConfig`) are defined seam-by-seam in `METHODOLOGY.md` §2
and §3 and are encoded as Zod schemas under `src/methodology/schema/`. **This document does not
restate those fields' values** (§0.3); it guarantees the _container_ exists and is validated.

### 2.6 The loader

```ts
// Contract (specification). src/methodology/loader.ts
// Configs ship as repo JSON: src/methodology/configs/<version>.json  (e.g. stub-0.1.0.json)
function loadMethodology(version?: string): MethodologyConfig;
//  1. resolve version: explicit arg > env METHODOLOGY_VERSION > "active" pointer (default: latest stub)
//  2. read the JSON file for that version
//  3. validate with the Zod schema (structure + EVERY leaf is a GradedValue) — throw on any violation
//  4. deep-freeze and return a typed, immutable MethodologyConfig
```

Loader rules:

- **Immutable & cached at boot.** Loaded once per process; never mutated. Determinism (L2) depends on
  this.
- **Fail-closed.** An invalid config (missing leaf, bare number, unknown citationKey, bad semver) is a
  **boot error**, not a silent fallback. A stub value is allowed (flagged `stub`); an _ungraded_ value
  is not.
- **Versioned & reproducible.** `Program`, `AdaptationLog`, and `Assessment` persist the
  `methodologyVersion` they were produced under. Any past decision can be re-derived.
- **Active-version selection.** Environment chooses the active config: stub now, research config later.
  Swapping is a one-line env/pointer change + the new JSON file.

### 2.7 Stub config vs research config

|                    | **Stub config (now)**                                                   | **Research config (later)**                                           |
| ------------------ | ----------------------------------------------------------------------- | --------------------------------------------------------------------- |
| File               | `configs/stub-<semver>.json`                                            | `configs/research-<semver>.json`                                      |
| Source of contents | Safe, conservative placeholders; everything flagged `stub`/`best-guess` | `planning/METHODOLOGY.md` (its values/grades/citations/copy, encoded) |
| Purpose            | Make the **entire loop run end-to-end** before research lands           | Tune behaviour + copy to the real science                             |
| Swap cost          | —                                                                       | **One file + one version bump.** No engine change (VISION §4).        |

The stub must be _coherent_, not empty: real band cutoffs, real dimension list, defensible default
targets, and honest copy — all flagged so the transparency UI can say "placeholder." Building against
the stub proves the seams are wired correctly before any number is "true."

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
| `gradeFromOutcome(correct, solveMs, bandMedianMs, cfg)` · `scheduleReview(item, grade, fsrsState, cfg)` | 6           | `fsrsStep` (generic FSRS math) |
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
│  │  ├─ lichess/            #   OAuth2 PKCE, account, game export, puzzle activity
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
│  │  └─ events.ts           #   engagement event bus (plumbing only, §9)
│  ├─ methodology/           # THE METHODOLOGY — the ONE place science enters (§2)
│  │  ├─ schema/             #   Zod schemas for MethodologyConfig + GradedValue (L3)
│  │  ├─ loader.ts           #   loadMethodology() (§2.6)
│  │  ├─ provider.ts         #   the ~18 pure reader functions (§2.8)
│  │  └─ configs/            #   stub-<semver>.json now; research-<semver>.json later (§2.7)
│  ├─ components/            # shadcn UI; ChessBoard; TransparencyCard (rationale/evidence/confidence)
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
  no billing built), `deletedAt?`. Relations: 1—\* everything below.
- **Account / Session / VerificationToken** — **Auth.js standard tables** (OAuth provider, provider
  account id, tokens, expiry). One `User` ↔ many `Account` (Google, Lichess).
- **AllowlistEntry** — closed-beta gate. `email?`, `inviteCode?` (unique), `usedByUserId?`,
  `createdAt`, `expiresAt?`. Sign-in is refused unless the email/code is allowlisted (§12).

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
  (`lichess_puzzle_theme|book|endgame_trainer|study|master_game_collection|video`), `title`,
  `externalUrl?`, `provider`, `metadata` JSON, `methodologyKey?` (links a catalog entry to a Seam-4
  `ActivityDefinition`). 1—\* `ProgramItem`.
- **LichessPuzzle** — ingested open puzzle DB (CC0). PK `puzzleId`; `fen`, `moves`, `rating`,
  `ratingDeviation`, `popularity`, `nbPlays`, `themes` (string[], **GIN-indexed**), `gameUrl`,
  `openingTags` (string[]). Index on `(rating)` and `themes` for theme+rating selection. (Free-tier
  size constraint and mitigation: §12.)

### 5.4 Assessment & constraints

- **Assessment** — onboarding behavioural calibration (Seam 2). `userId`, `completedAt?`,
  `calibrationResponses` JSON, `tacticalRatingEstimate?`, `uncertainty?`, `derivedSkillSeed` JSON,
  `methodologyVersion`. (Self-report is used for constraints/goals only, **never** for skill diagnosis
  — Seam 2.)
- **ConstraintSet** — the user's reality (current + history). `userId`, `minutesPerDay`, `daysPerWeek`,
  `goals` JSON, `ownedResources` (ResourceRef ids), `formatPrefs` JSON, **`ifThenPlan`** JSON
  (`{ cue, plan }` — Seam 9 implementation intention), `isCurrent` (bool), `version`. Latest current
  row feeds the generator.

### 5.5 Program & tracking

- **Program** — a generated plan instance. `userId`, `methodologyVersion`, `status`
  (`active|superseded`), `generationInput` JSON (snapshot of the inputs → reproducibility, L2),
  `createdAt`. 1—\* `ProgramItem`.
- **ProgramItem** — one activity in a day. `programId`, `date`, `orderIndex`, `activityType`,
  `resourceRefId?`, `params` JSON (e.g. `{ theme, targetRating, count, track }`), **transparency
  snapshot** (`rationaleKey`, `rationaleText`, `evidenceGrade`, `evidenceTier`, `citationKey`,
  `confidence`, `soften`), `dimensionsTargeted` (string[]), `status` (`pending|done|skipped`). The transparency
  fields are **denormalised at generation time** (L3) so history is immune to later config bumps. 1—\*
  `ActivityEvent`.
- **ActivityEvent** — **append-only** tracker log (never updated/deleted). `userId`, `programItemId?`,
  `type` (`puzzle_attempt|game_played|drill_done|skip|self_report|…`), `occurredAt`, `payload` JSON
  (`{ correct?, solveTimeMs?, durationMin?, selfReport?, externalRef? }`), `source`. Index `(userId,
occurredAt)`. This is the immutable substrate the adaptation loop reads.
- **SkillState** — per-dimension estimate. `userId`, `dimension` (Seam 1 id), `estimate`,
  `uncertainty`, `sampleSize`, `updatedAt`. Unique `(userId, dimension)`. Updated by the adaptation
  loop via methodology functions; never written with a hardcoded threshold.
- **ScheduleState** — spacing/due state per spaced item (FSRS). `userId`, `itemRef` (puzzle id or
  drill key), `itemType`, **`fsrsState`** JSON (`{ stability, difficulty, due, reps, lapses,
lastReview }`), `lastGrade?`, `source`. Index `(userId, due)` for "what's due today." Math is the
  generic Engine `fsrsStep`; **all parameters from Seam 6 config**.

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
ProgramItem *─1 ResourceRef        ResourceRef *─0..1 ActivityDefinition(methodologyKey)
LichessPuzzle  (global, ingested)  AllowlistEntry (global, beta gate)
MethodologyVersionPointer (per env)
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
machine and persistence; Seam 6 owns the intervals and the outcome→grade mapping.

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

| Step                     | Route / action                                         | Writes                                              | Methodology called                                  | Phase-1 status            |
| ------------------------ | ------------------------------------------------------ | --------------------------------------------------- | --------------------------------------------------- | ------------------------- |
| 1. Sign in               | `(auth)` — Auth.js (Google / Lichess PKCE)             | `User`, `Account`, `Session`                        | —                                                   | built                     |
| 2. Connect platforms     | `onboarding` — Lichess OAuth / Chess.com username      | `PlatformConnection`                                | —                                                   | built                     |
| 3. Background import     | `api/cron` job via `PlatformAdapter.fetchGames`        | `ImportedGame` (idempotent), `ChessProfileSnapshot` | —                                                   | built                     |
| 4. Instant analysis      | analyse ~5 most-recent games client-side; queue rest   | `AnalysisResult` (raw features)                     | — (raw only, L1)                                    | built                     |
| 5. Tactical calibration  | adaptive ladder over Lichess puzzles                   | `Assessment`                                        | `nextCalibrationItem` / `scoreCalibration` (Seam 2) | shell built, content stub |
| 6. Constraints + if-then | `onboarding` form                                      | `ConstraintSet` (incl. `ifThenPlan`)                | `buildImplementationIntention` (Seam 9)             | built                     |
| 7. The "reveal"          | data-driven dashboard contrasting signals vs self-bias | —                                                   | `interpretGameFeatures` (Seam 3)                    | framework built           |
| 8. First program         | `generateProgram(...)` → land on `/today`              | `Program`, `ProgramItem`, `SkillState` seed         | Seams 3→4→5→7→8                                     | built (stub config)       |

Self-report is captured for **constraints/goals/owned resources only** — never for skill diagnosis
(Seam 2). When game history is thin (`<800` / no games), step 5's calibration carries the diagnosis and
a basic board-vision fallback applies (Seam 2 `noHistoryFallback`).

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

## 10. Build order — vertical slices M0–M10

Each milestone is a **vertical slice**: an agent-executable unit with a **typed contract**, **tests**,
and a **Definition of Done** (DoD). Slices ship a runnable increment. Dependency order is linear
(M0→M10); the loop is end-to-end and demoable by **M7**, polished by **M10**.

**Slice template:** _Goal · Depends on · Typed contract (key interfaces introduced) · Tasks · Tests ·
DoD checklist._

### M0 — Scaffold

- **Goal:** a deployable empty app with the toolchain and CI gates.
- **Contract:** `tsconfig` (strict), Prisma datasource, Auth.js base config, `lib/Clock`.
- **Tasks:** Next.js (App Router) + TS strict; Tailwind + shadcn; Prisma + Supabase; Auth.js (Google);
  ESLint/Prettier + L1/L2 lint rules; Vitest + Playwright; GitHub Actions CI; Vercel deploy;
  `next.config.js` COOP/COEP headers; seed `CLAUDE.md`.
- **Tests:** CI runs typecheck + lint + (empty) unit/e2e + build; a smoke Playwright test loads `/`.
- **DoD:** ✅ green CI on push ☐ app deploys to Vercel ✅ Google sign-in works ✅ migrations run on
  Supabase ✅ COOP/COEP headers verified.
- **Status (2026-06-20): nearly done — only Vercel deploy remains.** Repo pushed to GitHub
  (`kleinebossie/Mainline`, private); **GitHub Actions CI is green on `main`** (npm ci · prisma generate ·
  typecheck · lint · unit · guards · `next build` · e2e). CI/`.nvmrc` pinned to Node 25.2.0 (npm 11.6.2)
  to match the lockfile. COOP/COEP headers active; Google OAuth working; `0_init` migration applied to
  Supabase. **Remaining:** deploy to Vercel.

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
- **DoD:** ☐ import is idempotent ☐ snapshots captured ☐ 429/403 handled with back-off ☐ dashboard
  shows imported data.

### M3 — Resource catalog (puzzle DB)

- **Goal:** select external puzzle references by theme + rating.
- **Contract:** `selectPuzzles(theme, ratingTarget, n, cfg): LichessPuzzle[]`; `ResourceRef`.
- **Tasks:** `scripts/ingest-puzzles.ts` (streaming, idempotent, **stratified subset** for free tier,
  §12); theme(GIN)+rating indexes; `ResourceRef` catalog seed.
- **Tests:** unit — selection returns puzzles within rating window and matching theme; ingest is
  idempotent; golden test on a fixed puzzle fixture.
- **DoD:** ☐ stratified DB ingested within free-tier budget ☐ theme+rating query < target latency ☐
  ResourceRefs resolvable to external URLs.

### M4 — Constraints + assessment

- **Goal:** capture the user's reality + a behavioural calibration shell.
- **Contract:** `ConstraintSet` schema (incl. `ifThenPlan`); Seam 2 provider fns
  (`nextCalibrationItem`/`scoreCalibration`) against **stub config**.
- **Tasks:** constraints form; adaptive calibration UI rendering items from config; the "reveal"
  dashboard scaffold.
- **Tests:** unit — `scoreCalibration` golden (fixed responses → fixed estimate+uncertainty);
  constraints Zod validation; e2e — complete calibration + constraints.
- **DoD:** ☐ `ConstraintSet` persisted & current ☐ calibration produces a graded estimate ☐ self-report
  never used for skill (only constraints/goals) ☐ if-then plan captured.

### M5 — Analysis (client-side Stockfish)

- **Goal:** raw features from games, in the browser.
- **Contract:** `AnalysisEngineAdapter` (§6.5); `RawGameFeatures` (§5.2).
- **Tasks:** Stockfish WASM in a Web Worker (multi-thread + single-thread fallback); bounded
  depth/movetime; instant-eval of ~5 recent games + queued backfill; persist `AnalysisResult`.
- **Tests:** unit — feature extraction golden on a known PGN (deterministic at fixed depth); worker
  init under/without cross-origin isolation.
- **DoD:** ☐ raw features computed client-side ☐ **no interpreted field present** (L1 guard passes) ☐
  graceful fallback when threads unavailable ☐ zero server compute.

### M6 — Program engine v0

- **Goal:** a generated "Today" from stub config.
- **Contract:** `generateProgram(...)` (§7.1); Seam 3/4/5/7/8 provider fns (stub).
- **Tasks:** wire interpret→map→prioritise→difficulty→pack→rationale; build `/today` with
  `TransparencyCard` (rationale/evidence/confidence plumbed); persist `Program`/`ProgramItem` with
  snapshots (L3).
- **Tests:** **golden** — fixed inputs + pinned stub version → exact ordered program incl. rationale
  keys + grades; time-budget packing respects `minutesPerDay`; e2e — onboarding → first program.
- **DoD:** ☐ deterministic program (golden green) ☐ every item shows a graded "why" ☐ fits the time
  budget ☐ no science constant in `engine/` (L1 guard green).

### M7 — Tracker + adaptation v0 (loop closes)

- **Goal:** logging an outcome visibly changes the next session.
- **Contract:** `applyEvent(...)`; `runAdaptation(...)` (§7.4); `ScheduleState`/`SkillState`;
  redo-failed-puzzles state machine (§7.5).
- **Tasks:** append-only event logging; FSRS scheduling (generic `fsrsStep` + Seam 6 stub params);
  skill update; regenerate next session; `AdaptationLog`; redo flow.
- **Tests:** **golden** — outcome → FSRS grade → next-due (Seam 6 stub); adaptation changes the next
  program deterministically; e2e — **log activities → next session differs**; redo item reappears
  spaced.
- **DoD:** ☐ end-to-end loop runs (the Phase-1 success criterion, VISION §10) ☐ adaptation is
  deterministic & logged ☐ redo-failed-puzzles works ☐ events are immutable.

### M8 — Transparency UI

- **Goal:** the honesty brand is visible.
- **Contract:** `TransparencyCard`; dashboards for `SkillState`, due items, `AdaptationLog`,
  expectations (Measurement seam).
- **Tasks:** "why this / why now" cards (grade + citation + confidence + `stub` labelling); state
  dashboards; expectations/rating-noise copy surfaced from Seam 8/Measurement.
- **Tests:** unit — a `stub`/Grade-D value renders with its caveat (never as fact), and a C/D-grade
  `RationaleEntry` honors its `soften` flag (copy phrased tentatively); e2e — open a card, see grade +
  rationale; dashboard shows due items & skill estimates.
- **DoD:** ☐ every recommendation explainable in-app ☐ stub/low-grade values visibly flagged (L3) ☐
  skill/schedule/expectations dashboards render.

### M9 — Engagement framework

- **Goal:** event plumbing for motivation (policy stubbed).
- **Contract:** `onStateChange(...)` (§9); `RewardEvent`; `NotificationPref`.
- **Tasks:** event bus; `RewardEvent` persistence; capped notification scheduler; consistency
  grid/forgiving-streak UI fed by stub Seam-9 policy.
- **Tests:** unit — forbidden mechanics never emitted (no global leaderboard, no infinite streak, no
  tangible reward) from stub config; reminder cap respected; e2e — completing a session emits a
  competence event.
- **DoD:** ☐ events fire from state changes ☐ forbid-list enforced by config (not engine) ☐ reminders
  capped & user-configurable.

### M10 — Beta hardening

- **Goal:** safe closed-beta on free tiers.
- **Contract:** allowlist gate; `ApiCallBudget` middleware; PWA manifest/SW.
- **Tasks:** invite/allowlist sign-in gate; per-user external-API rate limits + caching; Sentry;
  minimal privacy-friendly analytics; PWA; perf pass; GDPR export/delete.
- **Tests:** unit — non-allowlisted sign-in refused; rate-limit bucket blocks over-budget calls; e2e —
  invited user completes full loop; data export/delete works.
- **DoD:** ☐ closed-beta gating ☐ within Vercel/Supabase free limits under expected load ☐ errors
  tracked ☐ installable PWA ☐ GDPR export/erase verified.

---

## 11. Research seams — the index that keeps the doc adjustable

Each seam is an **interface defined here**, filled with **stub config now** and **research config
later** (`METHODOLOGY.md`); **none change the architecture** (VISION §4, §9). Contents are in
`METHODOLOGY.md` — this table is the **map**, not the content (§0.3).

| #   | Seam                                       | `MethodologyConfig` field(s)          | Pure function(s) (§2.8)                                       | METHODOLOGY.md anchor | Research source                                                        | Phase-1 |
| --- | ------------------------------------------ | ------------------------------------- | ------------------------------------------------------------- | --------------------- | ---------------------------------------------------------------------- | ------- |
| 1   | Skill dimensions & taxonomy                | `dimensions`, `bands`                 | `dimensionsForBand`                                           | Seam 1                | `SKILL_TAXONOMY.md`                                                    | stub    |
| 2   | Assessment content + scoring               | `assessment`                          | `nextCalibrationItem`, `scoreCalibration`                     | Seam 2                | `WEAKNESS_DIAGNOSIS.md`                                                | stub    |
| 3   | Game-feature → weakness                    | `interpretation`                      | `interpretGameFeatures`, `confidenceFromSampleSize`           | Seam 3                | `WEAKNESS_DIAGNOSIS.md`, `SKILL_TAXONOMY.md`                           | stub    |
| 4   | Weakness/level → resource + params         | `activities`, `weaknessResourceRules` | `mapWeaknessToActivities`                                     | Seam 4                | `WHAT_RAISES_RATING.md`                                                | stub    |
| 5   | Difficulty / calibration targets           | `difficulty`                          | `targetPuzzleRating`, `practiceStructure`, `useWorkedExample` | Seam 5                | `PRACTICE_DESIGN.md`                                                   | stub    |
| 6   | Spacing / scheduling                       | `scheduling`                          | `gradeFromOutcome`, `scheduleReview`                          | Seam 6                | `SPACED_REPETITION.md`                                                 | stub    |
| 7   | Periodisation / prioritisation (daily mix) | `prioritization`                      | `prioritizeDailyMix`, `detectPlateau`                         | Seam 7                | `TRAINING_PROGRAMMING.md`                                              | stub    |
| 8   | Rationale & evidence copy                  | `rationale`, `evidenceLedger`         | `rationaleFor`                                                | Seam 8                | `USER_FACING.md` (multi-seam "why this?" synthesis), `EXPECTATIONS.md` | stub    |
| 9   | Engagement mechanics + guardrails          | `engagement`                          | `engagementEventsFor`, `buildImplementationIntention`         | Seam 9                | `MOTIVATION.md`                                                        | stub    |
| —   | Measurement & expectations (cross-cutting) | `measurement`                         | `isProgressReal`, `isStableBaseline`, `expectationForBand`    | Measurement           | `EXPECTATIONS.md`                                                      | stub    |

Updating any seam = a `MethodologyConfig` edit + a version bump. **The Engine, the data model, and the
contracts above do not move.**

---

## 12. Cost & abuse guardrails

- **Closed-beta allowlist** (`AllowlistEntry`) — bounded user count keeps usage inside free tiers.
- **OAuth-only** — no passwords to store or leak; Lichess PKCE has no client secret.
- **Client-side chess engine** — Stockfish runs in the user's browser; **there is no server compute to
  abuse** and ~zero compute cost.
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
`selectPuzzles`, feature extraction.

### 13.2 Playwright e2e for the core loop

One canonical journey, run against a built app with a seeded test DB and a **Lichess test account**:
**sign in → connect → import → calibration + constraints → first program → log activities → confirm the
next session changed** (the Phase-1 success criterion, VISION §10). Plus: redo-failed-puzzle reappears
spaced; transparency card shows grade + rationale; export/delete works.

### 13.3 CI gates (the agent's safety net)

GitHub Actions on every push/PR, **all required green** before merge:
`typecheck (tsc --noEmit)` → `lint (eslint, incl. L1/L2 rules)` → `unit (vitest run)` →
`build (next build)` → `e2e (playwright)` → `guards`. Branch protection enforces it.

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
- **In-app chess play / hosted exercises / any hosted content** — everything points outward.
- **LLM / AI features in the product** — none at runtime.
- **Opening-repertoire trainers.**
- **Server-side / large-scale engine analysis** — analysis stays client-side (§12).
- **Chess.com OAuth login** — username-only read import (§6.3); revisit only if access is granted.

---

_This document is the authoritative technical blueprint. It defines the Engine and the
`MethodologyConfig` schema/loader; the science that fills the seams lives in `planning/METHODOLOGY.md`
and is referenced here, never duplicated. The three architectural laws (§0.1) — science only in config,
pure & deterministic decisions, evidence never stripped — are the product, not the packaging. When the
build adds code, keep this doc and `CLAUDE.md` in sync, and update §3/§4/§10 as reality lands._
