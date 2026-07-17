# FEATURE_ROADMAP.md: what Mainline should build next

> **Purpose.** This document turns the post-M14 product discussion into an implementation roadmap.
> It prioritises the smallest set of capabilities that makes Mainline feel like a genuinely personal,
> adaptive training program before adding more training modes. It is split into parts so a fresh AI
> agent can implement and verify one part at a time.
>
> **Status.** P0 through P10 are complete; later parts remain planned. A part is implemented only when its
> own status and Definition of Done say so.
>
> **Central product decision.** Mainline needs a deeper loop, not a larger menu. Real adaptation,
> program memory, user feedback, responsible observational learning, and manual OTB game import all
> rank ahead of new standalone trainers.

---

## 0. Relationship to the other planning files

Read and apply these documents in this order:

1. **`VISION.md` is authoritative for product intent and boundaries.** This roadmap must preserve the
   personalised, science-based, no-BS training-program layer; internal-first delivery; free training;
   privacy; and the bans on runtime LLMs, social/multiplayer, hosted copyrighted content, and a
   competing game platform.
2. **`BUILD.md` is authoritative for the current architecture and Phase-1 contracts.** This roadmap
   extends the M0-M15 build with post-blueprint parts. It does not replace the Engine/Methodology
   split, the data model rules, the CI gates, or any completed milestone contract. Parts P2 and P3
   below divide the remaining M15 work so separate agents can finish it safely.
3. **`METHODOLOGY.md` is authoritative for chess and learning-science decisions.** Any new threshold,
   priority, confidence gate, training rule, prompt policy, or user-facing recommendation must first
   be represented as a graded, cited methodology value. This roadmap must never become a second
   source of scientific constants.
4. **`research/` supplies the evidence behind methodology changes.** A feature agent may encode
   existing research, but must not invent or upgrade evidence. Updating a research report requires
   the research-synthesis workflow.
5. **`SHIPPING.md` will own release mechanics once it is authored.** Until then, section 2 of this
   file owns readiness gates. When `SHIPPING.md` gains content, copy the current gates there and keep
   both documents consistent.
6. **`GROWTH.md` will own acquisition strategy once it is authored.** User-count gates in this file
   are product-readiness gates, not marketing targets or growth tactics.

If documents conflict, fix the lower-authority document. Never silently implement the conflict.

### Architectural application

- The **Engine** owns generic state, history, revision ledgers, time-budget packing, persistence,
  deterministic orchestration, and presentation APIs.
- The **Methodology** owns which signals matter, how confidence changes a recommendation, weekly
  focus selection, revision thresholds, user-choice bounds, diagnostic probes, and recommendation
  copy. Every value remains graded and cited.
- Subjective feedback may describe enjoyment, relevance, friction, availability, or preferences. It
  must never be treated as a behavioral skill measurement.
- Observational population data may establish associations and calibrate descriptive baselines. It
  must not be described as proving rating causation.
- No part introduces runtime LLM or generative-AI calls.

---

## 1. Locked product decisions

These decisions came from the feature-planning discussion and should not be reopened by an
implementation agent unless implementation uncovers a direct contradiction:

- Optimise for the builder first while keeping every decision generalisable across users and rating
  bands.
- Validate primarily with a below-1200 hybrid online/OTB user, without hardcoding that profile.
- Behavioral evidence and due learning lead the prescribed skill focus. User autonomy operates
  through goals, real constraints, and equivalent delivery choices inside that focus. Subjective
  dislike or difficulty may identify friction, but it never suppresses due work, lowers difficulty,
  or removes a methodology-selected skill area.
- Weekly direction stays understandable and relatively stable. Difficulty, due work, activity
  allocation, and exact daily contents may tune each day.
- Show immutable history and a committed Today. Keep the rolling seven-day forecast as an internal,
  persisted scheduling artifact. Do not render future forecasts on Today in Phase 1 because the
  same deterministic inputs produce the same work when each day arrives.
- Do not add plan settings to Today in Phase 1. Weekly availability, focus alternatives, day
  overrides, and the revision ledger may return in a later, deliberately redesigned feature.
- Once the user starts Today, it does not silently regenerate. Completed work is preserved, and
  changing the remaining session requires an explicit Replan action.
- Subjective input and behavioral diagnosis are separate lanes.
- Feedback cadence is one short weekly check-in in Settings/assessment, an always-available feedback
  action, and occasional contextual links after a new or repeatedly problematic activity. Today may
  link to the relevant Settings section, but it does not become a plan-settings surface.
- Population learning is observational first. Methodology never rewrites itself automatically.
- Aggregate findings and methodology changes are published with limitations and evidence grades.
- Manual PGN and OTB import is required before inviting closed-beta users.
- No new standalone training mode is required before closed beta.

---

## 2. Rollout stages and readiness gates

These counts are conservative **operational defaults**, not evidence grades and not claims of
statistical power. A formal experiment always needs a separate power analysis for its exact outcome,
effect size, and design.

### Definitions

- **Registered user:** an account that completed sign-in.
- **Active user:** in the trailing 28 days, completed at least four training sessions and imported or
  manually added at least one game.
- **Longitudinal user:** an active user with at least four consecutive weeks of usable training and
  game data.
- **Research-consented user:** separately opted into secondary aggregate research use under the
  current versioned consent text.
- **Critical incident:** privacy breach, cross-user data exposure, unrecoverable user-data loss,
  invalid methodology activation, or a failure that corrupts program history or outcomes.

### Stage A: before closed beta

Implement P0-P11 in dependency order. Before inviting anyone:

- All BUILD.md M15 requirements are complete or explicitly moved to `SHIPPING.md` with an owner and
  reason. Access control, privacy, deletion, API limits, and monitoring may not be deferred.
- The active methodology is a validated `research-*` release rather than a user-facing stub.
- The builder completes a 14-day natural-use validation with at least eight real training sessions,
  at least ten naturally played/imported games, and at least one manual PGN or OTB game.
- The full flow works without database repair: import, analysis, weekly focus, internal seven-day
  forecast generation, Today, outcome logging, adaptation, history, feedback, export, and deletion.
- No unresolved critical incident exists.

### Stage B: pilot closed beta, 5-10 active users

- Freeze major feature expansion for the first two weeks. Fix reliability, comprehension, and data
  integrity failures first.
- Keep research observational. Collect qualitative feedback and validate that plan changes are both
  real and understandable.
- Implement B1 only after the core loop has operated without a critical incident for two weeks.

### Stage C: closed beta, up to 25 active users

- Implement B2 and B3 after B1 is stable.
- Use the cohort to validate confidence gates, not to claim training effectiveness.
- Do not expose a diagnosis when the sample gate says data is insufficient.

### Stage D: expanded closed beta, 25-100 active users

- Implement B4 and B5.
- Begin B6 reporting once at least 25 research-consented longitudinal users exist.
- Do not tune methodology from aggregate telemetry without a reviewed proposal, evidence regrade,
  version bump, golden tests, and public changelog entry.

### Public-release gate

Public release requires all of the following:

- At least 50 active users, including at least 25 longitudinal users.
- P0-P11 and B1-B5 complete.
- No unresolved critical incident and no critical incident during the preceding 30 days.
- Export and deletion verified against every user-owned table introduced by this roadmap.
- Background imports, analysis handoff, program generation, and adaptation are observable and
  recoverable.
- The public methodology changelog contains every methodology release used during beta.
- The central caveat remains visible: no activity is proven to cause rating gain.

### After public release

- L1 may begin after 100 active users and at least 50 research-consented longitudinal users have
  eight weeks of resource-use data.
- L2 may begin only after 250 active research-consented users, a named study owner, a written analysis
  plan, and a design-specific power analysis. The user count alone does not authorise experiments.
- L3 and L4 are demand-gated, not mandatory. Build them only after public feedback shows recurring
  demand and the core loop remains stable.

---

## 3. How a fresh agent executes one part

Each implementation prompt should name exactly one part ID. The agent must:

1. Read `VISION.md`, the relevant BUILD.md contracts, this file, and the referenced METHODOLOGY.md
   seams before editing.
2. Load `chess-app-conventions` for every app-code change. Load `engine-methodology-guard` whenever
   the part touches decisions, config, schemas, or data models. Load `evidence-grade` for any
   recommendation, methodology value, or user-facing research claim.
3. Inspect the implementation and current git changes. Preserve unrelated user edits.
4. Implement only the named part and its necessary migrations, tests, documentation, and minimal UI.
5. Keep the Engine deterministic. Inject time and seeds, and route graded choices through the typed
   methodology surface.
6. Run verification in the project order appropriate to the change: Prisma generation if needed,
   typecheck, lint, unit tests, guards, build, and relevant end-to-end tests.
7. Update this part's status and handoff notes. Update BUILD.md only when an architectural contract or
   current implementation status changes. Update METHODOLOGY.md only when the scientific source of
   truth changes.
8. Stop at the part boundary. Do not opportunistically implement a later part.

Every part must end with:

- a concise summary of behavior delivered;
- migrations or deployment steps the owner must run;
- tests executed and their results;
- deliberate deviations from this specification;
- any new risk or follow-up, assigned to a later part rather than silently expanded in scope.

---

## 4. Roadmap overview

| Part | Outcome                                                         | Timing                                   | Depends on                          | Status   |
| ---- | --------------------------------------------------------------- | ---------------------------------------- | ----------------------------------- | -------- |
| P0   | Current-state and methodology gap audit                         | Before closed beta                       | M14 complete                        | Complete |
| P1   | Research methodology release                                    | Before closed beta                       | P0                                  | Complete |
| P2   | Beta access, API budgets, jobs, monitoring, and PWA             | Before closed beta                       | P0                                  | Complete |
| P3   | Privacy, consent, export, and hard-deletion completion          | Before closed beta                       | P0                                  | Complete |
| P4   | Decision-state and skill-history foundation                     | Before closed beta                       | P1, P3                              | Complete |
| P5   | Stable weekly focus and bounded user choice                     | Before closed beta                       | P4                                  | Complete |
| P6   | Seven-day forecast, revision ledger, and availability model     | Before closed beta                       | P5                                  | Complete |
| P7   | Program history experience                                      | Before closed beta                       | P6                                  | Complete |
| P8   | Training-fit and product-feedback loop                          | Before closed beta                       | P5, P7                              | Complete |
| P9   | Observational research capture and public methodology changelog | Before closed beta                       | P3, P8                              | Complete |
| P10  | Manual PGN and OTB import                                       | Before closed beta                       | P2, P3                              | Complete |
| P11  | User-zero acceptance and closed-beta release audit              | Before closed beta                       | P1-P10                              | Planned  |
| B1   | Recurring motif and board-vision diagnosis                      | Pilot beta                               | P11                                 | Planned  |
| B2   | Phase and conversion diagnosis                                  | Closed beta                              | B1                                  | Planned  |
| B3   | Time-use, opening gates, and uncertainty-driven probes          | Closed beta                              | B1                                  | Planned  |
| B4   | Personal mistake-protocol extensions                            | Expanded beta                            | B2, B3                              | Planned  |
| B5   | Per-user duration and schedule-fit adaptation                   | Expanded beta                            | P8, B1                              | Planned  |
| B6   | Aggregate calibration review and methodology releases           | Expanded beta, ongoing                   | P9, 25 consented longitudinal users | Planned  |
| L1   | Resource effectiveness and stop-doing guidance                  | After public release and data gate       | B6                                  | Planned  |
| L2   | Personal experiments and formal studies                         | After public release and experiment gate | B6                                  | Planned  |
| L3   | Tournament preparation                                          | After public release, demand-gated       | B3, B5                              | Planned  |
| L4   | Coach handoff pack                                              | After public release, demand-gated       | B1-B3                               | Planned  |

