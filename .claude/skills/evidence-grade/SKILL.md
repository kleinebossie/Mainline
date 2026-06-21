---
name: evidence-grade
description: Use when writing or reviewing any user-facing recommendation, training directive, methodology value (success-rate target, FSRS interval, difficulty offset, daily volume, per-band rule), or research claim for the chess-training app. Attaches an evidence grade (A/B/C/D), a citation, and a "why this / why now" rationale, and prevents overstating evidence.
---

# Evidence grading & honest claims

This product treats **radical honesty as a feature, not copy**. Every recommendation or
parameter must carry its evidence — never a bare number or a confident promise.

## The grade scale (always attach one)

- **A** — strong, replicated evidence
- **B** — suggestive but limited evidence
- **C** — theory / expert opinion
- **D** — popular but unsupported myth (label it; do not implement as if true)

## Rules

1. Every recommendation, copy string, or config value carries: the **grade**, a **citation**
   (a source in `research/` or `planning/METHODOLOGY.md`), and a user-facing
   **"why this / why now"** rationale.
2. When you extract a parameter into `MethodologyConfig` (target, interval, offset, volume,
   per-band directive), **carry the grade and citation with the number**. Never strip the
   evidence from the value.
3. Distinguish **Tier 1** (chess-specific, mostly observational/weak) from **Tier 2** (strong
   general learning-science extrapolated to chess). Label which tier a claim rests on.
4. Preserve the central caveat everywhere: **no study has shown any training activity _causes_
   a measured rating gain.** Do not imply otherwise; do not promise rating gains.
5. Do not overstate. If evidence is grade C or D, say so plainly in the copy and rationale.

## Quick check before shipping a claim

- [ ] Grade attached (A/B/C/D)?
- [ ] Citation present?
- [ ] "Why this / why now" rationale written?
- [ ] Tier (1 or 2) clear?
- [ ] No implied causation / no rating-gain promise?

Source of truth: `planning/VISION.md` §4 and the `research/` reports. Related: [[research-synthesis]],
[[engine-methodology-guard]].
