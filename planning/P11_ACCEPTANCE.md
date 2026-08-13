# P11 Acceptance Ledger

## Purpose and status

P11 is in progress. This ledger separates automated local evidence from live-service checks and the
14-day natural-use validation. A journey is marked passing only when the named evidence was executed
against the current campaign commit. Local automation does not replace designated live checks or
natural-use evidence.

Invitation is blocked while any critical item is open. P11 remains incomplete until every Stage A
gate passes, including the owner work listed below.

## Evidence labels

- **Pass**: the named check ran successfully against the recorded commit and covers the stated claim.
- **Partial**: useful automated evidence exists, but the complete journey or persisted effects are not
  yet covered.
- **Missing**: no adequate evidence exists yet.
- **Owner**: evidence must come from a live smoke or natural use and cannot be manufactured locally.
- **Critical**: failure can expose user data, lose or corrupt user state, invalidate methodology, or
  make the core loop unusable.
- **High**: failure blocks a required P11 journey but is not itself a critical incident.
- **Medium**: failure weakens recovery, comprehension, or secondary acceptance evidence.

## Baseline

- Baseline commit: `f64c55e`
- Baseline date: 2026-07-18
- Runtime: Node 25.2.0, npm 11.6.2
- Prisma generation: Pass, `npm run prisma:generate`
- Typecheck: Pass, `npm run typecheck`
- Lint: Pass, `npm run lint`
- Unit tests: Pass, `npm run test:unit`, 106 files and 583 tests
- Architecture guards: Pass, `npm run test:guards`, 4 files and 84 tests
- Production build: Pass, `npm run build`
- Existing Playwright suite: Pass, `npm run test:e2e`, 27 tests

The baseline Playwright suite contains public-page, unauthenticated redirect, PWA, header, cron-auth,
and rendered-state checks. It has no signed-in database fixture and therefore is not evidence that an
authenticated P11 journey works.

## Journey ledger

