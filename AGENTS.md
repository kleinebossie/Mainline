# AGENTS.md

Compact cheat sheet for working in this repo. For deeper context see `CLAUDE.md` and `planning/BUILD.md`.

## Setup

```
nvm use                          # Node 25.2.0 (npm 11) — npm 10 mis-prunes the lockfile
cp .env.example .env.local      # Fill DATABASE_URL, AUTH_SECRET, Google OAuth, CRON_SECRET
npm ci
npm run prisma:migrate           # Only needed first time / after schema changes
```

## Commands

```
npm run dev                      # predev runs stockfish setup first
npm run build                    # prisma generate → next build (required on clean checkout)
npm run typecheck                # tsc --noEmit (strict + noUncheckedIndexedAccess)
npm run lint                     # eslint (includes L2 guard: no Date.now/Math.random in engine/methodology)
npm test                         # all Vitest (unit + guards)
npm run test:unit                # vitest run tests/unit
npx vitest run tests/unit/puzzles/select.test.ts          # single file
npx vitest run -t "<test name>"                           # single test
npm run test:guards              # architecture + methodology-config + raw-features guards
npm run test:e2e                 # Playwright — requires `npm run build` first (uses npm run start)
npx playwright test tests/e2e/onboarding.spec.ts          # single spec
npm run format                   # prettier --write . (semi, double quotes, trailing commas)
npm run prisma:generate          # regenerate PrismaClient types (run after schema changes)
```

## Architecture (load-bearing)

**Engine vs Methodology separation** — the most important design rule:

- `engine/`, `analysis/`, `server/`, `app/` consume methodology **only through `@/methodology`** (`src/methodology/index.ts`). Never deep-import from `@/methodology/{loader,provider,schema,configs}`.
- `methodology/` imports only `lib/` and `engine/math`. Never the reverse.
- `db/` has no business logic. `app/`/`server/` orchestrate, they don't decide graded choices.

**Three laws** (enforced by `tests/guards/` + eslint):

1. **L1**: No chess/learning constants outside `methodology/configs/` — guard: `tests/guards/architecture.test.ts`
2. **L2**: No `Date.now()`, `new Date()`, or `Math.random()` in `engine/` or `methodology/` — inject a `Clock` (`src/lib/clock.ts`) instead. Guard: eslint `no-restricted-syntax` + `tests/guards/architecture.test.ts`
3. **L3**: Every methodology leaf value is a `GradedValue` (grade A/B/C/D + tier + citation). Guard: `tests/guards/methodology-config.test.ts`

**Naming**: "Engine" = the generic machinery in `src/engine/`. "Stockfish/chess engine" = the WASM analysis engine. Never call the Engine "the chess engine."

## Gotchas

- **Prisma CLI doesn't auto-load `.env.local`** — `prisma.config.ts` handles this via dotenv. If you run `prisma` commands directly, ensure DATABASE_URL is in env.
- **Stockfish WASM requires cross-origin isolation** — `next.config.mjs` sets COOP/COEP headers for SharedArrayBuffer support. Don't remove these headers.
- **`prisma generate` must run before `tsc`** — the build script does this, but if you typecheck in isolation after a schema change, run `npm run prisma:generate` first.
- **E2E tests use `npm run start`** (production server), not dev. Build before running e2e.
- **No LLM/AI at runtime, no hosted copyrighted content, no social/multiplayer, no payments** — Phase 1 scope is strictly personal training tools over open data.
- **CI order is strict**: `typecheck → lint → unit → guards → build → e2e`. All must be green.
- `tsx` is used for CLI scripts; `superjson` for tRPC transport; `react-chessboard` for the board UI; `chess.js` for move validation.
