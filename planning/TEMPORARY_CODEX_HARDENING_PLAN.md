# Temporary Codex Hardening Plan

This document outlines the sequential hardening plan for P11 acceptance and release readiness.

## Baseline Summary

- Baseline commit: `f64c55e` on `main`.
- Status: BUILD milestones M0 through M15 and roadmap parts P0 through P10 are complete.
- Active part: Part P11.

Part P11 requires 14 days of natural use. This plan organizes sequential subagents to automate testable P11 evidence, harden code invariants, and prepare for live validation. Do not start roadmap parts B1 through B6 early.

---

## Operating Protocol

Follow these execution rules for each hardening job:

1. Run one agent at a time on a clean working tree.
2. Use the highest reasoning setting available.
3. Make one focused commit per justified improvement. Do not make empty or purely cosmetic commits.
4. Review all changes before starting the next job.
5. Use local databases and disposable test data only. Never deploy, run live migrations, or mutate production data.
6. When tests fail, execute the repair prompt before proceeding.

### Universal Job Prefix

Attach this prefix to each job prompt:

```text
Read AGENTS.md, planning/VISION.md, planning/BUILD.md, planning/FEATURE_ROADMAP.md Part P11, and planning/P11_ACCEPTANCE.md. Use all applicable repository skills. Work strictly on this job locally without starting B1 or later roadmap parts. Implement high-confidence improvements, update the P11 acceptance ledger, make one focused commit when justified, and report test results. Do not use em dashes.
```

---

## Wave 1: Build P11 Testability

Execute these jobs in sequence:

### Job 1: Baseline and Acceptance Ledger

```text
Run the complete CI sequence and initialize planning/P11_ACCEPTANCE.md. Record the baseline commit, all P11 journeys, existing automated evidence, missing checks, severity levels, and ownership classification. Do not mark unexecuted checks as passing.
```

### Job 2: Authenticated Playwright Foundation

```text
Add production-faithful authenticated Playwright test infrastructure using disposable PostgreSQL, migrations, seeded users, database sessions, and storage state. Do not add authentication bypass routes or mock providers. Maintain test isolation and add an authenticated smoke test and a cross-user isolation test.
```

Target architecture:
- PostgreSQL container in CI.
- Automated `prisma migrate deploy` against the disposable test database.
- Deterministic test user seeding with database session creation.
- Session cookie authentication via Playwright storage state.
- Zero test auth endpoints in production bundles.

### Job 3: Normal Core-Loop Acceptance

```text
Using the authenticated fixture, automate the full P11 core journey: onboarding, constraints, program generation, Today session completion, outcome tracking, explicit replanning, daily adaptation, immutable history, and user feedback. Assert persisted database effects.
```

### Job 4: P11 Edge Journeys

```text
Automate the missed-day, disconnected-platform, insufficient-data, unavailable-block, manual-PGN, and duplicate-request journeys. Use browser tests for visible UI state and service tests for deterministic state transitions.
```

### Job 5: Privacy and Lifecycle Acceptance

```text
Audit all user-owned Prisma models against export, research consent withdrawal, account purge, and cascade deletions. Add automated tests for data export, research withdrawal, and hard account deletion using disposable test users.
```

### Job 6: Background Job Recovery Acceptance

```text
Create a deterministic recovery test suite covering queued, failed, stale, superseded, and completed jobs. Verify worker fencing, retries, sanitized error reporting, purge priority, bounded draining, and admin UI actions.
```

---

## Wave 2: Specialized Hardening

Execute these audits as time and priority permit:

### Job 7: Senior Code Review

```text
Use the code-review-expert skill to review features from P8 to HEAD (manual import, research capture, session completion, onboarding routing, and engagement). Fix high-impact correctness and maintainability issues.
```

### Job 8: Security Audit

```text
Use the security-audit skill to audit authentication, beta admission gates, tRPC procedures, file imports, external requests, secrets, research exports, and cron endpoints. Fix verified vulnerabilities and add regression tests.
```

### Job 9: Concurrency and Idempotency Audit

```text
Audit mutations for programs, activity events, feedback, imports, rate limits, and account purges. Test concurrent requests, race conditions, and idempotency key safety.
```

### Job 10: Engine and Methodology Guard Audit

```text
Use the chess-app-conventions and engine-methodology-guard skills to audit L1-L3 laws, deterministic time injection, rationale snapshots, and feedback boundaries. Fix violations and strengthen automated guard tests.
```

### Job 11: Frontend UX and Accessibility Pass

```text
Use the frontend-design skill to review onboarding, Today, training, analysis, library, and settings pages. Fix accessibility, responsive layout, focus order, loading states, and error handling issues.
```

### Job 12: Free-Tier Performance Audit

```text
Audit database queries, N+1 issues, payload sizes, Stockfish initialization, database indexes, and external API rate limit consumption. Implement low-risk optimizations and regression checks.
```

### Job 13: Dependency and CI Audit

```text
Audit npm scripts, lockfile consistency, GitHub Actions workflows, dependency vulnerabilities, and Node pinning. Fix reproducibility issues without unnecessary package churn.
```

### Job 14: Critical Path Test Amplification

```text
Audit untested high-risk branches across authentication, import, analysis, program generation, tracking, and deletion. Add focused unit and integration tests for critical failure modes.
```

---

## Wave 3: Release Handoff

### Job 15: Operations and Release Documentation

```text
Reconcile planning/OPERATIONS.md, planning/SHIPPING.md, BUILD.md, FEATURE_ROADMAP.md, and the P11 ledger. Document exact procedures for migrations, deployment, invites, monitoring, and rollbacks.
```

### Job 16: Final Integration Verification

```text
Review all campaign commits. Execute the full CI sequence in order: prisma generate, typecheck, lint, unit tests, guards, production build, and Playwright E2E. Update the P11 ledger with final evidence.
```

### Incident Repair Template

When an agent introduces a test regression, execute this prompt:

```text
Inspect the latest commit and failing test output. Fix only regressions caused by that commit. Run typecheck, lint, and affected tests. Update the P11 ledger and create a repair commit.
```

---

## Acceptance Criteria

Complete the hardening campaign when all of these criteria are satisfied:

1. Clean git working tree with passing checks for all commits.
2. Authenticated critical flows pass locally and in CI without live OAuth.
3. The P11 acceptance ledger records verified evidence and owners for all remaining items.
4. Export, withdrawal, deletion, recovery, and isolation have automated tests.
5. The full CI pipeline passes in strict order.
6. 14-day natural use validation is recorded before public beta invitations.
