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

| Requirement or journey                        | Severity | Evidence class              | Baseline status | Existing evidence                                                                                                                                                | Missing proof or owner action                                                                                                                                                                                                                                     |
| --------------------------------------------- | -------- | --------------------------- | --------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Authenticated production-like test foundation | Critical | Local and CI                | Missing         | Auth middleware and database-session support exist in `src/server/auth.ts` and the Prisma `Session` model.                                                       | Add disposable PostgreSQL, migrations, deterministic users, beta access, database sessions, Auth.js cookie storage state, authenticated smoke coverage, and CI service wiring. No bypass route or production test provider is allowed.                            |
| Cross-user isolation                          | Critical | Local and CI                | Partial         | Service tests reject foreign program items and feedback in `tests/unit/server/tracker.test.ts` and `tests/unit/server/feedback.test.ts`.                         | Prove isolation through an authenticated browser and disposable persisted users, then extend lifecycle isolation evidence.                                                                                                                                        |
| Normal core loop                              | Critical | Local, CI, and live         | Partial         | Focused service tests cover onboarding, program persistence, tracking, forecast, history, feedback, and adaptation components.                                   | Automate the connected sequence with persisted assertions: onboarding state, constraints, generation, Today completion, outcome, explicit replan, adaptation, immutable history, and feedback. Run the designated live OAuth, import, and client Stockfish smoke. |
| Onboarding state and constraints              | High     | Local and CI                | Partial         | `tests/unit/server/onboarding.test.ts`, constraint unit tests, and unauthenticated route tests pass.                                                             | Exercise authenticated UI writes and verify the stored assessment and current constraints.                                                                                                                                                                        |
| Program generation and Today                  | Critical | Local and CI                | Partial         | `tests/unit/server/program.test.ts` proves a graded persisted session and Today DTO. Rendered-state tests cover Today copy only.                                 | Generate through an authenticated request, render Today, and assert the owning Program and ProgramItem rows.                                                                                                                                                      |
| Outcome persistence and adaptation            | Critical | Local and CI                | Partial         | `tests/unit/server/tracker.test.ts` covers append-only outcomes, repeat requests, completion, and redo scheduling. Engine adaptation golden tests pass.          | Complete an item through the browser, then assert the ActivityEvent, item status, schedule or skill effect, and AdaptationLog through the database.                                                                                                               |
| Meaningful changes affect the plan            | High     | Local, CI, and 14-day owner | Partial         | Program forecast, replan, weekly-focus, and adaptation unit tests cover selected state transitions.                                                              | Add connected acceptance evidence for a meaningful outcome or setting change. Owner must confirm this under natural use without forcing branches.                                                                                                                 |
| Isolated noise does not affect the plan       | High     | Local, CI, and 14-day owner | Partial         | Methodology and adaptation tests cover sample gates and empty histories.                                                                                         | Add deterministic acceptance evidence for the relevant no-op transition. Owner must confirm this under natural use.                                                                                                                                               |
| Explicit replan                               | High     | Local and CI                | Partial         | `tests/unit/server/program-router-p6.test.ts` limits replacement of committed Today to explicit Replan; replan service tests cover locking and duplicate builds. | Drive Replan in an authenticated browser and prove the replacement and revision rows while prior history remains unchanged.                                                                                                                                       |
| Persisted focus and forecast explanations     | Critical | Local, CI, and 14-day owner | Partial         | Forecast and revision service tests assert append-only revisions and graded snapshots in focused paths.                                                          | Verify the complete authenticated transition and immutable persisted explanation. Owner must inspect explanations under natural changes.                                                                                                                          |
| Immutable history                             | Critical | Local and CI                | Partial         | Program history, replan, tracker, and privacy guards cover append-only artifacts in focused tests.                                                               | Prove prior Program, ProgramItem, ActivityEvent, ProgramRevision, rationale, and methodology snapshots remain unchanged after replan and adaptation.                                                                                                              |
| Feedback                                      | High     | Local and CI                | Partial         | `tests/unit/server/feedback.test.ts` covers owned training feedback, product feedback, idempotency, and bounded writes.                                          | Submit feedback in the authenticated journey and assert the persisted row and ownership.                                                                                                                                                                          |
| Missed day                                    | High     | Local and CI                | Partial         | Methodology engagement and server engagement tests cover a planned inactive day and no-op when no work was planned.                                              | Add deterministic service acceptance for the persisted missed-day transition and its recovery effect.                                                                                                                                                             |
| Disconnected platform                         | High     | Local and CI                | Partial         | Onboarding service tests cover error and revoked connection states.                                                                                              | Exercise the authenticated user-visible path and prove no cross-user or invalid import side effect.                                                                                                                                                               |
| Insufficient data                             | High     | Local and CI                | Partial         | Methodology tests cover sample gates and honest insufficient-data results.                                                                                       | Exercise the authenticated user-visible state and assert the persisted decision input or focus behavior.                                                                                                                                                          |
| Unavailable training block                    | High     | Local and CI                | Partial         | Component and rendered-state tests cover the recovery UI.                                                                                                        | Exercise the real authenticated unavailable block and assert the recovery mutation and persisted replacement behavior.                                                                                                                                            |
| Manual PGN                                    | High     | Local, CI, and live         | Partial         | Parser and service tests cover validation, orientation, unknown metadata, duplicates, bounds, and serializable retry.                                            | Use authenticated browser import, assert ImportedGame ownership and idempotency, then run a designated live client-analysis smoke.                                                                                                                                |
| Repeated request and idempotency              | Critical | Local and CI                | Partial         | Tracker, feedback, program replan, manual import, and account deletion service tests cover focused retry paths.                                                  | Add end-to-end or database-backed acceptance for the repeated P11 requests exercised by the browser journey.                                                                                                                                                      |
| User data export                              | Critical | Local and CI                | Partial         | `tests/unit/server/account.test.ts` asserts an explicit export projection and credential exclusions with mocked model reads.                                     | Compare every current user-owned Prisma relation, run an isolated database-backed export, assert ownership and exclusions, and keep live download as a designated smoke.                                                                                          |
| Research withdrawal                           | Critical | Local and CI                | Partial         | Account and research service tests cover consent history and current-consent filtering.                                                                          | Run an isolated database-backed withdrawal and prove subsequent research export exclusion without deleting operational data.                                                                                                                                      |
| Account deletion and purge                    | Critical | Local and CI                | Partial         | Account service tests cover queueing, transactional purge, crash recovery, and opaque completion records with mocks. Privacy guards inspect selected cascades.   | Compare every user-owned relation, run a disposable database-backed purge, prove owned rows are gone, global rows remain, credentials are removed, and another user is untouched. Live deletion remains a designated smoke using a disposable account.            |
| Failed-job recovery                           | Critical | Local and CI                | Partial         | Job, maintenance, account, and daily-operations tests cover individual claim, retry, purge recovery, priority, and deadline paths.                               | Add one deterministic recovery drill covering queued, failed, stale, superseded, and successful jobs together, including fencing, safe errors, purge priority, bounded draining, and operator-visible summary.                                                    |
| Full CI after Wave 1                          | Critical | Local and CI                | Missing         | The pre-campaign baseline is green as recorded above.                                                                                                            | Run Prisma generation, typecheck, lint, unit, guards, build, and the new authenticated Playwright suite in documented order against the final Wave 1 commit.                                                                                                      |
| Live OAuth and connected-platform smoke       | Critical | Live owner                  | Owner           | No live service was mutated during baseline work.                                                                                                                | With a disposable test account, sign in, connect, import, analyze with client Stockfish, complete training, export, and verify safe deletion. Record date, environment, and outcome.                                                                              |
| 14-day Stage A natural-use validation         | Critical | 14-day owner                | Owner           | Cannot be replaced by synthetic tests.                                                                                                                           | Complete at least 8 naturally chosen training sessions, import at least 10 naturally played games, include at least 1 manual PGN or OTB game, and record whether meaningful changes adapt while isolated noise does not.                                          |
| Invitation and rollback procedure             | High     | Owner and documentation     | Missing         | P11 requires a concrete procedure before inviting 5 to 10 pilot users.                                                                                           | Reconcile operations and shipping guidance after automated evidence is complete, then record the owner-approved invite and rollback procedure.                                                                                                                    |
| Critical-incident review                      | Critical | Owner                       | Partial         | No critical incident was observed in the executed local baseline.                                                                                                | Review the final ledger and live validation. Invitation remains blocked for any unresolved critical item.                                                                                                                                                         |

