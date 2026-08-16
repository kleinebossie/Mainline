# P11 Acceptance Ledger

This ledger records automated and manual verification evidence for Part P11 and Stage A readiness.

## Purpose and Status

Part P11 is in progress. This ledger separates local automated evidence from live service checks and the 14-day natural-use validation. Mark a journey as passing only after executing the specified check against the target commit.

Beta invitations remain blocked until all critical owner checks pass.

---

## Evidence Labels

- **Pass**: The named check passed and covers the stated requirement.
- **Partial**: Automated evidence exists, but complete journey coverage or live validation is pending.
- **Missing**: No adequate automated or manual evidence exists yet.
- **Owner**: Evidence requires live smoke testing or natural use by the human owner.
- **Critical**: Failure risks user data loss, state corruption, invalid methodology, or broken core loop.
- **High**: Failure blocks a required P11 user flow.
- **Medium**: Failure weakens background recovery, diagnostics, or secondary UI behavior.

---

## Baseline Environment

- Baseline commit: `f64c55e`
- Baseline date: 2026-07-18
- Runtime: Node 25.2.0, npm 11.6.2
- Prisma generate: Pass (`npm run prisma:generate`)
- Typecheck: Pass (`npm run typecheck`)
- Lint: Pass (`npm run lint`)
- Unit tests: Pass (`npm run test:unit`, 106 files, 583 tests)
- Architecture guards: Pass (`npm run test:guards`, 4 files, 84 tests)
- Production build: Pass (`npm run build`)
- Baseline Playwright suite: Pass (`npm run test:e2e`, 27 tests)

---

## Journey Ledger

| Requirement or Journey | Severity | Evidence Class | Wave 1 Status | Executed Evidence | Remaining Proof or Owner Action |
| :--- | :--- | :--- | :--- | :--- | :--- |
| Authenticated test foundation | Critical | Local and CI | Pass | Disposable PostgreSQL, migrations, database sessions, test users, storage state, and CI pipeline passed. | None for Wave 1. |
| Cross-user isolation | Critical | Local and CI | Pass | Authenticated block denial and privacy tests proved user isolation in database queries. | None for Wave 1. |
| Normal core loop | Critical | Local, CI, and live | Partial | `core-loop.spec.ts` completed the connected browser journey and asserted persisted database effects. | Execute live OAuth and Stockfish analysis smoke. |
| Onboarding constraints | High | Local and CI | Pass | Browser saved constraints; PostgreSQL assertions verified versioned constraint states. | None for Wave 1. |
| Program generation and Today | Critical | Local and CI | Pass | Core-loop browser rendered Today; owned Program, ProgramItem, and RecommendationExposure rows were verified. | None for Wave 1. |
| Outcome tracking and adaptation | Critical | Local and CI | Pass | Activity events, item status, AdaptationLog, SkillState, and snapshot records were verified. | None for Wave 1. |
| Meaningful changes affect plan | High | Local, CI, and 14-day | Pass | Budget change plus replan replaced active plan and saved graded revision records. | Verified during 14-day natural use. |
| Isolated noise ignored | High | Local, CI, and 14-day | Pass | Contextual feedback persisted without corrupting adaptation logs, skill states, or plans. | Verified during 14-day natural use. |
| Explicit replan | High | Local and CI | Pass | Authenticated browser replanned session, displayed history, and persisted revision records. | None for Wave 1. |
| Focus and forecast explanations | Critical | Local, CI, and 14-day | Pass | Graded focus, forecast, and revision snapshots remained byte-equivalent after subsequent actions. | Verified during 14-day natural use. |
| Immutable history | Critical | Local and CI | Pass | Historical programs, items, events, exposures, rationales, and methodology versions deep-compared cleanly. | None for Wave 1. |
| User feedback | High | Local and CI | Pass | Authenticated contextual feedback and preference records were verified in PostgreSQL. | None for Wave 1. |
| Missed day handling | High | Local and CI | Pass | One planned missed day produced one graded recovery note; browser cleared the persisted note. | None for Wave 1. |
| Disconnected platform | High | Local and CI | Pass | Disconnect preserved history, restored setup gating, deleted import jobs, and rejected invalid IDs. | None for Wave 1. |
| Insufficient data state | High | Local and CI | Pass | Core loop rendered empty-state notice and preserved empty weakness inputs with low confidence. | None for Wave 1. |
| Unavailable training block | High | Local and CI | Pass | Unavailable block persisted a safe skip record with no false learning credit. | None for Wave 1. |
| Manual PGN import | High | Local, CI, and live | Partial | Authenticated import saved one owned game; duplicate import reported existing record cleanly. | Execute live client analysis smoke. |
| Request idempotency | Critical | Local and CI | Pass | Duplicate request IDs returned identical outcome, completion, and learning records without duplication. | None for Wave 1. |
| User data export | Critical | Local and CI | Pass | PostgreSQL export verified complete owned relation coverage and excluded all credentials. | Live export download check by owner. |
| Research consent withdrawal | Critical | Local and CI | Pass | Active and withdrawn consent rows exported; withdrawal excluded user from research exports. | None for Wave 1. |
| Account deletion and purge | Critical | Local, CI, and live | Partial | Purge deleted all owned rows and job keys while preserving peer users and global catalogs. | Execute live purge smoke with disposable account. |
| Job recovery drill | Critical | Local and CI | Pass | Recovery tests verified pruning, stale lease reclaim, retry limits, and admin UI actions. | None for Wave 1. |
| Full CI pipeline | Critical | Local and CI | Pass | Full pipeline passed on commit `8fd61d5`. | Maintain passing status in CI on push. |
| Live OAuth and platform smoke | Critical | Live owner | Owner | Local tests complete. | Execute live smoke test on production deployment. |
| 14-day natural use validation | Critical | 14-day owner | Pass | Completed 14-day natural use period on 2026-08-11. | Natural use validation complete. |
| Release procedure approval | High | Owner and docs | Pass | Beta invite and rollback runbooks documented in OPERATIONS.md and SHIPPING.md. | None. |
| Critical incident review | Critical | Owner | Partial | Zero critical incidents observed during automated and natural use testing. | Final sign-off before Stage A invites. |

---

## Executed Work Log (Wave 1)

All Wave 1 jobs executed successfully on commit `8fd61d5` on 2026-07-18:

1. **Job 1 (Baseline Ledger)**: Recorded initial CI metrics and initialized journey tracking.
2. **Job 2 (Authenticated Playwright Foundation)**: Configured disposable PostgreSQL container and database session storage state.
3. **Job 3 (Core Loop Acceptance)**: Verified onboarding, program generation, puzzle solving, replanning, and database persistence.
4. **Job 4 (Edge Journeys)**: Verified missed days, platform disconnection, unavailable blocks, manual PGNs, and duplicate requests.
5. **Job 5 (Privacy and Lifecycle)**: Verified export coverage across all 29 user-owned models, consent withdrawal, and hard account purge.
6. **Job 6 (Job Recovery)**: Verified automated lease reclamation, retry counters, error sanitization, and admin controls.

---

## Remaining Owner Actions

| Action | Status | Record |
| :--- | :--- | :--- |
| Live OAuth, platform connection, and analysis smoke | Pending | Run on deployed staging or production. |
| Live data export and deletion smoke | Pending | Run with a disposable user account. |
| 14-day natural-use validation | Completed | Concluded on 2026-08-11. |
| Final beta launch approval | Pending | Review ledger before sending invite codes. |
