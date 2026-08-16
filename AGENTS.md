# AGENTS.md: Developer AI Orientation

## 1. Product Summary and Scope

Mainline is a personalized, science-based chess training app. It generates and continuously adapts a daily training program.

- **In-App Drills**: Interactive puzzles, blunder practice, game review, and endgames run in-browser via Stockfish WASM.
- **External References**: Real gameplay and books stay external. The app recommends and logs them.
- **Boundaries**: Open source (AGPL-3.0). Multi-user and billing-ready. No runtime AI/LLM. No gameplay server or multiplayer. No hosted copyrighted content.
- **Context Docs**: Read [VISION.md](file:///home/joebos/programming/Mainline/planning/VISION.md) for product intent, [BUILD.md](file:///home/joebos/programming/Mainline/planning/BUILD.md) for technical plans, and [OPERATIONS.md](file:///home/joebos/programming/Mainline/planning/OPERATIONS.md) for production operations.

## 2. Core Architecture: Engine vs Methodology Split

The codebase separates generic application machinery from chess learning science.

- **The Engine** (`src/engine/`, `src/analysis/`, `src/server/`, `src/app/`, `src/db/`): Science-free, deterministic code.
- **The Methodology** (`src/methodology/`): The chess learning science. It is plugged in as versioned JSON configs plus pure reader functions.

### The Three Architectural Laws (CI Enforced)

- **L1 (Science in Config)**: The Engine contains no chess or learning constants. Consume methodology only through `@/methodology` ([index.ts](file:///home/joebos/programming/Mainline/src/methodology/index.ts)). Do not use internal deep-imports.
- **L2 (Pure and Deterministic)**: Generator and adaptation functions are pure. Never call `Date.now()`, `new Date()`, or `Math.random()`. Inject a `Clock` ([clock.ts](file:///home/joebos/programming/Mainline/src/lib/clock.ts)) or explicit seed.
- **L3 (Graded Evidence)**: Every methodology leaf is a `GradedValue<T>` (grade, tier, citation). Program items snapshot their rationale at generation time to preserve history.

## 3. Directory Layout

- `src/app/`: Next.js App Router UI pages and API route handlers.
- `src/server/`: tRPC routers and protected API procedures.
- `src/db/`: Prisma Client singleton and database query helpers. Contains zero business logic.
- `src/engine/`: Spacing (FSRS), Glicko-2 arithmetic, and session-budget algorithms.
- `src/integrations/`: Platform adapters (Lichess, Chess.com) and puzzle/tablebase clients.
- `src/methodology/`: Versioned configs, schemas, and pure reader functions.
- `planning/`: Authoritative plans and operational runbooks.
- `research/`: Citation-heavy evidence reports and literature reviews.
- `tests/`: Unit tests, architecture guards, and Playwright end-to-end tests.

## 4. Setup and Commands

Use Node 25.2.0 (npm 11) via `.nvmrc`.

```bash
cp .env.example .env.local
npm ci
npm run prisma:migrate
```

### Essential Scripts

- `npm run dev`: Start local development server.
- `npm run build`: Build production bundle (runs `prisma generate` first).
- `npm run typecheck`: Run TypeScript checks (`tsc --noEmit`).
- `npm run lint`: Run ESLint checks.
- `npm test`: Run all Vitest unit and guard tests.
- `npm run test:guards`: Run architecture guard tests.
- `npm run test:e2e`: Run Playwright end-to-end tests.
- `npm run format`: Format code with Prettier.
- `npm run prisma:migrate`: Apply database migrations in local development.
- `npm run prisma:deploy`: Apply migrations in production or CI.
- `npm run beta:invite`: Create beta user invite codes.

### E2E Testing Requirement

Playwright tests require a production build (`npm run build`) and `PLAYWRIGHT_DATABASE_URL` pointing to a disposable database (for example, `postgresql://postgres:postgres@localhost:5432/mainline_e2e`).

When you run E2E tests locally:

1. Start a local Postgres container: `docker run -d --name mainline-playwright-db -e POSTGRES_PASSWORD=postgres -e POSTGRES_DB=mainline_e2e -p 5432:5432 postgres:16-alpine`
2. Apply migrations: `PLAYWRIGHT_DATABASE_URL="postgresql://postgres:postgres@localhost:5432/mainline_e2e" npx prisma migrate deploy`
3. Build the app: `npm run build`
4. Run tests: `PLAYWRIGHT_DATABASE_URL="postgresql://postgres:postgres@localhost:5432/mainline_e2e" npm run test:e2e`

Never report that E2E tests passed if the command exited early without running tests.

## 5. Git, Branching, and Release Strategy

### Branch Strategy

- `main`: Production branch. Merges deploy immediately to live production. Protect this branch on GitHub.
- `feat/<name>`: New feature work.
- `fix/<name>`: Bug fixes and maintenance.
- `hotfix/<name>`: Urgent production fixes branched directly from `main`.

### Continuous Deployment with Human Gatekeeper

Every merge to `main` deploys directly to production. Because of this rule:

- **Agents must NEVER push directly to `main`.**
- **Agents must NEVER merge a pull request without explicit user confirmation.**
- Always do work on short-lived branches (`feat/*`, `fix/*`, `hotfix/*`).
- Open a pull request, verify that CI tests pass, and present the PR to the user for final approval.

### Standard PR Workflow

1. Before starting, update your local `main`:
   ```bash
   git checkout main
   git pull origin main
   ```
2. Create a branch:
   ```bash
   git checkout -b feat/<name>
   ```
3. Make changes and verify locally:
   ```bash
   npm run typecheck
   npm run lint
   npm test
   ```
4. Push and open a pull request against `main`.
5. Verify that CI passes on the PR preview.
6. Ask the user for review. The user merges with **Squash and merge**.

### Optional Milestone Versioning

Do not bump version numbers for routine daily changes. Git commit hashes track every deployment automatically.

Only bump the version in [package.json](file:///home/joebos/programming/Mainline/package.json) and create a Git tag for major user announcements or milestone releases:

```bash
# For a milestone release:
npm version minor -m "chore(release): v%s"
git push origin main --tags
```

### Emergency Hotfix Workflow

1. If production breaks, branch directly from `main`:
   ```bash
   git checkout main
   git pull origin main
   git checkout -b hotfix/<name>
   ```
2. Apply fix and verify all tests pass locally.
3. Open a PR, verify CI passes, and request user review to merge to `main`.

## 6. Production and Environment Safeguards

- **Local Database Isolation**: Agents must only connect to local development databases or disposable test databases (`mainline_e2e`).
- **No Direct Production Database Access**: Never connect directly to the live production database. Never execute raw queries, mutations, or migrations against production from agent tools.
- **No Destructive Database Commands**: Never run `prisma migrate reset` or `prisma db push --force-reset` on shared or production environments.
- **No Direct Deployments**: Never trigger production deployments from CLI (e.g. `vercel --prod`). Production deployments must only run through automated CI when the human owner merges to `main`.
- **Secret Protection**: Never print, log, or commit secret environment variables (`AUTH_SECRET`, `CRON_SECRET`, database passwords, or OAuth tokens).
- **No Live Mutations**: Never send real emails, generate real invite codes against production, or trigger live webhooks without explicit user instruction.

## 7. Database Operations

- **Development migrations**: Run `npm run prisma:migrate` to create and apply new migrations locally.
- **Production deployments**: Run `npm run prisma:deploy` to apply existing migrations safely.
- **Safe migration rule**: Make schema changes backward-compatible. Add columns with defaults or make them optional. Never rename or drop active columns in one step.
- **Beta invitations**: Run `npm run beta:invite -- --email=user@example.com` or `npm run beta:invite -- --expires-days=14`.
- **Job recovery**: Monitor and retry failed background jobs in admin Settings or trigger `/api/cron/daily`.
- **Privacy purges**: Account deletion queues an `account_purge` job. It hard-deletes user rows and preserves an opaque token in `AccountPurgeLedger`.

## 8. Hard Development Rules

- **No Unauthorized Merges**: Never push directly to `main` or merge a PR without explicit user permission.
- **No Em-Dashes**: Never use em dashes (unicode U+2014) in code, comments, copy, or markdown docs. Use colons, commas, semicolons, or separate sentences.
- **No Runtime AI**: Never introduce LLM or AI inference into runtime application logic.
- **Strict CI Order**: The build pipeline runs `typecheck -> lint -> unit -> guards -> build -> e2e`. All checks must pass before merging.
- **WASM Isolation**: Keep COOP and COEP headers intact in [next.config.mjs](file:///home/joebos/programming/Mainline/next.config.mjs) for client Stockfish multi-threading.
- **External API Limits**: Respect rate limits for Lichess, Chess.com, and Tablebase. Cache external calls in database cache tables.
