# AGENTS.md — Developer AI Orientation

## 1. Product Summary & Scope

Mainline is a **personalized, science-based, no-BS chess training app** that adapts to a user's constraints, games, and goals.

- **Core Concept**: It decides _what to train, when, and why_, rather than being just another puzzle trainer.
- **In-App Training**: Interactive drills (puzzles, blunder practice, endgames, game review) run in-app via client-side Stockfish WASM.
- **External References**: Real gameplay (Lichess/Chess.com) and copyrighted books/courses stay external; recommended + logged in-app.
- **Strict Boundaries (Phase 1)**: Multi-user, billing-capable, free patronage model (AGPL-3.0). No runtime LLM/AI. No gameplay server/multiplayer/social features. No hosted copyrighted content.
- **More Context**: See [VISION.md](file:///home/joebos/programming/Mainline/planning/VISION.md) (intent) and [BUILD.md](file:///home/joebos/programming/Mainline/planning/BUILD.md) (technical plan).

## 2. Core Architecture: Engine ⟷ Methodology Split

The codebase is strictly divided to isolate chess/learning logic from orchestrating machinery.

- **The Engine** (`src/engine/`, `src/analysis/`, `src/server/`, `src/app/`, `src/db/`): Science-free, deterministic machinery. Does not decide graded choices.
- **The Methodology** (`src/methodology/`): The science itself, plugged in as a versioned config (`MethodologyConfig` JSON) + pure reader functions. Swapped without re-architecting anything.

### The Three Laws (CI-enforced by [tests/guards](file:///home/joebos/programming/Mainline/tests/guards))

- **L1 (Science in Config)**: The Engine contains no chess/learning constants. It consumes methodology only through the typed surface `@/methodology` ([index.ts](file:///home/joebos/programming/Mainline/src/methodology/index.ts)). No internal deep-imports.
- **L2 (Pure & Deterministic)**: Generator, adaptation loop, and methodology functions are pure. No `Date.now()`, `new Date()`, or `Math.random()`. Inject a `Clock` ([clock.ts](file:///home/joebos/programming/Mainline/src/lib/clock.ts)) or seed.
- **L3 (Graded Evidence)**: Every methodology leaf is a `GradedValue<T>` (grade A/B/C/D + tier 1/2 + citation). Rationale text is snapshotted onto each `ProgramItem` at generation time to preserve history.

## 3. Directory Layout

- `src/app/` — Next.js App Router UI pages & components.
- `src/server/` — Typed API (`routers/_app.ts` via tRPC) and protected procedures.
- `src/db/` — Prisma Client singleton and typed query helpers; contains zero business logic.
- `src/integrations/` — `PlatformAdapter` (Lichess/Chess.com), PGN/dedupe, and puzzle/tablebase clients.
- `src/engine/` — Spacing (FSRS), Glicko-2 CI arithmetic, and time-budget packing algorithms.
- `src/methodology/` — Config schemas, loader, provider pure functions, and configs JSON.
- `planning/` — Authoritative docs: `VISION.md` (intent), `BUILD.md` (tech plans/seams), `METHODOLOGY.md` (exact science values).
- `research/` — Citation-heavy research reports.

## 4. Setup & Core Commands

Ensure you use Node 25.2.0 (npm 11) using `nvm use`. Older versions corrupt the lockfile.

```bash
cp .env.example .env.local       # Fill DATABASE_URL, AUTH_SECRET, Google OAuth, CRON_SECRET
npm ci
npm run prisma:migrate           # Run on setup and schema changes
```

### Script Registry

- `npm run dev` — Dev server (runs predev Stockfish WASM setup first)
- `npm run build` — Builds app (runs `prisma generate` first)
- `npm run typecheck` — TypeScript check (`tsc --noEmit`)
- `npm run lint` — ESLint checks (guards against L2 violations)
- `npm test` — Run all Vitest tests (unit + architectural guards)
- `npm run test:guards` — Specifically runs architecture/methodology guard tests
- `npm run test:e2e` — Playwright tests (build first; uses npm run start)
- `npm run format` — Code formatting with Prettier
- `npm run ingest:puzzles` — Ingests a subset of Lichess puzzle DB into `LichessPuzzle`
- `npm run seed:resources` — Seeds the `ResourceRef` catalog
- `npm run check:puzzles` — Runs checks on ingested puzzles

## 5. Development Gotchas & Guidelines

- **Prisma Schema Changes**: Run `npm run prisma:generate` before running typecheck/build. Prisma CLI doesn't auto-load `.env.local` — environment variables must be exported/present in the shell.
- **Stockfish WASM Isolation**: App relies on `SharedArrayBuffer`. Do not touch or disable COOP/COEP headers in `next.config.mjs`.
- **Database & Limits**: Puzzle database is huge. Do not run heavy queries on `LichessPuzzle` without filtering. Cache tablebase calls in `TablebaseCache` (limited to ≤7 pieces) to respect external APIs.
- **CI Pipeline**: Order is strictly: `typecheck → lint → unit → guards → build → e2e`. All must pass before merging.
- **No Runtime AI**: Never introduce LLM/AI inside the application logic.
- **No Em-Dashes**: Never use em-dashes (`—`) in code, comments, copy, or docs. They are a telltale sign of AI authorship. Use commas, colons, semicolons, or split into separate sentences to keep grammar correct.