---

## 5. Before closed beta: agent parts

### P0: Current-state and methodology gap audit

**Goal:** establish exact repo and deployed-state truth before extending the architecture.

**Agent work:**

- Compare BUILD.md M0-M15 status claims with code, migrations, deployed infrastructure, and current
  manual setup requirements.
- Compare `stub-0.1.0.json` with every METHODOLOGY.md seam and list missing, partial, stale, or
  user-facing-stub values.
- Confirm which ConstraintSet fields currently affect generation. At planning time, known omissions
  include goals, days per week, preferred variety, the interleave preference, the if-then plan, and
  accumulated SkillState.
- Confirm which diagnostic signals are active. At planning time, overall blunder rate is the only
  implemented game-derived weakness signal.
- Produce a checked, path-specific implementation inventory in this part's handoff. Do not implement
  later parts.

**Definition of Done:** an evidence-backed gap inventory exists, BUILD.md status is corrected where
needed, and P1-P3 can be executed without rediscovering current state.

**Status (2026-07-10): COMPLETE.** The audit was checked against commit `3ca1e37`, the current
Prisma schema and migrations, the configured Supabase database, the GitHub CI and Vercel deployment
records, and the local setup. No application behavior, migration, or methodology value was changed
for P0.

The inventory below records repository state when P0 closed. P1 resolutions are documented in the
next section and supersede its stub-release findings.

#### P0 handoff: implementation and deployment truth at P0 completion

M14 is complete and is a valid P0 dependency. The implementation is present in
`src/app/library/`, `src/server/library.ts`, `src/server/routers/library.ts`,
`src/methodology/provider.ts` (`recommendBooks`, `woodpeckerSchedule`,
`bookDifficultyFeedback`, `modalityRecommendation`), and the M14 tests under
`tests/unit/server/library.test.ts`, `tests/unit/server/external-activities.test.ts`,
`tests/unit/methodology/book-study.test.ts`, and `tests/unit/methodology/modality.test.ts`.
The configured database reports all 12 repository migrations applied, including the M13 tablebase
cache migration. M14 intentionally adds no migration.

| Slice | Checked evidence                                                                                                                | Current truth and owner note                                                                                                                                                                                                                                                                                                                                                      |
| ----- | ------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| M0    | `.nvmrc`, `package.json`, `.github/workflows/ci.yml`, `next.config.mjs`, GitHub deployment records                              | Complete. CI is green and Vercel has successful production deployments through 2026-07-09. The deployment target is protected by Vercel SSO, so anonymous route and header smoke tests remain unverified.                                                                                                                                                                         |
| M1    | `src/integrations/`, `src/server/auth*`, `src/server/routers/connections.ts`, `prisma/migrations/0_init`                        | Complete. The existing handoff records live Lichess and tokenless Chess.com verification.                                                                                                                                                                                                                                                                                         |
| M2    | `src/server/import.ts`, `src/app/api/cron/import/route.ts`, `vercel.json`, `20260620000000_m2_import_profile`                   | Complete in code and schema. Local `CRON_SECRET` is set. The owner must still verify the Vercel environment secret and a production cron invocation.                                                                                                                                                                                                                              |
| M3    | `scripts/ingest-puzzles.ts`, `src/db/puzzles.ts`, `src/integrations/catalog.ts`                                                 | Current database has puzzle and ResourceRef rows. `npm run check:puzzles -- fork 1500` selected 10 rows in 2036.9 ms. The blueprint has no target latency, so performance is an explicit owner check. Fresh environments still need CSV download, ingest, and resource seeding.                                                                                                   |
| M4    | `src/lib/constraints.ts`, `src/server/constraints.ts`, `src/app/onboarding/`, `20260621000000_m4_constraints_assessment`        | Complete in code and schema. Constraint capture is broader than the generator currently consumes, as detailed below.                                                                                                                                                                                                                                                              |
| M5    | `src/analysis/`, `src/lib/raw-features.ts`, `20260621010000_m5_analysis_result`                                                 | Complete for client-side raw feature production. Phase, clock, conversion, opening, and motif measurements are stored as raw data.                                                                                                                                                                                                                                                |
| M6    | `src/engine/generator.ts`, `src/server/program.ts`, `/today`, `20260621020000_m6_program`                                       | Complete for the stub-config daily generator and transparency snapshots. The generator still does not consume accumulated `SkillState`.                                                                                                                                                                                                                                           |
| M7    | `src/engine/adaptation.ts`, `src/server/tracker.ts`, `src/db/tracker.ts`, `20260621030000_m7_tracker_adaptation`                | Complete for the v0 loop. SkillState is updated and displayed, but is not a generator input. Solve-time grading remains inactive because band medians are not populated.                                                                                                                                                                                                          |
| M8    | `src/components/transparency-card.tsx`, `src/app/progress/`, `src/server/progress.ts`                                           | Complete for the current transparency and expectations surfaces.                                                                                                                                                                                                                                                                                                                  |
| M9    | `src/engine/events.ts`, `src/server/engagement.ts`, `20260622000000_m9_engagement`                                              | Complete for completion events, capped reminders, streaks, and the grid. The automatic `day_missed` sweep remains an M15/P2 job.                                                                                                                                                                                                                                                  |
| M10   | `src/engine/interactive/`, `src/components/interactive-board.tsx`, `/train`, `tests/unit/engine/interactive/`                   | Complete. BUILD.md had stale unchecked M10 boxes; they are corrected in this audit.                                                                                                                                                                                                                                                                                               |
| M11   | `/train/[itemId]`, onboarding calibration, `tests/unit/puzzles/redo-flow.test.ts`, `tests/unit/methodology/calibration.test.ts` | Complete in code and tests. The full signed-in Stockfish journey remains a manual production-like check, as the existing handoff says.                                                                                                                                                                                                                                            |
| M12   | `/analysis/[gameId]`, `src/engine/interactive/blunder-drill.ts`, `20260622010000_personalization_capture`, M12 tests            | Complete in code and tests. Blunder-derived drills do not yet become generator weakness signals beyond the existing blunder-rate path.                                                                                                                                                                                                                                            |
| M13   | `src/engine/interactive/endgame.ts`, `src/server/tablebase.ts`, `src/db/tablebase.ts`, `20260624010000_m13_tablebase_cache`     | Complete in code and schema. Tablebase use is optional and cache-first; the full signed-in Stockfish play-out remains a manual check.                                                                                                                                                                                                                                             |
| M14   | `/library`, `src/server/library.ts`, M14 methodology tests                                                                      | Complete. Books remain external, `book_session` remains an existing `ActivityEvent`, and `ResourceProgress` is a derived roll-up rather than a table.                                                                                                                                                                                                                             |
| M15   | `prisma/schema.prisma`, `src/app/api/cron/`, `src/server/account.ts`, `public/`                                                 | Incomplete and not started. There is no allowlist, API budget model or middleware, Sentry or privacy-safe analytics, PWA manifest/service worker, adaptation or deletion cron, or hard-delete job. Export currently omits user-owned `PracticeItem` rows and deletion only sets `User.deletedAt`. P2 owns runtime hardening; P3 owns privacy, consent, export, and hard deletion. |

#### Manual setup and deployed-state inventory

- The local toolchain is correct: Node `v25.2.0`, npm `11.6.2`, and `.nvmrc` `25.2.0`.
- `.env.local` has `DATABASE_URL`, `AUTH_SECRET`, Google credentials, and `CRON_SECRET` set. The
  optional `LICHESS_CLIENT_ID` and `CHESS_API_USER_AGENT` are empty and therefore use documented
  defaults. The production value of `CRON_SECRET` must be verified in Vercel settings.
- `npx prisma migrate status` reports 12 migrations found and `Database schema is up to date` for
  the configured Supabase database. Old BUILD.md notes telling the owner to apply M2 through M13
  migrations were stale and have been corrected.
- The ignored local puzzle files exist (`lichess_db_puzzle.csv`, 1.1 GB, and its 287 MB zstd source).
  They are not repository assets. A fresh environment must download and decompress the current CC0
  source, then run the idempotent ingest and resource seed scripts.
- `scripts/setup-stockfish.mjs` is run automatically by `predev` and `prebuild`; the required WASM
  assets are present under `public/stockfish/`.
- GitHub CI run `29047330485` passed for `3ca1e37`. GitHub deployment `5382231452` reports Vercel
  Production success with target `https://mainline-6egkt0yrs-joebos.vercel.app`. Anonymous requests
  receive the Vercel SSO redirect, so an authenticated owner smoke test is still required.

#### Constraint and generation audit

The current ConstraintSet schema is in `src/lib/constraints.ts`; persistence and normalization are in
`src/server/constraints.ts`. `generateAndSaveProgram` reads only `minutesPerDay`, `formats`, owned
resource labels or refs, and `sessionStyle.depthVsBreadth` before calling the pure generator at
`src/server/program.ts:213-253`. The generator accepts those four constraint inputs at
`src/engine/generator.ts:81-104` and passes them to `prioritizeDailyMix` at
`src/engine/generator.ts:172-183`.

| Input                          | Current effect on generation                                                                                                                                                         |
| ------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `minutesPerDay`                | Direct hard packing cap.                                                                                                                                                             |
| `formatPrefs.formats`          | Format mismatch scoring and play-game params.                                                                                                                                        |
| `ownedResources`               | Owned book matching and daily-mix preference when a catalog match exists.                                                                                                            |
| `sessionStyle.depthVsBreadth`  | Config-weighted weakness or ROI preference.                                                                                                                                          |
| `daysPerWeek`                  | Persisted in `generationInput`, but no day selection or volume decision uses it.                                                                                                     |
| `goals`                        | Persisted and shown in onboarding/reveal, but not a generator input. Rating goals are not yet translated to process work.                                                            |
| `formatPrefs.preferredVariety` | Captured, but not read by the generator or provider.                                                                                                                                 |
| `sessionStyle.interleave`      | Captured, but `practiceStructure` currently uses band config only and does not receive this preference.                                                                              |
| `ifThenPlan`                   | Normalized through `buildImplementationIntention` and persisted, but not used to generate a session.                                                                                 |
| `formatPrefs.targetFocus`      | Used by the library and board/calibration affordances, not by daily candidate generation.                                                                                            |
| accumulated `SkillState`       | Updated by M7 and shown by progress surfaces, but absent from `GenerateProgramInput`; generation still uses tactical calibration, raw signals, due items, and rolling track success. |