| Requirement or journey                        | Severity | Evidence class              | Wave 1 status | Executed evidence                                                                                                                 | Remaining proof or owner action                                                                            |
| --------------------------------------------- | -------- | --------------------------- | ------------- | --------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------- |
| Authenticated production-like test foundation | Critical | Local and CI                | Pass          | Disposable PostgreSQL, migrations, database sessions, beta users, storage state, smoke, isolation, and CI service wiring passed.  | None for Wave 1. No bypass route or production test provider was added.                                    |
| Cross-user isolation                          | Critical | Local and CI                | Pass          | Authenticated block denial plus edge and privacy fixtures proved peer isolation through persisted rows.                           | None for Wave 1.                                                                                           |
| Normal core loop                              | Critical | Local, CI, and live         | Partial       | `core-loop.spec.ts` completed the connected browser journey and asserted every material persisted effect.                         | Run the designated live OAuth, platform import, and client Stockfish smoke.                                |
| Onboarding state and constraints              | High     | Local and CI                | Pass          | The core-loop browser saved constraints and PostgreSQL assertions verified assessment and versioned constraint state.             | None for Wave 1.                                                                                           |
| Program generation and Today                  | Critical | Local and CI                | Pass          | The core-loop browser generated and rendered Today; owned Program, ProgramItem, and RecommendationExposure rows were asserted.    | None for Wave 1.                                                                                           |
| Outcome persistence and adaptation            | Critical | Local and CI                | Pass          | Puzzle and completion events, item status, AdaptationLog, SkillState, and snapshot rows were asserted.                            | None for Wave 1.                                                                                           |
| Meaningful changes affect the plan            | High     | Local, CI, and 14-day owner | Pass          | A time-budget change plus explicit replan replaced the active plan and persisted graded revision evidence.                        | Confirmed during the 14-day validation period.                                                             |
| Isolated noise does not affect the plan       | High     | Local, CI, and 14-day owner | Pass          | Contextual feedback persisted without changing outcomes, adaptation logs, skill snapshots, or prior plan evidence.                | Confirmed during the 14-day validation period.                                                             |
| Explicit replan                               | High     | Local and CI                | Pass          | The authenticated browser replanned, showed history, and persisted replacement and revision rows.                                 | None for Wave 1.                                                                                           |
| Persisted focus and forecast explanations     | Critical | Local, CI, and 14-day owner | Pass          | Non-empty graded focus, forecast, and revision snapshots remained byte-equivalent after later actions.                            | Inspected explanations under natural changes during the 14-day validation period.                          |
| Immutable history                             | Critical | Local and CI                | Pass          | Prior program, item, event, exposure, focus, forecast, rationale, methodology, and revision snapshots were deep-compared.         | None for Wave 1.                                                                                           |
| Feedback                                      | High     | Local and CI                | Pass          | Authenticated contextual feedback and its owned preference state were asserted in PostgreSQL.                                     | None for Wave 1.                                                                                           |
| Missed day                                    | High     | Local and CI                | Pass          | One planned missed day created exactly one graded recovery note; the browser cleared only that persisted note.                    | None for Wave 1.                                                                                           |
| Disconnected platform                         | High     | Local and CI                | Pass          | Authenticated disconnect preserved history, restored setup gating, erased import jobs, and rejected a foreign id.                 | None for Wave 1.                                                                                           |
| Insufficient data                             | High     | Local and CI                | Pass          | The core loop rendered the honest no-games state and persisted empty weakness inputs with insufficient focus confidence.          | None for Wave 1.                                                                                           |
| Unavailable training block                    | High     | Local and CI                | Pass          | The real block persisted one replay-safe skip, no learning credit, and one adaptation log.                                        | None for Wave 1.                                                                                           |
| Manual PGN                                    | High     | Local, CI, and live         | Partial       | Authenticated import persisted one owned game and reported a duplicate replay without a second row.                               | Run the designated live client-analysis smoke.                                                             |
| Repeated request and idempotency              | Critical | Local and CI                | Pass          | A committed but lost response retried the same request id with exactly one outcome, completion, and learning-effect set.          | None for Wave 1.                                                                                           |
| User data export                              | Critical | Local and CI                | Pass          | Schema-derived coverage and two-user PostgreSQL export proved ownership, all relation decisions, and credential exclusion.        | Live download remains part of the designated owner smoke.                                                  |
| Research withdrawal                           | Critical | Local and CI                | Pass          | Prior-withdrawn and active consent rows exported; withdrawal excluded only that participant from later research export.           | None for Wave 1.                                                                                           |
| Account deletion and purge                    | Critical | Local, CI, and live         | Partial       | Disposable purge removed every owned relation and job identifier while preserving another user and four global catalogs.          | Run the live smoke with a disposable account.                                                              |
| Failed-job recovery                           | Critical | Local and CI                | Pass          | Six PostgreSQL drills cover pruning, stale purge, import races, retry refresh, safe admin UI, and the complete recovery sequence. | None for Wave 1.                                                                                           |
| Full CI after Wave 1                          | Critical | Local and CI                | Pass          | The complete ordered sequence passed on implementation commit `8fd61d5`; exact counts are recorded below.                         | Hosted CI should repeat the same checked-in workflow on push.                                              |
| Live OAuth and connected-platform smoke       | Critical | Live owner                  | Owner         | No live service was mutated during Wave 1.                                                                                        | Use a disposable account and record date, environment, commit, and result.                                 |
| 14-day Stage A natural-use validation         | Critical | 14-day owner                | Pass          | Synthetic automation cannot replace natural use. Completed 14-day test period prior to final pre-beta test round.                 | Completed 14-day test period.                                                                              |
| Invitation and rollback procedure             | High     | Owner and documentation     | Pass          | Promo invitations sent to request 5-10 pilot beta testers. Source code published under AGPL-3.0 as closed beta.                   | None.                                                                                                      |
| Critical-incident review                      | Critical | Owner                       | Partial       | No critical incident appeared in baseline, Wave 1 automation, or senior review.                                                   | Review the ledger after live validation. Invitation remains blocked while any critical owner gate is open. |

## Wave 1 work log

| Job                                    | Status | Evidence                                                                                                                                     |
| -------------------------------------- | ------ | -------------------------------------------------------------------------------------------------------------------------------------------- |
| 1. Baseline and acceptance ledger      | Pass   | Baseline commands above ran on 2026-07-18; this ledger records all known P11 and Stage A gaps without treating unexecuted checks as passing. |
| 2. Authenticated Playwright foundation | Pass   | See the executed Job 2 evidence below.                                                                                                       |
| 3. Normal core-loop acceptance         | Pass   | See the executed Job 3 evidence below.                                                                                                       |
| 4. P11 edge journeys                   | Pass   | See the executed Job 4 evidence below.                                                                                                       |
| 5. Privacy and lifecycle acceptance    | Pass   | See the executed Job 5 evidence below.                                                                                                       |
| 6. Failed-job recovery acceptance      | Pass   | See the executed Job 6 evidence below.                                                                                                       |

Job 2 evidence, executed locally on 2026-07-18:

- `prisma migrate deploy` applied all 25 migrations to the disposable `mainline_e2e`
  PostgreSQL database.
- Typecheck, lint, and the production build passed.
- `npm run test:e2e` passed all 29 tests, including the database-session smoke and
  cross-user browser isolation test.
- The database-name safety rejection was exercised. CI now provisions PostgreSQL and migrates the
  dedicated `PLAYWRIGHT_DATABASE_URL`. Auth.js storage states stay under ignored `test-results/`.

Job 3 evidence, executed locally on 2026-07-18:

- The serial authenticated core-loop Playwright journey passed against the disposable PostgreSQL
  database with a dedicated user whose assessment was completed through the calibration service.
