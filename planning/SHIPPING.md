# SHIPPING.md: Release Management and Readiness Gates

This document defines the release lifecycle, deployment readiness gates, and rollback procedures for Mainline.

## Context Pointers

- **Operations**: See [OPERATIONS.md](file:///home/joebos/programming/Mainline/planning/OPERATIONS.md) for deployment commands, environment secrets, and database recovery runbooks.
- **Roadmap**: See [FEATURE_ROADMAP.md](file:///home/joebos/programming/Mainline/planning/FEATURE_ROADMAP.md) for part completion status and Stage definitions.
- **Orientation**: See [AGENTS.md](file:///home/joebos/programming/Mainline/AGENTS.md) for CI pipeline ordering and git branching rules.

---

## 1. Rollout Stages and User Definitions

Mainline uses progressive rollout stages to validate reliability and learning dynamics safely.

### User Classification

- **Registered User**: An account that has completed authentication.
- **Active User**: An account that completed at least four training sessions and imported or reviewed at least two games within the last 28 days.
- **Consented Participant**: An active user with active research consent who completed at least eight sessions over four calendar weeks.

### Rollout Gate Thresholds

Progress between rollout stages requires meeting these minimum criteria:

1. **Stage 0 (Personal Validation)**:
   - Primary user: Personal builder use.
   - Requirement: 14 consecutive days of natural training with zero critical errors.
2. **Stage A (Closed Beta Pilot)**:
   - Capacity: 5 to 10 invited active users.
   - Requirement: Verify multi-user isolation, platform imports, daily cron execution, and data purge operations.
3. **Stage B (Controlled Research Pilot)**:
   - Capacity: 30 to 50 active users (at least 20 consented participants).
   - Requirement: Collect baseline adherence and observational correlation signals without automated methodology edits.
4. **Stage C (Public Open Beta)**:
   - Capacity: Open registration with rate limiting and queue management.
   - Requirement: Automated database backups, error budgets, and stable serverless compute costs.

---

## 2. Pre-Release Verification Checklist

Execute this checklist before merging changes into `main` for a release:

1. **Local Verification**:
   - Run TypeScript type checks: `npm run typecheck`
   - Run ESLint checks: `npm run lint`
   - Run unit and guard tests: `npm test`
   - Run E2E Playwright tests: `npm run test:e2e`
2. **Database Migration Safety**:
   - Verify that all schema migrations are backward-compatible.
   - Confirm that columns have default values or are nullable.
   - Test migrations against a disposable database container before deployment.
3. **Configuration and Secrets**:
   - Confirm all required environment variables exist in the deployment platform.
   - Verify that `CRON_SECRET` and `AUTH_SECRET` are distinct and strong.
4. **Privacy Boundary Verification**:
   - Verify that account export excludes sensitive credentials and tokens.
   - Verify that account deletion purges all user-owned rows completely.

---

## 3. Rollback Procedures

When a production defect occurs, follow these rollback rules:

1. **Application Code Regressions**:
   - Revert the offending commit on `main` via a dedicated hotfix PR.
   - Trigger the deployment pipeline to push the previous stable commit.
2. **Database Schema Rollbacks**:
   - Apply a forward-fixing migration to restore compatibility.
   - Do not drop tables or delete active columns during incident recovery.
3. **Methodology Configuration Rollbacks**:
   - Set the active methodology pointer to the previous stable release version (such as `research-1.3.0` or `stub-0.1.0`).
   - Keep historic program artifacts immutable to preserve original user rationales.