The persisted `generationInput` at `src/server/program.ts:273-287` snapshots some of these values,
but does not snapshot goals, preferred variety, interleave, if-then plan, target focus, or current
SkillState. This is an explicit P4/P5 foundation gap, not a P0 implementation target.

#### Diagnostic signal audit

`RawGameFeatures` in `src/lib/raw-features.ts` currently carries move evaluations, blunders and raw
motif tags, phase aggregates, clocks, conversion, and opening deviation. The only game-derived
weakness signal emitted by `interpretGameFeatures` is the confidence-gated blunder-rate signal in
`src/methodology/provider.ts:441-511`, and `generateAndSaveProgram` is the only path that feeds it to
the generator. Phase localization, conversion/save, time-use/VOC, opening leakage, and recurring
motif signals are not active generator signals. `gameAnalysisProtocol`, RPL filtering, tilt checks,
success-biased game selection, and SRS puzzle derivation are active analysis-surface behavior, but
their outputs do not become `WeaknessSignal` values for daily generation.

#### Methodology gap inventory

The active pointer is hard-coded to `stub-0.1.0` in `src/methodology/loader.ts:12-19`; no
`research-*.json` exists. The loader is fail-closed and deep-freezes the config, and the current
config validates with 411 graded leaves. Its flags are 281 `best-guess`, 18 `contested`, 5
`semi-evidenced`, and 1 explicit `stub`. The 35 rationale entries include four explicitly flagged
`best-guess` entries. C/D rationale entries are softened by schema and guard tests.

| Seam                      | Checked current implementation                                                                                                                                                                                                        | Missing, partial, stale, or user-facing-stub truth                                                                                                                                                                                                                                                          |
| ------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1. Dimensions and bands   | Six graded bands and seven dimensions load from `stub-0.1.0`; band lookup and labels are active.                                                                                                                                      | METHODOLOGY.md also specifies a `psych` stub dimension, measurable definitions, primary signals, trainability, and a per-band salience prior. The shipped config contains only dimension ids and labels, omits `psych`, and has no salience matrix. The omission is safe but must be explicit in P1.        |
| 2. Assessment             | New `research-1.2.0` assessments use one three-item tactical track; historic 1.0/1.1 assessments continue under their persisted three-track methodology. The adaptive ladder, in-app puzzle selection, and graded scoring are active. | The shorter calibration is a Grade C product best guess that needs completion and measurement-quality telemetry. The documented `noHistoryFallback` is not a config field. The estimate is a tactical/calibration seed, not a general skill diagnosis.                                                      |
| 3. Game interpretation    | Thresholds, contested blunder baselines, and sample gates are present; only blunder rate is emitted.                                                                                                                                  | Phase, conversion, clock/VOC, opening, motif recurrence, ACPL/STDCPL, and opening sample gates from METHODOLOGY.md are not active interpretation paths. Raw measurements exist but are not consumed as signals.                                                                                             |
| 4. Resource mapping       | Nine activity definitions cover internal and external delivery, plus three weakness rules for board vision and endgames. M14 book and modality data are present.                                                                      | The broad research mapping is partial: no active rules for time, opening, conversion, recurring motifs, or most dimensions. Several activity priorities and delivery choices are explicitly stub or best guess.                                                                                             |
| 5. Difficulty             | Pattern and calculation tracks, servo targets, band structure, and worked-example config are present.                                                                                                                                 | `practiceStructure` does not consume motif mastery or the captured interleave preference. The documented per-band pattern/calculation time split is not represented as a dedicated config field. Seeds and targets remain stub or contested.                                                                |
| 6. Scheduling             | FSRS parameters, outcome grades, maximum interval, and configurable intra-session retest delay are present.                                                                                                                           | Fallback intervals, beginner micro-spacing policy, and full hint policy are not represented in the config. `src/server/tracker.ts` passes `bandMedianMs: null`, so fast/slow solve-time grading is inactive and v0 effectively uses correct versus incorrect only.                                          |
| 7. Prioritization         | Weighted daily mix, due reviews, format fit, owned resources, depth/breadth, and time packing are active.                                                                                                                             | Goals, days per week, preferred variety, interleave, target focus, if-then plan, and SkillState do not affect the generated day. The seven-day/stable-focus/revision behavior belongs to later P4-P6.                                                                                                       |
| 8. Rationale and evidence | 35 rationale entries, evidence ledger, graded snapshots, softened C/D copy, and transparency cards are active.                                                                                                                        | `ProgramItem` has no `flag` field and `toTodayItem` does not pass `rationale.flag` to item-level `TransparencyCard`, so the four explicitly flagged rationale entries are not directly labelled Placeholder on those cards. `soften` still supplies a caveat. The active config remains a user-facing stub. |
| 9. Engagement             | Config-bounded reward events, capped streaks, consistency grid, and reminders are active.                                                                                                                                             | The `day_missed` policy has no automatic daily sweep until M15. Peer comparison and bounded-choice config exist but their UI is not built. Tilt cooldown remains an explicit stub.                                                                                                                          |
| Measurement               | Glicko CI, baseline, plateau, expectations copy, and progress dashboard are present.                                                                                                                                                  | Values are still stub or best guess and are not a research release. No observational export or consent gate exists; that is P3/P9 scope.                                                                                                                                                                    |

There is also provider/config drift that P1 must resolve before a research release. The methodology
provider still contains decision values outside config, including tilt fallbacks and windows at
`src/methodology/provider.ts:1502-1546`, game-selection scoring thresholds and bonus values at
`src/methodology/provider.ts:1578-1606`, the entropy window at line 1722, and a defensive RPL
threshold fallback at line 1861. These are not being changed in P0, but they must either become
graded config values or be proven generic infrastructure values before P1 activates a research
version.

The actual Zod contract in `src/methodology/schema/config.ts` also includes the implemented
extensions `gameAnalysis`, `board`, `endgameCurriculum`, `bookStudy`, and `modality`. Those fields
were missing from the older top-level shape in BUILD.md and are now recorded there as Seam-4
extensions. METHODOLOGY.md remains unchanged because this audit changes no scientific source of truth.

#### Handoff and owner actions

- P1 should create an immutable `research-*` config, preserve `stub-0.1.0`, reconcile the missing
  seam fields above, and eliminate provider/config drift without inventing evidence. It must retain
  explicit stubs and preserve the central no-causation caveat.
- P2 should implement the M15 operational gaps, then verify Vercel environment variables, cron
  execution, external API budgets, retry/recovery behavior, monitoring scrubbing, and PWA behavior
  against the deployed SSO-protected target.
- P3 should implement versioned research consent, complete export coverage including `PracticeItem`,
  and idempotent hard deletion. Personal training must continue without research consent.
- Before beta, the owner must define the M3 puzzle-query latency target, run an authenticated
  production-like smoke journey, and complete the M15 recovery and deletion drills.

Deliberate P0 deviations: no migration was needed, no code or UI was added, no later part was started,
and METHODOLOGY.md values were not edited. The remaining risks are the incomplete M15 hardening, the
stub-only active methodology, generation state omissions, the single active game signal, unverified
Vercel secrets and authenticated smoke coverage, and the undefined puzzle-query latency target.

---

### P1: Research methodology release

**Goal:** ship the first active, reproducible `research-*` methodology version without changing Engine
architecture.

**Agent work:**

- Encode the already-approved METHODOLOGY.md values, grades, tiers, citations, flags, and copy into a
  new immutable config version. Do not invent values to fill gaps; retain explicit stubs where the
  methodology says evidence is thin.
- Ensure every referenced rationale and citation resolves and every Grade C/D rationale is softened.
- Add release metadata and a methodology changelog entry identifying retained best guesses and
  deliberate stubs.
- Switch the active pointer only after all config, golden, and architectural guard tests pass.
- Preserve old config files so historic programs remain reproducible.

**Definition of Done:** a research config boots fail-closed, historic stub programs still render,
the active config is explicit, and the app no longer presents its complete methodology as an
unqualified placeholder.

**Status (2026-07-10): COMPLETE.** `research-1.0.0` is a separate, validated config derived from
the approved current methodology values already encoded through M14. The loader now uses an explicit
research pointer by default, while `stub-0.1.0` remains loadable for historic programs and rollback.
Both configs are deep-frozen at load time. All rationale and evidence-ledger citations resolve, and
C/D rationale entries remain softened. The structured-analysis runtime defaults, game-selection
scoring thresholds, entropy window, and RPL fallback that P0 identified as provider drift are now
graded config leaves with their existing best-guess labels. The About page shows the active release
and its unresolved stubs rather than describing the active methodology as a complete placeholder.
The historic stub file is byte-for-byte unchanged; additive graded compatibility data preserves its
pre-release provider behavior. Today and training surfaces load the methodology version persisted on
the program, so old programs never mix current labels, delivery rules, citations, or global copy.
The research taxonomy now carries its approved measurable definitions, signals, predictive notes,
and trainability labels. The redo scaffold, including its delay, visual hint behavior, copy, grade,
tier, and citation, is read through the pure methodology surface rather than decided in the app.
Observational and Tier-2 rationale copy uses association and extrapolation language without rating
causation or permanent-memory claims.

Release metadata lives in `src/methodology/releases.ts` and
`src/methodology/releases/research-1.0.0.json`. The public release record is
`planning/METHODOLOGY_CHANGELOG.md`; it names retained best guesses, deliberate stubs, and the
rollback version. No database migration or Engine architecture change was needed.

Verification: `npm run typecheck`, `npm run lint`, 49 unit files with 298 tests,
3 guard files with 38 tests, `npm run build`, and 16 Playwright tests all pass. The rollback setting
also passes its 43 targeted release, config, and historic-program tests.

#### P1 handoff

- Owner action: review the release metadata and changelog, deploy the uncommitted changes through the
  normal CI path, then verify the authenticated About and Today surfaces in the production-like
  environment. `METHODOLOGY_VERSION` may be set to `stub-0.1.0` for an intentional rollback.
- Owner action: keep the active research version under human review before closed-beta invitations.
  It is evidence-labeled, but it still contains the explicit best guesses and stubs listed in the
  changelog.
- Deliberate deviation: the research release promotes the current approved config without inventing
  new scientific values or activating later diagnostic signals. Phase, conversion, time-use,
  opening, recurring-motif, and longitudinal decision-state work remains with later roadmap parts.
- Remaining risks: P2 and P3 M15 work is still incomplete; production deployment and authenticated
  smoke coverage remain owner actions; the research release does not establish causal evidence for
  any training activity and must not be described as doing so.

---

### P2: Beta access, API budgets, jobs, monitoring, and PWA

**Goal:** finish the runtime and operational portion of BUILD.md M15.

**Agent work:**