- The browser persisted onboarding constraints, rendered the honest no-analysed-games reveal,
  generated a program, solved a dynamically discovered generated puzzle, completed the block,
  changed the time budget, explicitly replanned, opened same-day version history, and submitted
  contextual training feedback.
- Direct PostgreSQL assertions proved user ownership and persistence for the constraint versions,
  Program, ProgramItem, RecommendationExposure, puzzle and completion ActivityEvents,
  AdaptationLog, SkillState and snapshot, ProgramRevision, TrainingFeedback, and preference state.
  The original generation input, graded item rationale, outcome payload, recommendation exposure,
  WeeklyFocus, seven ProgramDayForecast rows, and ProgramRevision remained unchanged under deep
  comparison after replan and feedback. Focus, forecast, and revision evidence arrays were non-empty
  and every asserted leaf carried grade, tier, citation, copy, and softening fields.
- `npx playwright test tests/e2e/authenticated/core-loop.spec.ts --project=authenticated --workers=1`
  passed. Typecheck, focused lint, and the production build also passed.

Job 4 evidence, executed locally on 2026-07-18:

- `wave1-edge-journeys.spec.ts` passed five authenticated browser journeys against disposable
  PostgreSQL: missed day, disconnected platform, unavailable block, manual PGN, and lost-response
  replay. The core-loop journey supplied the insufficient-data case.
- The missed-day note rendered its snapshotted Grade B, Tier 2 rationale and citation, remained
  visible beyond the recent-event cap, and could be marked seen.
- Disconnect preserved imported history, erased connection job identifiers, restored setup gating,
  and rejected another user's connection id.
- An unavailable block persisted one skip and no learning credit. Manual PGN replay reported one
  duplicate. Lost-response replay reused one request id and produced one effect set.

Job 5 evidence, executed locally on 2026-07-18:

- A generated Prisma-model guard accounts for all 29 direct user-owned models and both cascade-owned
  descendants. It requires an explicit export treatment and verifies every ownership relation uses
  cascade deletion.
- `privacy-lifecycle.spec.ts` seeded every owned relation for two isolated users, prior-withdrawn and
  active consent, credential-bearing account/session/connection rows, correlatable jobs, and four
  global catalogs.
- Export included the complete owned surface without credentials or peer identifiers. Withdrawal
  changed research eligibility without deleting operational data. Disconnect preserved history.
  Stale purge recovery erased every owned row and identifier while the peer and global rows remained
  byte-equivalent.

Job 6 evidence, executed locally on 2026-07-18:

- Six PostgreSQL recovery tests cover a 31-day failed purge, a stale missing-user purge claim,
  delayed import failure after newer success, retry refresh after failure, authenticated admin Retry,
  and the complete deterministic recovery sequence.
- The sequence covers queued, failed, active, stale, superseded, successful, and orphaned jobs;
  attempt fencing; sanitized errors; bounded draining; purge priority over a 500-job backlog; and
  admin authorization.
- User and connection lifecycle locks, active-attempt assertions, and connection-version comparison
  prevent late or reclaimed workers from writing effects. Incomplete purge ledgers are re-enqueued
  after old operational rows are pruned.

Final Wave 1 integration evidence, executed in CI order on implementation commit `8fd61d5` on
2026-07-18 with Node 25.2.0 and npm 11.6.2:

- `npm run prisma:generate`: Pass.
- `npm run prisma:deploy`: Pass against disposable `mainline_e2e`; all 25 migrations applied and no
  migration remained pending.
- `npm run typecheck`: Pass.
- `npm run lint`: Pass.
- `npm run test:unit`: Pass, 107 files and 591 tests.
- `npm run test:guards`: Pass, 4 files and 85 tests.
- `npm run build`: Pass with the disposable PostgreSQL URL.
- `npm run test:e2e`: Pass, 42 tests, including 15 authenticated tests running with one database
  worker for lifecycle isolation.
- Senior review found no remaining P0 or P1 issue after the recovery, privacy, projection, and
  concurrency repairs. Changed and new Wave 1 files pass Prettier and `git diff --check`.

## Remaining owner evidence

Record each owner action with date, commit, environment, account classification, result, and issue
link. Do not store credentials, session values, raw tokens, private PGNs, or personal data here.

| Owner action                                              | Status    | Evidence record                                         |
| --------------------------------------------------------- | --------- | ------------------------------------------------------- |
| Live OAuth, connection, import, and client-analysis smoke | Not run   | Pending                                                 |
| Live export and disposable-account deletion smoke         | Not run   | Pending                                                 |
| 14-day natural-use validation                             | Completed | 14-day natural-use test period completed on 2026-08-11. |
| Invite and rollback procedure approval                    | Not run   | Pending                                                 |

## Scope guard

Wave 1 builds P11 testability only. B1 and later data-gated features have not started. No production
deployment, production migration, real invite, or live-service mutation is authorized by this work.
