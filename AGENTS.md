# AGENTS.md: Developer AI Orientation

This document is the primary orientation for AI agents working on Mainline.

## Context Pointers

Load these documents when executing specific branches:

- **Vision and Product Intent**: Read [VISION.md](file:///home/joebos/programming/Mainline/planning/VISION.md) to understand product boundaries, brand honesty, and commercial intent.
- **Technical Plan and Seams**: Read [BUILD.md](file:///home/joebos/programming/Mainline/planning/BUILD.md) to inspect typed engine contracts, data schemas, and the 0-to-1 build specification.
- **Feature Roadmap**: Read [FEATURE_ROADMAP.md](file:///home/joebos/programming/Mainline/planning/FEATURE_ROADMAP.md) to check feature sequence, part definitions, and acceptance gates.
- **Learning Science**: Read [METHODOLOGY.md](file:///home/joebos/programming/Mainline/planning/METHODOLOGY.md) to inspect evidence-graded parameters, research seams, and rationale copy.
- **Production Operations**: Read [OPERATIONS.md](file:///home/joebos/programming/Mainline/planning/OPERATIONS.md) to execute migrations, beta invites, job recovery, and research exports.
- **Release Management**: Read [SHIPPING.md](file:///home/joebos/programming/Mainline/planning/SHIPPING.md) to verify readiness gates and deployment checklists.
- **User Growth**: Read [GROWTH.md](file:///home/joebos/programming/Mainline/planning/GROWTH.md) to review acquisition ethics and feedback loops.
- **Beta Prioritization Plan**: Read [BETA_PRIORITIZATION_PLAN.md](file:///home/joebos/programming/Mainline/planning/BETA_PRIORITIZATION_PLAN.md) to inspect the 3-phase growth and conversion roadmap.

---

## 1. Product Summary and Scope

Mainline is a personalized chess training application based on learning science. It generates and adapts a daily training program.

- **In-App Training**: Solve puzzles, drill blunders, review games, and practice endgames in the browser using Stockfish WASM.
- **External Training**: Play real games and read chess books externally. The app recommends and logs external activities.
- **System Boundaries**: Open source under AGPL-3.0. Multi-user and billing-ready architecture. No runtime LLM or AI inference. No gameplay server or multiplayer. No hosted copyrighted content.

---

## 2. Core Architecture: Engine vs Methodology

The codebase separates generic application mechanics from chess learning science.

- **The Engine** (`src/engine/`, `src/analysis/`, `src/server/`, `src/app/`, `src/db/`): Science-free, deterministic application code.
- **The Methodology** (`src/methodology/`): The chess learning science. Methodology is loaded as versioned JSON configuration files and pure reader functions.

### The Three Architectural Laws

These three laws are enforced by automated CI guards:

1. **L1 (Science in Config)**: The Engine contains no chess or learning constants. Consume methodology only through `@/methodology` ([index.ts](file:///home/joebos/programming/Mainline/src/methodology/index.ts)). Do not use internal deep imports.
2. **L2 (Pure and Deterministic)**: Generator and adaptation functions must be pure. Never call `Date.now()`, `new Date()`, or `Math.random()`. Inject a `Clock` ([clock.ts](file:///home/joebos/programming/Mainline/src/lib/clock.ts)) or an explicit seed.
3. **L3 (Graded Evidence)**: Every methodology leaf value must use the `GradedValue<T>` shape with grade, tier, and citation. Program items snapshot their rationale at generation time to preserve history.

---

## 3. Directory Layout

- `src/app/`: Next.js App Router pages and API route handlers.
- `src/server/`: tRPC routers and protected API procedures.
- `src/db/`: Prisma Client singleton and database query helpers with zero business logic.
- `src/engine/`: Spacing algorithms (FSRS), Glicko-2 arithmetic, and session budget logic.
- `src/integrations/`: Platform adapters (Lichess, Chess.com) and puzzle or tablebase clients.
- `src/methodology/`: Versioned configuration schemas, JSON datasets, and pure reader functions.
- `planning/`: Authoritative plans, roadmaps, and operational runbooks.
- `research/`: Evidence reports and literature syntheses.
- `tests/`: Unit tests, architecture guards, and Playwright end-to-end tests.

---

## 4. Setup and Commands

Use Node 25.2.0 (npm 11) specified in `.nvmrc`.

```bash
cp .env.example .env.local
npm ci
npm run prisma:migrate
```

### Primary Scripts

- `npm run dev`: Start the local development server.
- `npm run build`: Build the production bundle (runs `prisma generate` first).
- `npm run typecheck`: Run TypeScript type verification (`tsc --noEmit`).
- `npm run lint`: Run ESLint checks.
- `npm test`: Run all Vitest unit and architecture guard tests.
- `npm run test:guards`: Run architecture boundary tests.
- `npm run test:e2e`: Run Playwright end-to-end tests.
- `npm run format`: Format code with Prettier.
- `npm run prisma:migrate`: Apply database migrations in local development.
- `npm run prisma:deploy`: Apply migrations in production or CI.
- `npm run beta:invite`: Generate beta user invite codes.

### End-to-End Testing Procedure

Playwright tests require a production build (`npm run build`) and a dedicated disposable database specified in `PLAYWRIGHT_DATABASE_URL`.

When running E2E tests locally, execute this sequence:

1. Start a local Postgres container:
   ```bash
   docker run -d --name mainline-playwright-db -e POSTGRES_PASSWORD=postgres -e POSTGRES_DB=mainline_e2e -p 5432:5432 postgres:16-alpine
   ```
2. Apply migrations to the test database:
   ```bash
   PLAYWRIGHT_DATABASE_URL="postgresql://postgres:postgres@localhost:5432/mainline_e2e" npx prisma migrate deploy
   ```
3. Build the application:
   ```bash
   npm run build
   ```
4. Run the test suite:
   ```bash
   PLAYWRIGHT_DATABASE_URL="postgresql://postgres:postgres@localhost:5432/mainline_e2e" npm run test:e2e
   ```

Do not report that E2E tests passed if the test runner exited early without executing tests.

---

## 5. Git and Branch Workflow

### Branch Strategy

- `main`: Protected production branch. Merges deploy automatically to live production.
- `feat/<name>`: New feature branches.
- `fix/<name>`: Bug fix and maintenance branches.
- `hotfix/<name>`: Production hotfix branches branched from `main`.

### Continuous Deployment Gatekeeper Rules

Every merge to `main` deploys to production immediately. Follow these gatekeeper rules:

- Never push code directly to `main`.
- Never merge a pull request without explicit user approval.
- Always work on short-lived branches (`feat/*`, `fix/*`, `hotfix/*`).
- Open a pull request, verify CI passes, and present the PR to the user for final approval.

### Standard PR Sequence

1. Before starting, update your local `main` branch:
   ```bash
   git checkout main
   git pull origin main
   ```
2. Create a new branch:
   ```bash
   git checkout -b feat/<name>
   ```
3. Implement changes and verify locally:
   ```bash
   npm run typecheck
   npm run lint
   npm test
   ```
4. Push your branch and open a pull request against `main`.
5. Confirm that CI checks pass on the PR preview.
6. Request review from the user. The user merges with **Squash and merge**.

---

## 6. Production and Environment Safeguards

- **Local Database Isolation**: Connect only to local development databases or disposable test databases (`mainline_e2e`).
- **No Direct Production Database Access**: Never connect directly to the live production database. Never execute raw queries, mutations, or migrations against production from agent tools.
- **No Destructive Database Commands**: Never run `prisma migrate reset` or `prisma db push --force-reset` on shared or production environments.
- **No Direct Deployments**: Never trigger production deployments from CLI tools (such as `vercel --prod`). Production deployments run only via automated CI when the human owner merges to `main`.
- **Secret Protection**: Never print, log, or commit secret environment variables (`AUTH_SECRET`, `CRON_SECRET`, database passwords, or OAuth tokens).
- **No Live Mutations**: Never send real emails, create real invite codes in production, or trigger live webhooks without explicit user instruction.

---

## 7. Hard Development Rules

- **No Unauthorized Merges**: Never push directly to `main` or merge a PR without explicit user permission.
- **No Em-Dashes**: Never use em dashes (unicode U+2014) in code, comments, copy, or markdown documents. Use colons, commas, semicolons, or separate sentences.
- **No Runtime AI**: Never introduce LLM or AI inference into runtime application logic.
- **Strict CI Order**: The build pipeline runs `typecheck -> lint -> unit -> guards -> build -> e2e`. All checks must pass before merging.
- **WASM Isolation**: Keep COOP and COEP headers intact in [next.config.mjs](file:///home/joebos/programming/Mainline/next.config.mjs) for client Stockfish multi-threading.
- **External API Limits**: Respect rate limits for Lichess, Chess.com, and Tablebase. Cache external responses in database cache tables.