## Wave 1 work log

| Job                                    | Status  | Evidence                                                                                                                                     |
| -------------------------------------- | ------- | -------------------------------------------------------------------------------------------------------------------------------------------- |
| 1. Baseline and acceptance ledger      | Pass    | Baseline commands above ran on 2026-07-18; this ledger records all known P11 and Stage A gaps without treating unexecuted checks as passing. |
| 2. Authenticated Playwright foundation | Missing | Not present in the baseline.                                                                                                                 |
| 3. Normal core-loop acceptance         | Missing | Component service evidence exists, but no authenticated connected journey exists.                                                            |
| 4. P11 edge journeys                   | Missing | Focused evidence exists, but the required acceptance set is incomplete.                                                                      |
| 5. Privacy and lifecycle acceptance    | Missing | Mocked service and schema-guard evidence exists, but isolated database lifecycle evidence is incomplete.                                     |
| 6. Failed-job recovery acceptance      | Missing | Focused unit evidence exists, but no complete deterministic recovery drill exists.                                                           |

## Remaining owner evidence

Record each owner action with date, commit, environment, account classification, result, and issue
link. Do not store credentials, session values, raw tokens, private PGNs, or personal data here.

| Owner action                                              | Status  | Evidence record |
| --------------------------------------------------------- | ------- | --------------- |
| Live OAuth, connection, import, and client-analysis smoke | Not run | Pending         |
| Live export and disposable-account deletion smoke         | Not run | Pending         |
| 14-day natural-use validation                             | Not run | Pending         |
| Invite and rollback procedure approval                    | Not run | Pending         |

## Scope guard

Wave 1 builds P11 testability only. B1 and later data-gated features have not started. No production
deployment, production migration, real invite, or live-service mutation is authorized by this work.