- Add the allowlist/invite gate without breaking existing owner access.
- Add per-user external API budgets and retain polite platform-specific rate limiting and caching.
- Make import, adaptation, deletion, and other scheduled jobs idempotent, observable, retryable, and
  manually recoverable.
- Add privacy-respecting error monitoring and the minimum analytics needed to diagnose the core loop.
- Ensure monitoring never captures OAuth tokens, PGNs, free-text feedback, or other sensitive payloads.
- Add the installable PWA manifest/service-worker behavior required by M15, while preserving
  Stockfish COOP/COEP requirements.

**Definition of Done:** the closed beta can be bounded, operational failures are visible and
recoverable, external platforms are protected, and the M15 runtime tests pass.

**Status (2026-07-11): COMPLETE.** New OAuth admission now fails closed unless the user has a current
email/code allowlist entry, a persisted grant backfilled for existing accounts, an admin role, or a
narrowly configured owner email. Invite codes bind atomically to one account after Auth.js creates
the database user, expired entries are excluded, soft-deleted
accounts are refused, and an owner CLI creates expiring email or code entries. `ApiCallBudget`
provides atomic fixed-window buckets per user and platform. Every actual Lichess/Chess.com attempt,
including a polite 429 retry and cron work, consumes budget; durable tablebase caching and incremental
game import remain in place.

`JobRun` now has a durable queued state, heartbeated leases, fenced attempts, sanitized error codes,
stale/error reclamation, and immutable successful keys. The one free-tier daily route persists every
import, daily adaptation, and configured missed-day job before draining a bounded deadline, plus
bounded cleanup of old success/budget rows. It returns 503 when work fails or remains queued. Admins
can inspect safe job metadata and retry queued or failed import, adaptation, and missed-day jobs from
Settings. The generic runner is ready for P3 deletion work without implementing the P3 purge here.

Sentry is integrated for server, edge, client, request, and global-render failures. A tested
fail-closed filter strips identity, tokens, headers, cookies, URLs/query strings, bodies, PGNs,
free text, arbitrary tags/extras, and raw exception messages. Replay and tracing are disabled. Typed
aggregate events cover import, analysis handoff, program generation, adaptation, and job outcomes.
The PWA ships an App Router manifest, 192px/512px/maskable icons, a registered service worker that
caches only versioned static assets/icons/Stockfish, and service-worker security headers while
preserving app-wide COOP/COEP.

#### P2 handoff

- Migrations: apply `20260711000000_m15_beta_access_api_budgets` and
  `20260711010000_m15_runtime_jobs`, followed by
  `20260711020000_m15_invite_claim_cascade`, with `npm run prisma:deploy`. The runtime migration
  sanitizes legacy job errors and makes legacy running rows retryable. The final migration ensures
  account erasure cannot reactivate a claimed invitation.
- Owner setup: configure `BETA_OWNER_EMAILS`, `CRON_SECRET`, the Sentry DSNs/project-scoped upload
  credentials, and a descriptive `CHESS_API_USER_AGENT` in Vercel. Optionally tune the two hourly API
  caps. Create invitations with `npm run beta:invite`. The full deployment/recovery/PWA checklist is
  in `planning/OPERATIONS.md`.
- Verification: Prisma generation, typecheck, lint, 60 Vitest files with 370 tests, 4 guard files
  with 39 tests, production build, and 19 Playwright tests all pass. Playwright verifies closed-beta copy,
  manifest/service-worker registration and cache scope, preserved Stockfish isolation headers, and
  fail-closed cron authorization.
- Deliberate deviation: the budget is reserved immediately before each real outbound attempt rather
  than only in tRPC middleware. This also covers cron, cache-miss tablebase calls, connection
  validation/revocation, and HTTP retries that bypass tRPC. The generic deletion-job substrate lands
  here, but the actual purge and its end-to-end deletion proof remain P3 by the roadmap contract.
- Owner verification still required: run an invited authenticated production-like core-loop smoke,
  confirm the Vercel daily cron stays inside its 60-second envelope at expected beta load, inspect a
  safe Sentry test event after ingestion, and install/launch the PWA on the protected HTTPS target.
- Remaining risks: deployed secrets and vendor ingestion cannot be proven from the repository; the
  OAuth/seeded-database invited full loop is not available in CI; `npm audit --omit=dev` reports the
  existing moderate nested PostCSS advisory through Next.js with no non-breaking npm fix; P3 privacy,
  complete export, consent, and hard deletion remain intentionally incomplete.

---

### P3: Privacy, consent, export, and hard-deletion completion

**Goal:** make the built-in-study promise safe and understandable before collecting feedback or
secondary-use data.

**Public interfaces:**

- `ResearchConsent`: user, consent-text version, granted scopes, granted/withdrawn timestamps.
- `DataUseNoticeVersion`: stable identifier for the notice shown when consent was recorded.

**Agent work:**

- Separate data required to operate personal training from optional secondary aggregate research use.
- Add versioned research consent, withdrawal, and an audit trail. Do not bundle consent into general
  account creation.
- Complete the hard-delete purge after the existing soft deletion, with idempotent job handling.
- Extend data export and deletion tests to all current tables and to the new consent records.
- Add clear in-product descriptions of what is collected, why, how methodology versions use it, and
  how users export, withdraw, or delete.
- Obtain an explicit owner review of the final privacy and consent copy before enabling research
  capture. This roadmap is not legal advice.

**Definition of Done:** operational training works without research consent, secondary-use capture
honors consent and withdrawal, export is complete, and hard deletion is verified end to end.

**Status (2026-07-11): COMPLETE.** P0 is complete, the repository implementation and tests pass,
the production migration is applied, and hard deletion is verified end to end. The owner explicitly
approved the final privacy and consent copy on 2026-07-11. Personal training has no consent gate.
Consent is a separate, versioned audit history with explicit scope, withdrawal, regrant, and a
fail-closed current-notice predicate. P9 secondary research capture remains disabled, so P3 does not
claim that de-identification or aggregate research processing already runs. All P3 Definition of Done
gates pass.

#### P3 handoff

- Delivered: migration `20260711030000_p3_privacy_consent_purge`; public consent and notice types;
  server-authoritative current-scope eligibility; exact displayed-notice binding for grants; grant and
  withdrawal APIs; Settings privacy, consent, export, and erase controls; credential-redacted
  `mainline-user-export/v2`; and an opaque-token purge ledger and job. Active old-version consent is
  ineligible, remains withdrawable, and does not prevent a separate opt-in to the current notice.
- Export coverage: safe User fields; Account and Session metadata without credentials; redacted
  PlatformConnection; profiles; games with AnalysisResult; Assessment; ConstraintSet; Program with
  ProgramItem; ActivityEvent; SkillState; ScheduleState; personal PracticeItem; AdaptationLog;
  RewardEvent; NotificationPref; ApiCallBudget; claimed AllowlistEntry without invite code; and the
  full ResearchConsent audit. Global puzzles, resources, tablebase cache, and curated practice rows
  remain excluded.
- Deletion behavior: the request transaction marks the user deleted, assigns a random token, creates
  one purge ledger, and queues one purge job whose key contains no user or connection id. An immediate
  attempt runs through P2 fencing. Daily and admin recovery retry incomplete jobs. Hard deletion removes
  prior job keys containing account identifiers, deletes local OAuth/session secrets by User cascade,
  and leaves only the non-identifying completed ledger. Account purge has priority over import and
  missed-day work. The API reports erased only after the runner completes or proves prior completion;
  active or superseded attempts remain queued. Missing users and repeated requests are safe. External
  provider revocation failure cannot block deletion.
- Verification: Node 25.2.0; Prisma generation; typecheck; lint; 63 Vitest files with 391 tests;
  4 guard files with 42 tests; production build; and 19 Playwright tests pass. After replacing the
  export's 19-query fan-out with sequential queries, 6 targeted P3 files with 26 tests, typecheck,
  lint, and the production build pass. On 2026-07-11, the configured Supabase production database
  reports migration `20260711030000_p3_privacy_consent_purge` applied. A guarded disposable-account
  drill passed personal protected training without consent; consent grant, withdrawal, and regrant;
  complete credential-redacted v2 export; stale purge recovery; removal of every direct and indirect
  owned row and correlated JobRun; preservation of sampled global rows; and retention of only an
  opaque completed purge ledger. Every disposable drill User was removed, including failed attempts.
- Owner actions: no remaining P3 completion action. Keep research capture disabled until P9. The
  owner's privacy-copy approval is recorded, but this roadmap is not legal advice and appropriate
  legal review remains a general release consideration.
- Deliberate deviations: no methodology config values were added because privacy governance is not a
  chess or learning decision. No research capture or de-identification pipeline was added because P9
  owns it. `VerificationToken` has no User foreign key and OAuth-only Mainline creates no attributable
  verification-token row, so purge does not guess identity matching or delete global token rows.
- Remaining risks: the production hard-delete drill did not verify external provider-side token
  revocation, which cannot block local deletion. Notice text changes require a new notice id and owner
  review. Appropriate legal advice remains a general release consideration, not a P3 completion
  blocker.

---

### P4: Decision-state and skill-history foundation

**Goal:** give the generator the longitudinal state needed for genuine personalisation.

**Public interfaces:**

- `SkillStateSnapshot`: immutable per-dimension state after an adaptation run, including uncertainty,
  sample size, methodology version, and timestamp.
- `ProgramDecisionInput`: a typed snapshot containing current constraints, goals, latest SkillState,
  skill history, due work, activity recency, adherence history, owned resources, recent success, and
  feedback-derived preference state.
- `TrainingPreferenceState`: derived fit preferences only, never a skill estimate.

**Agent work:**

- Persist SkillState history while keeping the latest-state query efficient.
- Build one typed server-side state assembler. Do not let routes independently reconstruct partial
  decision state.
- Derive activity recency, completion/skip history, and actual duration summaries from immutable
  events and program history.
- Snapshot the assembled decision input on each generated focus/program for reproducibility.
- Do not change recommendations yet. P5 consumes behavioral state for weekly focus; P8 may later
  consume positive fit only in downstream delivery selection.

**Definition of Done:** decision state can be deterministically reconstructed, historic snapshots are
immutable, export/delete include them, and no new chess decision appears in Engine or server code.

**Status (2026-07-11): COMPLETE.** The repository implementation, migration, and tests pass the full CI
order, and every P4 Definition of Done gate is met.

The data model gains two new tables, both cascade-on-User-delete (verified by the privacy-schema guard):
`SkillStateSnapshot` (append-only immutable per-dimension history stamped with
`methodologyVersion` + `runAt`, no `updatedAt`, no unique key — every adaptation run may append) and
`TrainingPreferenceState` (one row per user, `userId @unique`, the derived-fit-preferences rollup P4
ships empty and P8 will populate). The existing `SkillState` table remains the cheap latest-state view
(upserted); the new snapshot table is the longitudinal memory the assembler reads.

