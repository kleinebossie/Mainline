---
name: engine-methodology-guard
description: Use when writing or reviewing application code, the technical plan (planning/BUILD.md), the MethodologyConfig schema/loader, or any data model for the chess-training app. Enforces the Engine vs Methodology separation — keep chess/learning knowledge out of the generic Engine and inject it only via versioned config.
---

# Engine / Methodology separation (the rule that governs everything)

`VISION.md` §4: **separate the generic Engine from the Methodology.** Science enters the system
in **exactly one place** — a versioned `MethodologyConfig`.

## Engine (build first)
Generic, deterministic machinery: accounts/imports, user profile + constraints, game analysis,
program generator, tracker, adaptation loop, transparency UI. It contains **no chess or learning
knowledge of its own.** Build it end-to-end with placeholder methodology so the whole loop runs.

## Methodology (plug in later)
The science from `research/`, delivered as a **versioned `MethodologyConfig`** (rules, parameters,
copy). Swappable **without re-architecting** the Engine.

## Hard rules when writing code
1. **Never hardcode** chess knowledge, rating assumptions, success-rate targets, intervals, daily
   volumes, or anything personal to the builder into the Engine. It lives in **data/config**,
   keyed by `MethodologyConfig`.
2. Anything that varies by rating band, theme, or learning-science finding → **config**, not code
   branches.
3. The Engine *reads* config; it does not "know" the science. "Works for me" → "works for the
   public" must be a change of **config**, not a rewrite.
4. **No LLM/AI inside the running product** (AI agents build it; the product uses none). In Phase 1:
   no hosted content, no in-app play, no social/multiplayer, no payments/native apps. Stay
   multi-user and billing-*capable*, but do not build billing.
5. Every methodology value carries its evidence — see [[evidence-grade]].

## Quick check before merging Engine code
- [ ] No chess/rating/learning constants baked into Engine logic?
- [ ] New science routed through a versioned `MethodologyConfig`?
- [ ] No LLM call on the product path?
- [ ] Phase-1 scope respected (no play / host / social / payments)?

Source of truth: `planning/VISION.md` §4, `planning/BUILD.md`, `CLAUDE.md`. Related:
[[evidence-grade]], [[research-synthesis]].
