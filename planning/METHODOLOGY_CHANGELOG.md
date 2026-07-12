# Methodology changelog

This is the public record of active methodology releases. A release changes only
the versioned MethodologyConfig and its evidence-carrying copy. Historic program
artifacts retain the version and rationale snapshot used when they were generated.

The central caveat is unchanged: no training activity has been proven to cause a
measured chess-rating gain. Mainline reports associations and learning mechanisms
with their limitations, not promises.

## research-1.0.0, 2026-07-10

Status: first research release, retained for reproducibility. Rollback target: `stub-0.1.0`.

Source: `planning/METHODOLOGY.md`.

This release promotes the approved Phase 1 methodology configuration from the
pre-release channel to the research channel. The Engine architecture is unchanged.
The loader validates the release through the same fail-closed schema, resolves every
used citation through the evidence ledger, deep-freezes the result, and keeps
`stub-0.1.0` available for historic programs and rollback.

Included in this release:

- the current nine seams and Measurement configuration already consumed by M4-M14;
- graded values with grade, tier, citation, and flags where the source is limited;
- the current rationale table, evidence ledger, in-app activity delivery choices,
  book-study protocol, modality guidance, and engagement guardrails;
- the structured-analysis runtime defaults and game-selection scoring heuristics
  that were previously provider fallbacks, now exposed as graded config leaves;
- the complete graded skill-taxonomy descriptors and the graded redo hint policy;
- historic-program rendering pinned to each program's persisted methodology version;
- association-safe rationale copy across analysis, spacing, difficulty, goals,
  books, modality, feedback, habits, and personal-position recommendations;
- explicit release metadata listing retained best guesses and deliberate stubs.

Retained best guesses:

- calibration ladder length, offsets, stopping rule, and uncertainty estimator;
- per-band puzzle offsets, success targets, session volume, and practice structure;
- FSRS transfer to spatial patterns, solve-time thresholds, and beginner
  micro-spacing;
- per-band analysis ratios, RPL thresholds, entropy window, and modality
  proportions;
- book catalog priorities, plateau window, rating expectations, and engagement
  quantities.

Deliberate stubs and limitations:

- the psychological dimension and numeric salience priors are not activated;
- phase, conversion, time-use, opening, and recurring-motif signals are not yet
  daily generator inputs;
- semantic strategic diagnosis and precise online-to-FIDE conversion remain out of
  scope;
- chess-specific causal effects of activities, spacing, books, and engagement
  mechanics remain unproven;
- local solve-time norms and tilt-cooldown effectiveness require product data.

These limitations are intentional. They are labeled in config or release metadata
so a future methodology version can replace them with reviewed evidence, a version
bump, golden tests, and a new changelog entry. Telemetry must not update the active
methodology automatically.

`stub-0.1.0.json` remains byte-for-byte unchanged. Provider values that existed in
code before this release, plus the historic scaffolded-hint behavior, are carried in
an additive version-matched compatibility JSON. The loader rejects any compatibility
entry that attempts to replace an existing historic field.

## research-1.1.0

Status: released on 2026-07-12 and retained for reproducibility. Adds the P5 weekly-focus policy, deterministic confidence-gated
selection and revision, structural goal-to-process mappings, and bounded alternatives. Every
stability value and score weight is Grade C and flagged `best-guess`. The release makes no rating
gain claim. Rollback is `research-1.0.0`; historic base config bytes remain unchanged and receive
the additive focus seam needed to keep rollback generation operational.

## research-1.2.0

Status: released on 2026-07-12 and retained for reproducibility. Shortens new-user calibration to one three-item tactical track.
The length remains a Grade C product best guess. Historic assessments keep their original
methodology version and calibration behavior. Rollback is `research-1.1.0`.

## research-1.3.0

Status: active by default from 2026-07-12. Keeps the `research-1.2.0` calibration behavior and clarifies the
bounded weekly-focus alternative rationale. Optional choice is now framed around giving more weight
to a user-selected goal while keeping the evidence-led recommendation available. The rationale
remains Grade C, Tier 2, softened, and cited to `williamson2022`; no evidence grade or training rule
changed. Rollback is `research-1.2.0`.

## stub-0.1.0

Status: retained for reproducibility and rollback. This was the pre-release
placeholder configuration used by the first end-to-end loop. It remains loadable and
is still covered by the methodology integrity tests.
