---
name: research-synthesis
description: Use when writing or updating the research reports in research/ (SKILL_TAXONOMY, WEAKNESS_DIAGNOSIS, WHAT_RAISES_RATING, PRACTICE_DESIGN, SPACED_REPETITION) or distilling their findings into planning/METHODOLOGY.md. Keeps reports citation-heavy, tier-labeled, evidence-graded, and honest about causation.
---

# Research synthesis (the _onderzoek_ layer)

The `research/` reports are the evidence base that becomes the app's Methodology layer. They are
deliberately citation-heavy and must stay honest.

## Conventions

1. **Citation-heavy.** Every non-trivial claim cites a source, kept _with_ the claim — not only in
   a distant bibliography.
2. **Tier labels.** Mark **Tier 1** (chess-specific, mostly observational/weak) vs **Tier 2**
   (strong general learning-science, extrapolated to chess). Never present a Tier 2 extrapolation as
   if it were chess-specific Tier 1 evidence.
3. **Evidence grades A/B/C/D** on findings — see [[evidence-grade]].
4. **Central caveat, preserved everywhere:** no study has shown any training activity _causes_ a
   measured rating gain. State it where it applies; never write copy or config that pretends
   otherwise.
5. **Parameters carry evidence.** When a report yields a number bound for `MethodologyConfig`
   (success-rate target, FSRS interval, difficulty offset, daily volume, per-band directive), record
   the grade + citation next to it so [[engine-methodology-guard]] can route it cleanly into config.
6. **English.** One report per research question; `research/RESEARCH_PROMPT.md` is the brief that
   generated them.

## Shape of a report finding

Claim → evidence (with citation) → grade (A/B/C/D) → tier (1/2) → implication for the app
(and any number to extract into config).

Source of truth: `research/RESEARCH_PROMPT.md`, `planning/METHODOLOGY.md`, `CLAUDE.md`. Related:
[[evidence-grade]], [[engine-methodology-guard]].
