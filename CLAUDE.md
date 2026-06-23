# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this repository is

This is the source code repository for a chess training app. It contains the Next.js application code, the test suite, the build system, and the underlying planning and research documents.

- `src/` — application source code (Next.js app router, React components, Engine logic, Methodology config).
- `tests/` — unit, e2e, and architecture guard tests.
- `prisma/` — Prisma schema for the database.
- `planning/` — product intent. `VISION.md` is the authoritative source (read it first).
  `SHIPPING.md` (Phase 2) and `GROWTH.md` (Phase 3) are placeholders/empty. `BUILD.md` is the
  technical plan (stack, data model, repository layout, build order M0–M15, and the 9 "research
  seams"); it defines the generic **Engine** and the **`MethodologyConfig`** schema/loader.
  `METHODOLOGY.md` is the science that fills those seams (values, grades, citations, copy).
- `research/` — the evidence base (the _onderzoek_ phase). Long, citation-heavy reports that become
  the app's **Methodology layer**. `RESEARCH_PROMPT.md` is the brief that generated them; the others
  (`SKILL_TAXONOMY.md`, `WEAKNESS_DIAGNOSIS.md`, `WHAT_RAISES_RATING.md`, `PRACTICE_DESIGN.md`,
  `SPACED_REPETITION.md`, `TRAINING_PROGRAMMING.md`, `GAME_ANALYSIS.md`, `USER_FACING.md`,
  `MOTIVATION.md`, `EXPECTATIONS.md`, `2D_VS_3D.md` (2D/3D modality + OTB transfer), `BEST_BOOKS.md`
  (evidence-based book study)) are the resulting reports, one per research question.

## Commands

Node is pinned by `.nvmrc` (CI mirrors it exactly — npm 11; an older npm mis-prunes the lockfile and
breaks `npm ci`). Run `nvm use` first. Copy `.env.example` → `.env.local` and fill `DATABASE_URL`
(Supabase), `AUTH_SECRET`, Google OAuth, and `CRON_SECRET` before `dev`/`build`.

- **Dev server:** `npm run dev` (http://localhost:3000)
- **Build:** `npm run build` (runs `prisma generate` first — required on a clean checkout/CI)
- **Typecheck:** `npm run typecheck` (`tsc --noEmit`; strict + `noUncheckedIndexedAccess`)
- **Lint / format:** `npm run lint` · `npm run format` (`npm run format:check` in CI)
- **All Vitest:** `npm test` — or scope with `npm run test:unit` / `npm run test:guards`
- **One unit test:** `npx vitest run tests/unit/puzzles/select.test.ts` (by file) or
  `npx vitest run -t "<partial test name>"` (by name); drop `run` for watch mode
- **E2E (Playwright):** `npm run test:e2e` — one spec: `npx playwright test tests/e2e/onboarding.spec.ts`
  (or `-g "<title>"`)
- **DB:** `npm run prisma:migrate` (dev) · `npm run prisma:generate` · `npm run prisma:deploy` (prod)
- **Puzzle DB / resources:** `npm run ingest:puzzles` (Lichess puzzle-DB → `LichessPuzzle`) ·
  `npm run seed:resources` · `npm run check:puzzles`

## The product in one paragraph

A web app that generates and continuously adapts a **personalized, science-based, no-BS chess
training program**. It is **internal-first, external where it must be** (VISION §1/§8): training that
can be done well from **open data + a client-side chess engine** is done **in-app** with precise
auto-tracked outcomes (puzzles, blunder drills, game review, endgames — M10–M14), while activities
that can't or shouldn't be internalised stay **references to external resources** (playing real
games, copyrighted books/courses — recommended + logged). It **hosts no copyrighted content, runs no
competing game-play platform, and uses no LLM/AI at runtime**, and tracks outcomes to re-prioritize
the next session. It must work across **all rating bands** and is multi-user from day one
(personal-first, public-ready).

## The architectural idea that governs everything

The single most important design rule (`VISION.md` §4): **separate the generic Engine from the
Methodology.**

- **Engine** — generic, deterministic machinery (accounts/imports, user profile + constraints, game
  analysis, program generator, tracker, adaptation loop, transparency UI). It contains **no
  chess/learning knowledge of its own.** Build this first, with placeholder methodology so the whole
  loop runs end-to-end.
- **Methodology** — the actual science from `research/`, plugged in as a **versioned
  `MethodologyConfig`** (rules, parameters, copy). Science enters the system in **exactly one place**
  and is swapped in later **without re-architecting anything.**

When writing code, never hardcode chess knowledge, rating assumptions, or anything personal to the
builder into the Engine — it lives in data/config. This is what keeps "works for me" → "works for
the public" a change of degree, not a rewrite.

## The three architectural laws (enforced in CI)

The split above is operationalized as three laws (`BUILD.md` §0.1), machine-checked by `tests/guards/`.
Treat them as hard constraints in any code:

- **L1 — science only in `methodology/`.** The Engine (`engine/`, `analysis/`, `server/`, `app/`)
  consumes methodology **only through the `@/methodology` surface** (`src/methodology/index.ts`) —
  never deep-import `@/methodology/{loader,provider,schema,configs}`, and keep no chess/learning
  constants outside config. Guarded by `tests/guards/architecture.test.ts`.
- **L2 — decisions are pure & deterministic.** Code in `engine/` and `methodology/` takes an injected
  `Clock` (`src/lib/clock.ts`) and explicit seeds — no `Date.now()`, `new Date()`, or `Math.random()`.
  Same guard fails the build on any occurrence.
- **L3 — every methodology value is graded.** Every leaf of a `MethodologyConfig` is a `GradedValue`
  (grade A/B/C/D + tier + citation). The loader validates structure + grading + citation resolution
  against the Zod schema, deep-freezes, caches, and **fails closed** (a bad config is a boot error,
  never a silent default). Guarded by `tests/guards/methodology-config.test.ts`.

**Import direction is load-bearing:** `engine`/`analysis` may import `methodology` (types + provider
fns) and `lib`, **never the reverse**; `methodology` imports only `lib` and `engine/math`; `db/` holds
no business logic; `app`/`server` orchestrate, they don't decide graded choices.

## How the implemented code is organized

One Next.js App Router app under `src/`. Request flow: **`app/` (server + client components) →
`server/` (tRPC) → domain logic + persistence.**

- **`src/app/`** — routes: the onboarding flow (`connect → import → assess → constraints → reveal`),
  `dashboard/`, `connections/`, and API route handlers `api/trpc/[trpc]`, `api/auth/[...nextauth]`,
  `api/cron/import` (Vercel Cron, `CRON_SECRET`-gated).
- **`src/server/`** — the typed API. `routers/_app.ts` composes one router per domain
  (`connections`, `import`, `assessment`, `constraints`) into `AppRouter`; `trpc.ts` defines
  `protectedProcedure` (the auth gate that narrows `ctx.userId`) and superjson transport. Sibling
  service modules (`assessment.ts`, `import.ts`, …) hold orchestration; `auth.ts` is NextAuth v5
  (Google + Lichess PKCE).
- **`src/methodology/`** — the one science seam (see the laws). `configs/stub-0.1.0.json` is the active
  placeholder; a `research-*.json` swaps in later with no Engine change.
- **`src/integrations/`** — `PlatformAdapter` interface + `lichess/` and `chesscom/` (read-only PubAPI,
  username-only) adapters, PGN/dedupe helpers, and `puzzles/` (parse + stratify the Lichess puzzle DB).
- **`src/db/`** — Prisma client singleton + typed query helpers, no business logic. Schema in
  `prisma/schema.prisma` (Auth.js tables; `PlatformConnection`/`ChessProfileSnapshot`/`ImportedGame`/
  `JobRun`; `LichessPuzzle`/`ResourceRef`; `Assessment`/`ConstraintSet`).
- **`src/engine/`** — generic deterministic machinery (generator, adaptation, tracker, `math/`);
  largely arrives M5+, kept science-free. **`src/lib/`** — shared utils incl. the injectable `Clock`.

## Conventions that constrain the work

These come from `VISION.md` and the research brief; honor them in any code or recommendation:

- **No LLM/AI inside the product.** (AI agents build it; the running product uses none.)
- **No competing game-play platform, no hosted copyrighted content, no social/multiplayer, no
  payments/native apps in Phase 1.** In-app **training** surfaces (puzzles, drills, game review,
  endgames vs the engine, over open data) _are_ in scope (M10–M14); human-vs-human/rated play stays
  external, and books/courses are recommended + logged, never hosted. Stay multi-user and
  billing-_capable_, but don't build billing yet.
- **Radical honesty is a feature, not copy.** Every recommendation carries an **evidence grade**
  (A = strong/replicated, B = suggestive/limited, C = theory/expert opinion, D = popular but
  unsupported myth) and a user-facing "why this / why now" rationale. Do not overstate evidence or
  promise rating gains.
- **English** for documents and code. Free-infrastructure tiers only (Phase 1 targets personal use →
  closed free beta).

## Verification & current build status

CI (`.github/workflows/ci.yml`) runs, in order: **`typecheck → lint → unit → guards → build → e2e`**.
"Done" means all green — that's the contract for every change.

The app is built as vertical slices **M0–M15** (`BUILD.md` §10). Shipped so far: **M0** scaffold,
**M1** identity & connections, **M2** import & profile, **M3** resource catalog, **M4** constraints &
assessment, **M5** client-side Stockfish analysis → raw features, **M6** program engine v0 (generator +
Seams 1/3/4/5/7/8 stub config → a graded, budget-fitted `/today`), **M7** tracker + adaptation v0 — the
loop closes: logging an outcome (Seam 6 FSRS + Seam 7/Measurement) reschedules, updates skill, and
regenerates a changed `/today`, all in a graded `AdaptationLog`. **M8** transparency UI — the honesty
brand made visible (graded "why" cards + state/expectations dashboards). **M9** engagement framework —
Seam-9 event plumbing (`onStateChange` → `RewardEvent`) with a forgiving capped streak, consistency
grid, competence recognition, and capped reminders; the forbid list (no infinite streaks/leaderboards/
tangible rewards) is enforced _by config_, not the Engine. **M10** interactive board substrate — the
generic, science-free in-app board (`InteractiveBoard` + the pure `stepSolve` solve-session state
machine + an injected-adapter `engine-play` Stockfish opponent), with `ProgramItem` resolving internal
(`/train/...`) vs external by the graded Seam-4 `delivery` flag (data, not an engine branch); demoed at
`/train`. **Next: the internal-first arc continues M11–M14** — internalise what we can (VISION §1/§8):
**M11** in-app puzzles + internalised tactical assessment (+ the §7.5 redo hint/retest + the §4.4(c)
anti-arrow/anti-hover/eval-bar board affordances), **M12** interactive game review + personalised
blunder drills, **M13** in-app endgame drills (vs the engine, + Lichess tablebase), **M14** recommended
resources + **book-study & 2D/3D-modality/OTB-calibration protocols** + in-app logging (books/courses/
real games stay external; guidance from `BEST_BOOKS.md`/`2D_VS_3D.md`). These add **no new seam** — only
generic Engine surfaces + graded Seam-4 `ActivityDefinition`s with a `delivery: 'internal' | 'external'`
flag (now also the visual-modality / OTB-calibration / book-study config) — and **no LLM**. A new
`ConstraintSet.targetFocus` (`online | otb | hybrid`, self-report) drives the modality/OTB
recommendations and the board interface restrictions, landing with its consumers in M11/M14. **M15** —
beta hardening (was M10).
`planning/BUILD.md` is the source of truth these notes summarize; the `build-slice`
skill drives a milestone end-to-end.

## Working with the research reports

The reports are evidence-graded and deliberately distinguish **Tier 1** (chess-specific, mostly
observational/weak) from **Tier 2** (strong general learning-science, extrapolated to chess). The
central honest caveat to preserve everywhere: **no study has shown any training activity _causes_ a
measured rating gain** — design and copy must not pretend otherwise. When extracting parameters into
config (success-rate targets, FSRS intervals, difficulty offsets, daily volumes, per-band
directives), carry the grade and citation with the number; don't strip the evidence from the value.
