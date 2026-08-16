# Methodology Changelog

This document records all methodology configuration releases in Mainline.

A methodology release modifies only the versioned `MethodologyConfig` JSON files and evidence copy. Historic program artifacts retain the version and rationale snapshots generated at creation time.

### Core Scientific Caveat

No chess training activity has proven causal rating gains in scientific literature. Mainline reports observed correlations and learning mechanisms with their known limitations. The application never promises rating increases.

---

## research-1.4.0 (2026-07-15)

- **Status**: Active default methodology configuration.
- **Rollback Target**: `research-1.3.0`.
- **Changes**:
  - Added Part P8 training fit policy without altering measured skill formulas or difficulty targets.
  - Added a 7-day weekly check-in cadence, a 14-day contextual cooldown, and a 2-problem contextual trigger (all Grade C product estimates).
  - Configured subjective fit as positive-only in decision logic. Enjoyed activities or relevant resources break ties between activities with identical scores and focus.
  - Neutral and negative responses do not reduce scores, suppress activities, or lower difficulty.
  - Added boundary copy (Grade A, Tier 1, citing `heck2025`) clarifying that self-report is kept separate from behavioral assessment.
  - Added Part P9 observational exposure capture. Every served program item snapshots its methodology version, eligible context, evidence grade, and allocated time.
  - Research datasets use HMAC pseudonymization. Observational data does not modify active methodology automatically.

---

## research-1.3.0 (2026-07-12)

- **Status**: Retained for reproducibility and rollback.
- **Rollback Target**: `research-1.2.0`.
- **Changes**:
  - Clarified weekly focus rationale copy.
  - Framed user choice around user goals while preserving evidence-led recommendations (Grade C, Tier 2, citing `williamson2022`).
  - Preserved the three-item tactical calibration track from `research-1.2.0`.

---

## research-1.2.0 (2026-07-12)

- **Status**: Retained for reproducibility and rollback.
- **Rollback Target**: `research-1.1.0`.
- **Changes**:
  - Shortened new-user calibration to a single three-item tactical track.
  - Calibration length is a Grade C product estimate. Historic assessments keep their original versions.

---

## research-1.1.0 (2026-07-12)

- **Status**: Retained for reproducibility and rollback.
- **Rollback Target**: `research-1.0.0`.
- **Changes**:
  - Added Part P5 weekly focus policy with confidence-gated selection and revision.
  - Added structural goal-to-process mappings and bounded alternatives.
  - Stability weights are Grade C estimates without rating gain claims.

---

## research-1.0.0 (2026-07-10)

- **Status**: First full research release. Retained for reproducibility.
- **Rollback Target**: `stub-0.1.0`.
- **Source**: [METHODOLOGY.md](file:///home/joebos/programming/Mainline/planning/METHODOLOGY.md).
- **Changes**:
  - Promoted approved Phase 1 methodology from pre-release stub to the research channel.
  - Configured nine research seams and measurement parameters.
  - Added evidence ledger with grades (A, B, C, D), tiers (Tier 1, Tier 2), and source citations.
  - Added structured analysis defaults, puzzle offsets, FSRS spacing parameters, and book catalog entries.
  - Stubs and deliberate limitations: psychological dimensions inactive, conversion and time-use signals unweighted, and strategic semantic diagnosis out of scope.

---

## stub-0.1.0

- **Status**: Retained for historical program reproducibility and test verification.
- **Summary**: Pre-release placeholder configuration used during initial 0-to-1 build milestones (M0-M14).