One typed server-side assembler (`assembleProgramDecisionInput` in `src/server/decision-input.ts`) is
the single constructor of decision state. Routes call it; they never reconstruct partial decision state
from independent reads. Its output, `ProgramDecisionInput` (typed in `src/lib/decision-input.ts` with a
strict Zod schema), is persisted verbatim onto `Program.generationInput` on every generation, replacing
the ad-hoc M6 snapshot. Any historic "Today" can now be re-derived exactly from the persisted
snapshot + config version: `parsePersistedSnapshot` re-validates it fail-closed. The pure generator's
narrow `GenerateProgramInput` is a strict projection of the snapshot, so later decision consumers can
read or extend it without re-architecting the seam.

Activity recency, completion/skip counts, and actual-duration sums are derived (in
`src/db/decision-input.ts`) from immutable `ActivityEvent` rows over a trailing 28-day window (the
BUILD.md active-user window), with a 28-day `activeDays` count and totals per activity type. No graded
chess decision lives there: it is generic descriptive aggregation.

Every adaptation pass now appends one immutable `SkillStateSnapshot` per dimension it touched, stamped
with the run's logical time (matches `AdaptationLog.runAt`) and the active methodology version. This is
wired into `persistAdaptation` in `src/server/tracker.ts` and verified by a new test that pins the
snapshot row shape. The `runDailyAdaptation` path inherits the same wiring (it reuses the same
`persistAdaptation` helper).

The export (`exportUserData`) and the deletion cascade now cover both new tables. The credential-redacted
`mainline-user-export/v2` payload carries `skillStateSnapshots` and `trainingPreferenceState`; the
privacy-schema guard asserts both new models have `onDelete: Cascade` in both the schema and the
`20260711040000_p4_decision_state_skill_history` migration. The export test's sequential-query counter
was updated from 19 to 21 and now asserts the new keys are present.

The Settings privacy section's text now mentions the immutable skill-state history, the per-program
decision-input snapshot, and the optional training-fit preferences so a user reading /settings sees
what their export contains. No new full UI surface is warranted by P4's Definition of Done; P5 owns the
first behavioral-state consumer for weekly focus, while P8 owns the training-fit writer, downstream
delivery tie-break, and reset surface.

No new chess or learning-science decision appears in Engine or server code (L1 preserved). The assembler
reads the pure methodology provider for `bandForRating`, `interpretGameFeatures`, and
`resolveTacticalRating`/`resolveLibraryRating`; it owns no chess constant. The pure core of
`generateProgram` is unchanged. The L2 lint rule still passes (no `Date.now()`/`Math.random()`/`new Date()`
in `engine/` or `methodology/`); the new `db/decision-input.ts` default for a missing
`TrainingPreferenceState` row uses the stable sentinel `updatedAt: 0` rather than `Date.now()` so two
identically-empty states produce an identical snapshot (L2 reproducibility).

#### P4 handoff

- Migrations: apply `20260711040000_p4_decision_state_skill_history` with `npm run prisma:deploy`. The
  migration is additive (two new tables + indexes + cascade FKs) and contains no destructive change.
  After deploy, run `npm run prisma:generate` (already done locally) so the Prisma Client picks up the
  new models. The configured Supabase production database reports `20260711030000_p3_privacy_consent_purge`
  as the latest applied migration; this migration is one step further and remains pending until the owner
  deploys. The e2e suite passes regardless because the auth-gated routes it exercises do not read the
  new tables, but a real signed-in `/today` regeneration will start writing `SkillStateSnapshot` rows as
  soon as the migration is live.
- Owner setup: no new env vars, no new cron kinds, no new admin tools.
- Verification: Node 25.2.0; Prisma generation; typecheck; lint (0 errors, 0 warnings); 65 Vitest files
  with 408 tests; 4 guard files with 44 tests (up from 42);
  production build; and 19 Playwright tests all pass.
- Deliberate deviations: the assembler runs once per program generation (after `ensureEndgameDrills`
  seeds endgame schedules) rather than twice. It sits inside `generateAndSaveProgram`, so server code
  still contains the one orchestration call, but routes never independently read partial decision state.
  No methodology config values were added, no chess/learning constants were introduced, and
  `generateProgram` is byte-for-byte unchanged; the snapshot is pure plumbing for later consumption. The
  `TrainingPreferenceState` table ships with an empty default; P8 is the first writer and owns the reset
  affordance. The `programItem` model was removed from the assembler's `Db` Pick because it is unused
  there, even though `logOutcome` continues to read it directly via `src/server/tracker.ts`.
