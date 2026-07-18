# Temporary Codex Hardening Plan

## Summary

Current baseline: clean `main` at `f64c55e`. BUILD milestones M0-M15 and roadmap P0-P10 are complete.
The next authoritative part is P11.

P11 cannot be completed today because it requires 14 days of natural use. This plan uses sequential
agents to automate P11 evidence, harden the codebase, and leave only live and time-gated checks
outstanding. Do not begin B1-B6 early.

## Operating Protocol

- Run one agent at a time on the same branch.
- Use the highest reasoning setting available.
- Begin each job only with a clean worktree.
- Each agent should make one focused commit when changes are justified. No empty or cosmetic commits.
- Review the commit before starting the next job.
- Agents may use local databases and ephemeral test data, but must not deploy, run production
  migrations, create real invites, or mutate live services.
- If an agent leaves tests red, run the repair prompt before continuing.

Paste this prefix followed by one job prompt:

```text
Read AGENTS.md, planning/VISION.md, planning/BUILD.md, planning/FEATURE_ROADMAP.md P11, and planning/P11_ACCEPTANCE.md if it exists. Use all applicable repository skills. Work only on this job, local-only, without starting B1 or later roadmap work. Implement and test high-confidence improvements, update the P11 acceptance ledger with evidence, make one focused commit when justified, and report tests, risks, and remaining owner actions. Do not use em dashes.
```

## Wave 1: Build P11 Testability

Run these first, in order.

### 1. Baseline and acceptance ledger

```text
Run the complete current CI sequence and create planning/P11_ACCEPTANCE.md. Record the baseline commit, every P11 journey, existing automated evidence, missing evidence, severity, and whether each item is local, live, or 14-day owner work. Do not mark unexecuted checks as passing.
```

### 2. Authenticated Playwright foundation

```text
Add production-faithful authenticated Playwright infrastructure using an ephemeral PostgreSQL database, migrations, seeded users, database sessions, and storage state. Add no authentication-bypass route or production provider. Keep unauthenticated tests isolated and add one authenticated smoke test plus one cross-user isolation test.
```

The intended design is:

- PostgreSQL service in CI.
- `prisma migrate deploy` against the disposable test database.
- Playwright setup inserts deterministic users, beta access, and database sessions.
- Authenticated tests use an Auth.js session cookie through storage state.
- No test authentication code is reachable in the deployed application.

### 3. Normal core-loop acceptance

```text
Using the authenticated fixture, automate the normal P11 journey: onboarding state, constraints, program generation, Today completion, outcome persistence, explicit replan, adaptation, immutable history, and feedback. Assert persisted effects, not only visible copy.
```

### 4. P11 edge journeys

```text
Automate the missed-day, disconnected-platform, insufficient-data, unavailable-training-block, manual-PGN, and repeated-request journeys. Use browser tests for user-visible behavior and service tests for deterministic state transitions that do not need a browser.
```

### 5. Privacy and lifecycle acceptance

```text
Compare every user-owned Prisma relation with export, research withdrawal, account purge, and cascade behavior. Fix omissions, add isolated tests for export and deletion, verify cross-user isolation, and use only disposable test users for destructive scenarios.
```

### 6. Failed-job recovery acceptance

```text
Build a deterministic local recovery drill for queued, failed, stale, superseded, and successfully completed jobs. Verify fencing, retries, sanitized errors, account-purge priority, bounded daily draining, and operator-visible recovery behavior.
```

## Wave 2: Specialized Hardening

Continue through as many jobs as time and usage permit.

### 7. Senior review of recent work

```text
Use code-review-expert to review the feature range from P8 through the current HEAD, including manual import, research capture, session completion, onboarding routing, and engagement changes. Fix only concrete correctness or maintainability defects with demonstrated impact.
```

### 8. Security audit

```text
Use security-audit for an exploit-focused review of authentication, beta admission, tRPC authorization, imports, uploads, external requests, secrets, research export, account deletion, cron routes, and test-only infrastructure. Fix confirmed vulnerabilities and add regression tests.
```

### 9. Concurrency and idempotency audit

```text
Adversarially review every mutation involving programs, outcomes, activity events, feedback, imports, budgets, invites, jobs, and deletion. Test duplicate and concurrent requests, then fix races, partial writes, or broken idempotency without weakening valid retries.
```

### 10. Engine and Methodology audit

```text
Use chess-app-conventions and engine-methodology-guard to audit L1-L3, deterministic time handling, rationale snapshots, methodology deep imports, ungraded decisions, and user feedback boundaries. Fix violations and strengthen guards only where they catch a real missing invariant.
```

### 11. UX and accessibility pass

```text
Use frontend-design and playwright-interactive to inspect onboarding, Today, training, analysis, library, progress, settings, and mobile layouts. Fix the highest-impact accessibility, responsive, focus, form-feedback, loading, error, and comprehension problems while preserving the current visual direction.
```

### 12. Free-tier and performance audit

```text
Audit server query bounds, N+1 behavior, payload sizes, client bundles, Stockfish loading, navigation prefetching, database indexes, cron deadlines, and external API budgets. Implement measurable low-risk improvements and add regression checks for any corrected bound.
```

### 13. Dependency and CI reproducibility audit

```text
Audit npm scripts, lockfile reproducibility, GitHub Actions permissions, dependency vulnerabilities, generated assets, cache behavior, Node pinning, and build assumptions. Fix concrete issues without broad framework upgrades or unrelated dependency churn.
```

### 14. Critical-path test amplification

```text
Inspect remaining critical branches not protected by meaningful tests across auth, import, analysis, generation, tracking, research, and deletion. Add a small set of adversarial tests for actual high-risk gaps. Do not chase a coverage percentage or duplicate existing assertions.
```

## Wave 3: Release Handoff

### 15. Operations and release documentation

```text
Reconcile planning/OPERATIONS.md, planning/SHIPPING.md, BUILD.md, FEATURE_ROADMAP.md, migrations, environment variables, and the P11 ledger. Produce exact local validation, deployment, migration, invite, monitoring, rollback, recovery, export, and deletion procedures without claiming live verification.
```

### 16. Final integrator

```text
Review every commit created during this temporary campaign. Run Prisma generation, typecheck, lint, unit tests, guards, production build, and Playwright in CI order. Repair only campaign regressions, update the P11 ledger with exact results, and leave P11 explicitly in progress for live and 14-day checks.
```

Repair prompt, if any job leaves the branch red:

```text
Inspect the latest agent commit and the failing output. Fix only regressions introduced by that commit, preserve valid work, run the affected checks plus typecheck and lint, update the P11 ledger, and create a separate repair commit. Do not reset or discard unrelated changes.
```

## Acceptance Criteria

At the end of the campaign:

- The branch is clean and every retained commit has passing proportional checks.
- Authenticated critical flows run locally and in CI without live OAuth or a production auth bypass.
- P11 has an evidence-backed ledger with severity and ownership for every remaining gap.
- Export, withdrawal, deletion, recovery, concurrency, and cross-user isolation have automated evidence.
- The final CI sequence passes in the documented order.
- P11 remains incomplete until the owner performs the 14-day natural-use validation and designated
  live smokes.
- B1 and later data-gated features remain untouched.

## Assumptions

- Agents run sequentially on `main`, as selected.
- Work is local-only and commit-producing.
- No production deployment or database mutation is authorized.
- Any new migration is committed and tested locally but not applied live.
- Verified no-op audits produce a report and ledger entry, not a noise commit.
