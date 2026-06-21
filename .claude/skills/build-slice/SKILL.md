---
name: build-slice
description: Use to build the chess-training app from planning/BUILD.md — implementing a milestone (M0–M10), continuing the build, or doing a vertical slice of app code. Lets a terse prompt ("build M3", "do the next slice", "continue the build") drive a full, verified implementation against the BUILD.md contracts without re-specifying them.
---

# Build a vertical slice (the BUILD.md driver)

`planning/BUILD.md` is the authoritative blueprint, written to be executed literally. This skill turns
a terse prompt into a correct, verified slice. **Do not ask for detail BUILD.md already specifies —
read the section.**

## Before writing code (always)

1. **Open the milestone** in `BUILD.md` §10 (M0–M10). Each slice gives _Goal · Depends on · Typed
   contract · Tasks · Tests · DoD checklist_. If the prompt names no milestone, build the
   **lowest-numbered milestone not yet Done** (dependencies are linear M0→M10; the loop is end-to-end
   by M7).
2. **Pull the specifics it points to — don't reinvent them:** stack & versions §3 · repo layout &
   import boundaries §4 · data model §5 (`prisma/schema.prisma` is DB truth) · integrations & their
   hard constraints §6 · Engine mechanics §7 · onboarding §8 · seam index + the ~18 provider fns
   §11/§2.8 · verification §13.
3. **Any number that encodes a chess/learning decision comes from `MethodologyConfig`** (stub now),
   never from you — see [[engine-methodology-guard]]. Only infra numbers (timeouts, free-tier limits,
   cache TTLs) live in BUILD.md/code.

## The three laws hold in every file (§0.1)

- **L1** — science only in config: no chess/learning constant in `engine/`,`analysis/`,`server/`,`app/`.
- **L2** — decisions pure & deterministic: inject `Clock`/seed; never `Date.now()`/`Math.random()` in
  `engine/` or `methodology/` decision code.
- **L3** — every methodology leaf is a `GradedValue`; snapshot its grade/citation onto persisted
  artifacts (e.g. `ProgramItem`); stub/C/D values carry their flag and never render as fact ([[evidence-grade]]).

## Implementation order within a slice

1. **Types/contracts first** — write the interfaces named in the slice's _Typed contract_ (TS strict;
   the compiler is the first reviewer).
2. **Schema/migration** if it touches data (§5): edit `prisma/schema.prisma`, then generate a
   migration (never hand-edit destructively).
3. **Pure core** — Engine/methodology functions as pure fns (§2.8, §7); config params passed in; generic
   math (FSRS, Glicko CI, servo, packing) lives in `engine/math` and is parameterised by config.
4. **Wiring** — tRPC routers (`server/`) + routes/UI (`app/`, shadcn) behind the typed boundary;
   `db/` holds no business logic; `app/`/`server/` orchestrate, they don't decide graded choices.
5. **Tests** — golden test every pure fn (fixed inputs + pinned config version → exact output incl.
   rationale keys + grades, §13.1); Playwright for the loop where the slice's _Tests_ row says so (§13.2).

## Definition of Done — don't claim done until

- [ ] Every box in the slice's **DoD checklist** (§10) is satisfied.
- [ ] CI gates green (§13.3): `typecheck → lint (incl. L1/L2) → unit → build → e2e → guards`.
- [ ] Architecture guards pass (§13.4): L1 (no science in Engine), L2 (no wall-clock/random in
      decision code), L3 (config validates — every leaf graded, every citationKey resolves).

## Report back

State the milestone, what you implemented, golden/e2e results, which DoD boxes are met, and anything
deferred. If tests fail, say so with the output — never claim a slice is done on red CI.

Source of truth: `planning/BUILD.md`. Related: [[chess-app-conventions]], [[engine-methodology-guard]],
[[evidence-grade]].