- Remaining risks: `SkillStateSnapshot` is append-only and grows with every adaptation pass; a user
  training daily can append ~30 rows/day. The free-tier Supabase limit tolerates this for many users, but
  a future prune roll-up (similar to P2's `pruneOperationalRows`) is a P2 follow-up, intentionally not
  implemented here to avoid widening P4's scope. The 28-day `findActivityRecency` window reads all
  ActivityEvents for the user over that window; for very active users this is bounded but not indexed —
  a future `(userId, occurredAt)` index optimization belongs to P9 (observational capture) when
  recency becomes a hot read. The snapshot's `constraints` field carries the persisted `id`/`version`
  in the in-memory record (mirrors `decodeConstraintSet`); the strict outer schema strips them silently
  during `programDecisionInputSchema.parse`, so the persisted shape matches the parsed shape exactly.
  A future `Forget my decision history` affordance for the user is intentionally not built (P8 scope).
  No causal skill claim is added: the skill estimates are competence proxies, never a chess-development
  prescription (Seam 2 boundary preserved).

---

### P5: Stable weekly focus and bounded user choice

**Goal:** make accumulated state materially change the plan without producing noisy daily thrashing.

**Public interfaces:**

- `WeeklyFocus`: week start, ordered focus areas, supporting signals, confidence, methodology version,
  input snapshot, status, and rationale snapshots.
- `FocusAlternative`: a goal-aligned option that remains inside methodology-approved bounds, with an
  explicit tradeoff rationale.
- Pure methodology functions `selectWeeklyFocus(...)` and `shouldReviseWeeklyFocus(...)`.

**Agent work:**

- Add graded config for focus selection, stability/revision policy, and bounded alternatives. Exact
  stability values are Grade C/best-guess until telemetry supports calibration.
- Feed SkillState, confidence-gated game signals, due learning, goals, constraints, and recency into
  weekly focus selection. Carry owned-resource and fit state in the decision snapshot for downstream
  delivery selection, but do not use either to select or suppress a skill focus.
- Make evidence lead by default. Offer a bounded goal-aligned alternative instead of an unrestricted
  manual category override.
- Keep rating goals out of the daily objective. Translate them into process-focused work.
- Make a meaningful confidence crossing or constraint change eligible to revise focus. Do not revise
  because one noisy result arrived.
- Snapshot why a focus was selected, why an alternative was allowed, and why a revision happened.

**Definition of Done:** changing a meaningful input produces a traceable focus change; identical
inputs reproduce the same focus; low-confidence noise does not churn focus; subjective feedback
cannot alter SkillState.

**Status (2026-07-12): COMPLETE.** P5 now persists an immutable weekly prescription in
`WeeklyFocus`, including the ordered focus areas, confidence, supporting signals, complete P4
decision-input snapshot, methodology version, status, bounded alternatives, selection rationale,
and any revision trigger and rationale. Historic focus rows are superseded rather than rewritten,
and User deletion cascades through the new table. The account export includes all focus history.

The active methodology is `research-1.1.0`. It adds graded focus selection, stability, meaningful
revision thresholds, structural goal-to-process mappings, fit weights, and bounded-alternative copy.
All exact stability and weighting values are Grade C best guesses. The base bytes for
`research-1.0.0` and `stub-0.1.0` remain unchanged; additive compatibility overlays keep both
rollback versions loadable. `selectWeeklyFocus` and `shouldReviseWeeklyFocus` are pure and use stable
identifier tie-breaks. Rating-goal labels and arbitrary free text are never parsed into daily
objectives.

Program generation now creates or reuses the active focus from the single P4 assembler and applies
it to discretionary candidate selection while preserving due learning. Medium-confidence crossings,
meaningful constraint changes, accumulated skill changes, stability-window expiry, and methodology
changes can create a traceable revision. One low-confidence result cannot. Training-fit preferences
remain part of the reproducible decision snapshot and no P5 path writes `SkillState`.

**Product correction (2026-07-15).** Subjective training fit no longer contributes to weekly skill
focus scores. P8 may use positive fit feedback only as a tie-break among activities that already
serve the selected focus. Negative enjoyment, perceived difficulty, and friction may be stored and
explained, but they cannot remove due work, weaken difficulty, manufacture a weakness, or lower the
priority of a measured need.

Today shows the persisted focus, confidence, rationale, and only the snapshotted approved
alternatives. Selecting an alternative is authorized against that snapshot, persists the choice,
and regenerates Today. P6 forecast/revision-ledger work and P7 history UI were not started.

#### P5 handoff

- Migration: apply `20260712000000_p5_weekly_focus` with `npm run prisma:deploy`, after the pending
  P4 migration, then run `npm run prisma:generate` in the deployed build.
- Owner action: deploy through the normal CI path and smoke an authenticated Today generation,
  stable regeneration, meaningful constraint revision, and bounded-alternative selection.
- Verification: Prisma format/generation, typecheck, lint, 66 Vitest files with 419 tests,
  4 guard files with 53 tests, production build, and Playwright all pass. Playwright used port 3001
  because the owner's existing Next dev server occupied port 3000; that dev process was preserved.
- Deliberate deviations: alternatives are stored as typed JSON snapshots on `WeeklyFocus` instead of
  a child table because they are a small immutable part of one decision artifact. P5 stores revision
  trigger/rationale on the focus itself; the cross-forecast `ProgramRevision` ledger remains P6.
- Remaining risks: exact focus weights and stability thresholds need beta telemetry and human review;
  focus labels are currently methodology dimension identifiers in the minimal UI; production database
  migrations and the authenticated deployment smoke remain owner actions. P5 makes no causal rating
  claim, and P8 remains the first real writer of subjective training-fit preferences.

---

### P6: Seven-day forecast, revision ledger, and availability model

**Goal:** support a living program with immutable history, a committed present, and deterministic
internal projections.

**Public interfaces:**

- `WeeklyAvailability`: optional preferred weekdays and default minutes by day.
- `AvailabilityOverride`: one-date time or unavailable override.
- `ProgramDayForecast`: date, provisional status, planned activity blocks, expected minutes, focus
  links, due-review pressure, and rationale snapshots.
- `ProgramRevision`: previous/new focus or forecast ids, trigger, changed fields, graded decisions,
  methodology version, and timestamp.

**Agent work:**

- Generate a rolling seven-day forecast from weekly focus, availability, current due state, and
  constraints.
- Choose exact puzzles and personal positions on the day they are trained. Future days contain
  activity blocks, not prematurely allocated puzzle ids.
- Existing users with no preferred weekdays remain explicitly `flexible`; do not invent a schedule.
  Keep availability APIs and persisted state available to the Engine, but do not expose an editor on
  Today in Phase 1.
- Freeze Today after the first ActivityEvent. An explicit Replan preserves completed items and records
  the revision.
- Recalculate missed work without catch-up debt. Due items return through scheduling; unfinished
  discretionary volume is not blindly carried forward.
- Keep past programs and their original rationales immutable.

**Definition of Done:** the forecast is deterministic and time-budgeted, Today never changes
silently after starting, revisions are inspectable, and missed days do not create duplicate or
punitive work.

**Status (2026-07-12): COMPLETE.** P6 adds explicit flexible/preferred weekly availability, one-date
overrides, immutable seven-day forecast versions, and an append-only ProgramRevision ledger. The pure
forecast builder uses an injected logical time, stable ordering, explicit day budgets, and activity
blocks only. Each block snapshots its rationale text, grade, tier, citation, confidence, and soften
flag. Concrete puzzles and personal positions continue to resolve only when the user opens the
day's trainer. An unavailable or missed date is recalculated independently; discretionary blocks are
never copied forward, while due pressure is read fresh from the snapshotted scheduling state.

Program generation now refuses to silently replace a started Today. Once any ActivityEvent exists for
the active Program, ordinary Generate returns that same program. Availability, override, and focus
changes preserve its materialized forecast and only replace future provisional days. Explicit Replan is a separate action:
it appends replacement forecast rows and a graded revision entry while the superseded Program,
completed ProgramItems, ActivityEvents, and original rationale snapshots remain unchanged. P7 owns
the user-facing immutable history. Forecasts, availability controls, and the revision ledger remain
backend capabilities rather than Today-page surfaces. Explicit time-budget replanning stays on Today.

The four P6 models cascade on hard User deletion and are included in the credential-redacted v2 user
export. Typed strict Zod boundaries cover availability, overrides, forecast blocks, forecasts, and
revisions. No subjective availability value writes SkillState, and no chess or learning constant was
added to Engine or server code.

The P6 review follow-up serializes outcome capture and program replacement with a shared per-user
transaction lock, and persists program replacement, forecasts, and the revision entry in one
transaction. A focus alternative selected after Today starts now builds future provisional days from
the new focus while retaining committed Today. Revision links are matched by changed date and retain
the real previous and new focus ids. Replan subtracts completed concrete due references instead of
dropping an entire review activity, and UTC forecast dates render consistently across browser time
zones.

**Product correction (2026-07-15).** The earlier P6 frontend controls were retired from Today. The
future forecast repeated the program produced from the same deterministic inputs and did not add a
useful decision. The collapsed plan-settings surface was too unreliable for Phase 1. Do not rebuild
the forecast strip, weekly availability editor, day overrides, focus alternatives, or revision
ledger on Today. Their persisted models and typed APIs remain intact for deterministic Engine work
and a possible later feature designed outside the training flow.

#### P6 handoff

- Migration: apply `20260712010000_p6_forecast_availability_revision` with
  `npm run prisma:deploy`, after P4 and P5, then run `npm run prisma:generate` in the deployed build.
  The migration adds four user-owned tables, indexes, and cascade foreign keys without destructive
  changes.
- Owner action: deploy through the normal CI path and smoke an authenticated first generation,
  started-session Generate freeze, internal forecast persistence, and explicit time-budget Replan.
  No new environment variable or job is required.
- Verification: Node 25.2.0; Prisma validation/generation; typecheck; lint; 75 Vitest files with 479
  tests; 4 guard files with 73 tests; production build; and 18 Playwright tests all pass.
- Deliberate deviations: forecast and availability models remain inspectable through typed APIs,
  persistence, and export, but they have no Phase 1 Today-page controls. The forecast uses the active
  materialized day's methodology-approved activity mix as its candidate block set rather than
  generating concrete future sessions, which prevents premature item allocation.
- Remaining risks: a forecast is refreshed by generation, persisted availability changes, focus
  alternatives, and explicit Replan. A scheduled background rolling refresh is not added because
  P2's existing daily job scope does not yet materialize per-user programs. Authenticated deployment
  smoke and migration application remain owner actions.

---

### P7: Program history experience

**Goal:** expose committed work and immutable history without turning Today into a planning
dashboard.

**Agent work:**

- Add one program surface with a committed Today and cursor-paginated immutable history.
- Distinguish planned time from measured actual time in history.
- Provide one clear time-budget plan-update action that preserves completed work.
- Do not render a future forecast or plan settings on Today in Phase 1. In particular, do not add
  availability overrides, focus alternatives, weekly scheduling, or revision-ledger controls here.
- Keep evidence details available without turning the default view into an analysis dashboard.
- Delegate visual polish freely, but do not add client-side decision logic.

**Definition of Done:** a user can see what is committed now and where they have been, with planned
and measured time kept distinct. All displayed decisions originate from persisted backend artifacts.

**Status (2026-07-13, corrected 2026-07-15): COMPLETE.** P7 keeps `/today` as one focused training
surface rather than adding a parallel planning route. The surface now joins a committed Today with
cursor-paginated immutable program history. The future forecast and collapsed plan settings were
removed after use showed that the forecast repeated the deterministic daily program and the settings
surface was not reliable enough for Phase 1.

The new read model preserves every Program version, including multiple replans on the same UTC date,
instead of merging or discarding earlier completed work. History groups those versions under one
session date, so a day appears once while each original plan and its outcomes remain inspectable. Each
history item resolves friendly labels, dimension labels, and citation sources against the methodology
version that created it. If a historic methodology package is unavailable, the persisted artifact
remains readable and falls back to its
stored identifiers without substituting the active release. Planned time comes from the persisted
item snapshot. Actual time is derived on the server from immutable `durationMin` or `solveTimeMs`
events and remains explicitly `Not measured` when no timed outcome exists. A measured zero remains
zero rather than becoming unknown.

Opening Today with an active Program from an earlier UTC date now builds the current day's session.
The guarded save reuses an existing Program for that date, so rapid duplicate build requests cannot
create repeated session rows. A started earlier day does not block rollover, while a started current
day remains protected.

Today exposes one `Update plan` action only after the time budget changes, so a no-op cannot produce a
misleading failure. Completed work remains preserved by the existing P6 replan path. The P6 revision
ledger, bounded focus alternatives, availability state, day overrides, and forecast remain persisted
backend capabilities, but none is rendered as plan settings on Today.

**UX follow-up (2026-07-14).** The training work now leads the page. Today shows one unambiguous
session state for complete, complete with skips, or still in progress. Each skipped block remains
visibly closed and can be restored through an append-only `skip_undone` event. The duplicate
Regenerate and Replan controls are replaced by one `Update plan` action beside the time budget. It is
disabled until the budget changes. The P6 scheduling choice that interrupted the top of Today is
removed. The collapsed plan settings and the future forecast are also removed in the 2026-07-15
product correction and must not be rebuilt as Phase 1 Today features.

The backend can still rebuild a missing or stale rolling forecast from the active persisted Program.
Today does not query or display that projection. History renders explicit empty, loading, and failure
states. Setup consistently uses the name `Setup`, counts all five steps, and separately reports
whether the three required steps are complete. Viewing the starting picture and creating the first
Program now persist completion for steps 4 and 5.

#### P7 handoff

- Migrations: apply `20260713000000_p7_program_history_indexes` for bounded history reads, then
  `20260714000000_setup_reveal_progress` for persisted setup step 4 completion.
- Owner action: deploy through the normal CI path, then smoke authenticated Today with at least one
  same-day time-budget plan update and a measured training outcome. Confirm the archive keeps both
  same-day versions, planned versus actual time remains distinct, and no future forecast or plan
  settings are present.
- Verification: Node 25.2.0; Prisma formatting and generation; typecheck; full lint; 81 Vitest files
  with 499 tests; 4 guard files with 73 tests; production build; and 21 Playwright tests all pass.
  Focused setup and P5-P7 verification covered 60 tests before the full suite. Playwright covers the
  public route gates plus database-free desktop and mobile renders of the real Today and Setup
  components, including all three session outcomes, skip reversal, empty history, and page-overflow
  checks. The full signed-in journey remains an owner production-like
  smoke because CI has no OAuth and seeded authenticated browser fixture.
- Product-correction verification (2026-07-15): Node 25.2.0; typecheck; focused ESLint; 4 focused
  Vitest files with 19 tests; production build; and 2 focused Playwright UI tests pass.
- Deliberate deviations: P7 extends `/today` instead of introducing a parallel `/program` route.
  Program history is cursor-paginated at a bounded server page size. Same-day versions remain
  immutable and are nested under one session date rather than repeated as top-level sessions or
  merged into a lossy rollup. Forecast persistence is retained for Engine
  determinism but intentionally has no Today UI. No methodology value, evidence grade,
  recommendation, or research claim changed. BUILD.md and METHODOLOGY.md therefore remain unchanged.
- Remaining risks: authenticated browser coverage still depends on a production-like signed-in
  fixture. Forecast and revision history reads are bounded and cursor-paginated, while a rolling
  refresh is repaired on the first current-week read rather than by a background midnight job.

---

### P8: Training-fit and product-feedback loop

**Goal:** let users improve personal fit and report product problems without contaminating skill
diagnosis.

**Public interfaces:**

- `TrainingFeedback`: program/item scope, relevance, enjoyment preference, time fit, friction tags,
  optional comment, idempotency key, methodology version, and timestamp.
- `ProductFeedback`: category (`bug`, `confusing`, `idea`, `other`), message, optional safe route
  context, idempotency key, contact permission, and timestamp.
- `TrainingPreferenceState`: deterministic positive-fit rollup consumed by the daily mix downstream
  of P5, with reset and a positive-only user override. It never selects the weekly skill focus.

**Agent work:**

- Put one short weekly check-in, the preference reset/override, and the always-available feedback
  actions in Settings/assessment. Today may show a config-driven contextual link after a novel or
  repeatedly skipped/problematic activity, but no plan controls or future program return there.
- Keep product feedback separate from training outcomes and training-fit feedback.
- Capture relevance, enjoyment, time fit, resource fit, and friction. Only positive fit may break a
  tie among methodology-eligible activities serving the already-selected focus. Negative feedback
  can expose friction and guide an explicit settings change, but cannot suppress an activity family,
  reduce behavioral difficulty, displace due learning, or alter a skill priority.
- Keep scheduling changes explicit in general Settings/assessment. Feedback may explain that a
  session or activity did not fit, but must not silently rewrite weekly availability or time budgets.
- Prohibit all feedback paths from writing SkillState or manufacturing a weakness signal.
- Avoid prompting after every item, repeated reminders, required comments, or penalties for silence.
- Add export/delete coverage and ensure monitoring scrubs free text.

**Definition of Done:** positive fit feedback can change an eligible future mix with a persisted
explanation while negative preference cannot weaken the prescribed focus, due work, or difficulty;
no feedback path can change measured skill; prompt silence has no penalty or repeated reminder; and
product feedback arrives with enough safe context to diagnose the issue.

**Status (2026-07-15): COMPLETE.** P8 adds append-only `TrainingFeedback`, separate
`ProductFeedback`, and unique `TrainingFeedbackPrompt` exposure records. The protected feedback API
checks Program and ProgramItem ownership, rebuilds `TrainingPreferenceState` deterministically after
methodology changes and otherwise updates it incrementally, supports a positive-only activity
override and non-destructive reset, and exports all three new record sets. Training and product
submissions use per-user idempotency keys and daily infrastructure limits. User deletion cascades
through each new table. Product reports keep a server-normalized route template, app version,
methodology version, and contact permission while the existing monitoring scrubber continues to
discard free text and request payloads.

`research-1.4.0` is active with a graded weekly cadence, contextual cooldown, repeated-problem
trigger, positive-only response scoring, prompt copy, tie-break explanation, and boundary copy.
Negative and neutral responses remain in the append-only source data but do not enter activity or
resource affinity and do not dilute an earlier positive signal. Weekly focus no longer reads
subjective fit. The daily mix applies positive fit only after methodology scoring, only across equal
scores among focus-serving candidates with the same due status, and snapshots a softened
`best-guess` explanation only when the tie-break actually changes order. The release delta sets the
legacy weekly-focus fit weight to zero while older versions retain their original value for replay.
Time-fit and friction observations do not mutate availability, time budgets, due work, difficulty,
or `SkillState`.

The full training-fit and product-feedback forms, reset, and optional positive override live in
Settings. The account menu provides route-aware access from any page. Today contains no feedback or
plan controls: it may show one graded, config-driven link to the relevant Settings form. The usable
Today view atomically claims and records that prompt under the per-user mutation lock, so loading,
error, and stale-session branches do not consume an exposure and concurrent tabs cannot both claim
it. Today also directly identifies a block whose eligible equal-score tie was resolved by positive
fit.

#### P8 handoff

- Migration and owner action: apply `20260715010000_p8_feedback_loop` with the normal production
  migration command before serving the new API. Then smoke an authenticated account by submitting
  one training-fit response and one product report, exporting the account, resetting fit, and
  confirming deletion removes all new records. Seed or naturally reach a contextual prompt to
  confirm its Today link selects the intended recent block in Settings.
- Verification: Node 25.2.0 and npm 11.6.2; Prisma format, validation, and client generation;
  typecheck; full lint; 91 Vitest files with 553 tests; 4 guard files with 83 tests; production build;
  and 25 Playwright tests all pass. Focused P8 verification covered 98 tests before the full suite.
  Browser coverage includes the visible persisted fit explanation and responsive Today states.
- Deliberate deviations: the weekly check-in shares the general Settings feedback panel instead of
  adding a separate assessment step. A novel-activity prompt means the first recorded event for an
  activity type; a repeated-problem prompt currently means the configured number of skips for that
  activity type. No product-triage administration screen or outbound notification was added.
- Remaining risks: CI still has no signed-in OAuth browser fixture, so authenticated form submission,
  export, and deletion need the owner smoke above. Prompt heuristics are intentionally Grade C product
  best guesses and should change only through a later methodology release. Product feedback is
  stored for direct operational review; P9 remains responsible for any consented observational
  research path and no P9 capture was started here.

---

### P9: Observational research capture and public methodology changelog

**Goal:** create the longitudinal learning foundation promised in VISION.md without overstating what
the data can prove.

**Public interfaces:**

- `RecommendationExposure`: user, program item, methodology version, served recommendation, eligible
  alternatives, decision-input reference, and timestamp.
- Controlled research export derived from exposures, outcomes, constraints, and later rating
  snapshots for currently consented users.
- `planning/METHODOLOGY_CHANGELOG.md`: public record of methodology versions, evidence changes,
  aggregate basis, limitations, and rollback notes.

**Agent work:**

- Record recommendation exposure at generation time so later outcomes are interpretable and missing
  exposure is not guessed.
- Keep raw operational events canonical. Avoid duplicating all event data into an unbounded research
  table on the free-tier database.
- Build a consent-filtered, access-controlled export/analysis path with de-identification before
  aggregate review.
- Publish only aggregates that pass privacy review. Never expose individual training histories.
- Require a human-reviewed methodology proposal, evidence grade review, config version bump, golden
  tests, changelog, and rollback plan before aggregate findings affect recommendations.
- Use association language for observational findings.

**Definition of Done:** every recommendation can be tied to its methodology version and eligible
context, non-consented users are excluded from secondary research exports, and no telemetry path can
mutate live methodology.

**Status (2026-07-16): COMPLETE.** P3 and P8 were confirmed complete in code and on the configured
database before implementation. P9 adds one immutable `RecommendationExposure` per generated
`ProgramItem`, persisted in the same serializable transaction as the Program. The exposure pins the
methodology version and injected logical generation time, references the Program's canonical
decision input, and snapshots the served recommendation plus the complete ranked candidate set after
weekly-focus filtering, due gating, methodology scoring, and positive-fit tie-breaking, before
generic time packing. Strict schemas and a fail-closed capacity bound keep the snapshot complete and
exclude due references, puzzle or practice ids, external refs, user free text, and database ids.
Reused existing or started programs create no duplicate exposure.

The admin-only controlled export derives bounded rows from exposures, canonical `ActivityEvent`
outcomes, safe projected constraints, and the first safe later rating snapshot. It checks current,
unwithdrawn `aggregate_observational_training` consent under the new
`research-data-use/2026-07-16` notice, excludes every stale, withdrawn, missing-scope, deleted, or
non-consented user, removes direct identifiers and unsafe payloads, and creates deterministic
HMAC-SHA256 participant pseudonyms from a dedicated secret. Missingness and nested search limits are
reported explicitly. Raw operational events remain canonical. Personal export is now
`mainline-user-export/v4` and includes the user's exposure history; User deletion cascades through
the new model.

The public About surface now shows every methodology release with evidence changes, aggregate basis,
limitations, and rollback notes. `planning/METHODOLOGY_CHANGELOG.md` records that no Mainline
aggregate informed any release through `research-1.4.0`. The active methodology and pointer are
unchanged. A privacy guard proves the P9 research service has no Methodology import, write, or
activation path. Any future aggregate-driven recommendation change still requires human review,
evidence regrading, a new immutable config version, golden tests, changelog notes, and a rollback
plan.

#### P9 handoff

- Migration and owner action: apply `20260716010000_p9_recommendation_exposure` with
  `npm run prisma:deploy` before generating new Programs. Review the new consent and privacy copy,
  then configure a separate high-entropy `RESEARCH_EXPORT_SECRET` of at least 32 characters. Do not
  reuse `AUTH_SECRET` or `CRON_SECRET`. The controlled export fails closed while the secret is absent.
- Owner smoke: in a production-like environment, re-consent one account under the new notice, leave
  one account non-consented, generate Programs for both, and confirm an invited admin export contains
  only the consented pseudonymized rows. Confirm withdrawal excludes that account from the next
  export and personal export/deletion include and erase RecommendationExposure rows.
- Verification: Node 25.2.0 and npm 11.6.2; Prisma Client generation; typecheck; full lint; 92 unit
  files with 487 tests; 4 guard files with 84 tests; production build; and 25 Playwright tests all
  pass. All P9-changed Prettier-supported files pass formatting, Prisma format passes, and
  `git diff --check` is clean. The repository-wide optional Prettier check still reports pre-existing
  formatting issues in `.agents/skills/security-audit/` and
  `tests/unit/server/program-forecast.test.ts`; P9 did not modify them.
- Deliberate deviations: no aggregate was computed or published, because none has passed privacy or
  evidence review. No methodology config or evidence grade changed. The minimal admin UI requests at
  most 500 rows while the server hard cap is 1,000. Recommendation exposure is operational decision
  history for every user; only its optional secondary export is consent-gated.
- Remaining risks: CI has no signed-in OAuth browser fixture, so the admin download and consent
  regrant/withdrawal journey require the owner smoke above. Production migration and secret behavior
  remain unverified until deployment. The first later rating is searched within a bounded safe
  snapshot set and reports when that bound truncates; later B6 analysis must account for that
  missingness. The new consent wording still warrants appropriate privacy/legal review before export
  activation.

---

### P10: Manual PGN and OTB import

**Goal:** let hybrid and OTB players feed non-platform games into the same adaptive loop.

**Agent work:**

- Support single-game paste, one PGN file, and multi-game PGN files.
- Validate and import valid games independently so one malformed game does not discard the rest.
- Accept standard chess only. Reject or clearly skip unsupported variants.
- Deduplicate manual games with a stable normalized-content hash and `manual` provenance. Do not
  create a fake PlatformConnection or rating snapshot.
- Capture or request missing date, time control, user color, result, user/opponent rating, and event
  metadata when available. Keep all optional.
- If identity/color is ambiguous, require the user to choose rather than guessing.
- Missing clocks disable time-use diagnosis for that game. Missing ratings do not create a rating
  observation.
- Run the existing client-side Stockfish analysis, structured review, personal-blunder derivation,
  spacing, and program adaptation paths without a parallel manual-game engine.
- Bound file size and batch work as infrastructure limits appropriate to the deployed free tier, and
  document those limits without presenting them as methodology.

**Definition of Done:** valid manual games deduplicate, analyze client-side, appear in review, create
eligible personal drills, affect the plan through existing graded seams, and export/delete correctly.

**Status (2026-07-16): COMPLETE.** P2 and P3 were confirmed complete in code before implementation.
The Analysis page now accepts one pasted game, one PGN file, or a bounded multi-game PGN file. It
validates each game independently with chess.js, accepts standard chess only, reports malformed and
unsupported siblings without discarding valid games, and requires the user to identify their color
before import. Date, time control, result, user/opponent ratings, and event can be completed or
corrected but remain optional. Missing clocks stay absent from raw analysis, missing ratings create no
rating snapshot, and an unknown date remains `null` rather than becoming an invented observation.

Manual games persist in the existing `ImportedGame` model with `platform = source = manual`, no
`PlatformConnection`, and no `ChessProfileSnapshot`. A stable SHA-256 key over normalized moves,
starting position, result, and identity headers makes equivalent imports idempotent. The only schema
change makes `ImportedGame.playedAt` nullable. Manual date-only values are stored at UTC noon to keep
the calendar date stable across display time zones, and manual games are excluded from short-window
tilt checks because the import has no trustworthy time of day.

There is no parallel analysis path. The manual library filter feeds the existing browser Stockfish
queue, raw `AnalysisResult`, structured review, personal blunder `PracticeItem`, FSRS schedule, and
program decision-state assembler. Once scanned, manual game features enter the same graded
methodology interpretation as platform games. Saving eligible review moments creates the same spaced
personal drills. Existing explicit account export includes the manual `ImportedGame` and nested raw
analysis, and the existing User and ImportedGame cascades erase the game and derived rows.

#### P10 handoff

- Migration and owner action: apply `20260716020000_p10_manual_pgn_import` with
  `npm run prisma:deploy`, then deploy through the normal CI path. The internal manual-import
  request budget defaults to 60 checks/imports per user per hour; optionally tune it with
  `MANUAL_IMPORT_REQUESTS_PER_HOUR`. No background job or seed is required.
- Owner smoke: import a file containing one valid standard game, one malformed game, and one
  unsupported variant. Confirm only the valid game appears under Manual PGN, a repeated import is
  reported as already present, browser Stockfish scanning saves raw features, structured review can
  schedule a personal drill, the next generated plan can consume its signal and due work, account
  export contains the game and analysis, and hard deletion removes all derived rows.
- Verification: Prisma formatting and client generation; 4 focused Vitest files with 33 tests;
  typecheck; full lint; 100 Vitest files with 611 tests; 4 guard files with 84 tests; production
  build; and 25 Playwright tests all pass. The first Playwright launch started before the just-built
  `.next/prerender-manifest.json` was visible and stopped before running tests; the immediate rerun
  against the completed artifact passed all 25 tests.
- Review follow-up verification (2026-07-16): 7 focused files with 53 tests, typecheck, full lint,
  4 guard files with 84 tests, and the production build pass after tightening persistence-error
  handling, zero-ply rejection, bounded scan-all behavior, and date-only display. The full unit suite
  and Playwright were not rerun for this focused follow-up.
- Security follow-up verification (2026-07-17): 3 focused files with 19 tests, typecheck, full lint,
  and 4 guard files with 84 tests pass after adding the shared manual request budget and
  concurrency-safe storage cap. The full unit suite, build, and Playwright were not rerun for this
  focused fix.
- Deliberate deviations: event metadata remains in canonical PGN rather than adding a duplicate
  column. Color is always requested instead of inferred from names. Local manual import does not use
  `JobRun` or an external-platform budget because it performs no outbound call. It uses a separate
  per-user request bucket, a 500-game storage cap, and strict byte, batch, game, and ply limits. No
  methodology value, evidence grade, recommendation, rating observation, or server-side chess
  analysis was added.
- Remaining risks: CI has no signed-in OAuth browser fixture, so the complete import, Stockfish,
  review, drill, export, and deletion journey remains the owner smoke above. Chess.js preserves
  mainline comments such as `%clk` but does not preserve arbitrary variations or NAG structure during
  canonicalization; users should retain the source file when those annotations matter. Production
  migration and signed-in behavior remain unverified until deployment.

---

### P11: User-zero acceptance and closed-beta release audit

**Goal:** prove the new loop under natural use before inviting beta users.

**Agent work:**

- Run the 14-day Stage-A validation without deliberately gaming outcomes to force branches.
- Confirm that meaningful settings and outcomes change the plan while isolated noise does not.
- Confirm every focus/forecast change has a persisted explanation and that history remains immutable.
- Test normal, missed-day, explicit-replan, disconnected-platform, manual-PGN, insufficient-data,
  export, withdrawal, and deletion journeys.
- Complete the full CI order and a manual production-like recovery drill for failed jobs.
- Record unresolved issues by severity and block invitation on any critical issue.

**Definition of Done:** every Stage-A gate is documented as passing, and the owner has a concrete
invite and rollback procedure for 5-10 pilot users.

---

## 6. During closed beta: agent parts

### B1: Recurring motif and board-vision diagnosis

**Timing:** pilot beta, after two stable weeks.

- Cross-reference personal blunders and failed puzzles with reliable motif tags.
- Track recurring motifs and board-safety failures with confidence and sample size.
- Feed only confidence-qualified signals into WeeklyFocus; show `insufficient data` otherwise.
- Keep the evidence distinction explicit: motif/error description can be strong, while the claim
  that a prescribed activity raises rating remains mostly Grade C.
- Add personal-mistake rationale snapshots and regression tests across rating bands.

**Definition of Done:** repeat personal errors can change focus and activity selection without
promoting noisy one-off mistakes into a diagnosis.

---

### B2: Phase and conversion diagnosis

**Timing:** closed beta, before expanding beyond 25 active users.

- Add opening/middlegame/endgame phase localisation from existing raw features.
- Add winning-position conversion and losing-position save signals where engine/tablebase data is
  reliable.
- Apply methodology sample gates and contested-baseline flags exactly.
- Never headline raw ACPL or treat it as a standalone personal diagnosis.
- Feed qualified signals into focus, rationale, and existing drill selection.

**Definition of Done:** phase and conversion signals are reproducible, uncertainty-aware, and absent
when source data cannot support them.

---

### B3: Time-use, opening gates, and uncertainty-driven probes

**Timing:** closed beta, after B1 stability.

- Add cautious time-use proxies only for games with usable clocks. Keep precise VOC explicitly
  stubbed unless the architecture later supports its required analysis.
- Add opening-leak signals only through METHODOLOGY.md sample gates. Never diagnose an opening from a
  small win-rate sample.
- When missing evidence could change the program, schedule a short behavioral diagnostic probe.
- Limit probes to measurable board vision, tactical motifs, calculation, and basic endgame outcomes.
- Do not create self-report strategy quizzes or claim to diagnose semantic positional understanding.

**Definition of Done:** probes reduce a named uncertainty, time/opening signals respect source-data
gates, and unsupported semantic diagnoses remain impossible.

---

### B4: Personal mistake-protocol extensions

**Timing:** expanded beta, after B2-B3 provide qualified triggers.

- Add a config-driven threat-check or board-safety routine inside relevant personal blunder drills.
- Turn failed winning positions into replayable conversion drills when B2 supports the trigger.
- Add time-allocation practice only when B3 provides a reliable personal signal.
- Reuse the current board, PracticeItem, ActivityEvent, FSRS, and adaptation paths.
- Do not add a new navigation destination for each protocol.

**Evidence:** retrieval, spacing, and process feedback are strong Tier-2 mechanisms; the chess-specific
claim that these exact protocols improve rating remains mostly Grade C and must be worded accordingly.

**Definition of Done:** each protocol starts from a qualified personal signal, auto-tracks outcomes,
reschedules through existing machinery, and changes no generic Engine science.

---

### B5: Per-user duration and schedule-fit adaptation

**Timing:** expanded beta.

- Compare planned and actual duration by activity type for the individual user.
- Improve future time packing from personal timing history without changing learning priorities.
- Use availability overrides and repeated time-fit feedback to adjust session fit.
- Preserve methodology ownership of recommended volume and difficulty. Personal duration estimation
  is descriptive machinery, not a new training prescription.
- Prevent missed sessions from creating backlog debt or manipulative recovery pressure.

**Definition of Done:** forecast duration becomes more accurate for the individual, while the same
methodology priorities remain explainable and reproducible.

---

### B6: Aggregate calibration review and methodology releases

**Timing:** expanded beta and ongoing, after 25 research-consented longitudinal users.

- Produce aggregate descriptive reports for solve times, activity duration, diagnostic baselines,
  adherence, and missingness by relevant band and context.
- Show uncertainty, sample size, selection bias, and platform differences.
- Do not label a correlation between activity and rating as an effect of training.
- Route proposed changes through METHODOLOGY.md, evidence review, a new config version, golden tests,
  public changelog, and staged activation.
- Roll back any version that causes invalid configs, unexplained program churn, or data-integrity
  failures.

**Definition of Done:** Mainline can publish and safely apply a transparent methodology calibration
without bypassing L1-L3 or overstating evidence.

---

## 7. After public release: delayed agent parts

### L1: Resource effectiveness and stop-doing guidance

**Gate:** 100 active users, 50 research-consented longitudinal users, and eight weeks of resource-use
data.

- Compare planned and completed use of owned books/courses, personal duration, fit feedback,
  abandonment, and exercise success where logged.
- Recommend continue, pause, replace, or reduce based on personal fit and adherence.
- Prefer an already-owned suitable resource over another purchase.
- State clearly that the guidance reflects fit and observed association, not proven rating impact.

### L2: Personal experiments and formal studies

**Gate:** 250 active research-consented users plus study ownership, governance, an analysis plan, and
a design-specific power analysis.

- Start with reversible within-user comparisons where an individual has sufficient observations.
- Predeclare eligible users, outcome, duration, stopping rule, exclusions, and analysis before
  assignment.
- Keep control conditions inside defensible methodology bounds. Never knowingly assign harmful or
  Grade-D practice.
- Separate consent for experimental assignment from observational research consent.
- Publish null and negative results as well as positive ones.

### L3: Tournament preparation

**Gate:** after public release, recurring demand from hybrid/OTB users, and stable B3/B5 inputs.

- Accept event date, time control, format, availability, and target medium.
- Schedule physical-board simulations and preparation logistics through graded methodology rules.
- Do not import athletic taper/deload concepts as fact.
- Keep real games external and import the results afterward.

### L4: Coach handoff pack

**Gate:** after public release and recurring demand from users who work with external coaches.

- Export user-selected games, recurring signals, uncertainty, personal mistake positions, program
  history, and unanswered diagnostic questions.
- Keep the pack user-controlled and portable. Do not create a social graph, marketplace, or coach
  access to the account.
- Treat human feedback as an external reference unless a later, separately planned typed import can
  preserve provenance and prevent it from masquerading as behavioral measurement.

---

## 8. Deliberate non-features

Do not add these through this roadmap:

- runtime AI or an LLM chat coach;
- social feeds, leaderboards, multiplayer, or a coaching marketplace;
- a fixed multi-week syllabus that pretends future evidence cannot change the plan;
- puzzle points, a competing puzzle-rating ladder, or volume-chasing rewards;
- an opening-repertoire trainer;
- precise online-to-FIDE conversion;
- more metrics merely because they are measurable;
- a new training surface whose outcome cannot enter the tracker and adaptation loop;
- automatic methodology changes driven directly by telemetry;
- frontend-only novelty presented as a product feature.

A proposed feature earns roadmap space only if it materially improves at least one of diagnosis,
prescription, execution, outcome capture, adaptation, transparency, or safe longitudinal learning.

---

## 9. Roadmap-wide verification

Every completed part must preserve these acceptance properties:

- Same persisted inputs, injected time, and methodology version produce the same decision.
- Every recommendation and revision can be traced to a graded methodology rationale.
- Historic programs retain their original methodology version, inputs, and copy.
- User feedback cannot write behavioral skill state.
- Insufficient data remains a first-class result, not an error to hide or a gap to fabricate.
- Observational analysis uses association language and exposes uncertainty and missingness.
- Research opt-out does not break personal training.
- Export and deletion cover every new user-owned record.
- Platform calls remain polite, cached, rate-limited, and replaceable behind adapters.
- Client-side Stockfish remains the chess-analysis compute path.
- No runtime AI, hosted copyrighted content, social, multiplayer, ads, or paid training quality enters
  through a roadmap part.

The roadmap is complete when public users experience Mainline as a program with memory, direction,
honest adaptation, and visible uncertainty, rather than a calculator that emits an isolated Today.
