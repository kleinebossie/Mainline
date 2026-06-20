# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this repository is

This is the source code repository for a chess training app. It contains the Next.js application code, the test suite, the build system, and the underlying planning and research documents.

- `src/` — application source code (Next.js app router, React components, Engine logic, Methodology config).
- `tests/` — unit, e2e, and architecture guard tests.
- `prisma/` — Prisma schema for the database.
- `planning/` — product intent. `VISION.md` is the authoritative source (read it first).
  `SHIPPING.md` (Phase 2) and `GROWTH.md` (Phase 3) are placeholders/empty. `BUILD.md` is the
  technical plan (stack, data model, repository layout, build order M0–M10, and the 9 "research
  seams"); it defines the generic **Engine** and the **`MethodologyConfig`** schema/loader.
  `METHODOLOGY.md` is the science that fills those seams (values, grades, citations, copy).
- `research/` — the evidence base (the *onderzoek* phase). Long, citation-heavy reports that become
  the app's **Methodology layer**. `RESEARCH_PROMPT.md` is the brief that generated them; the others
  (`SKILL_TAXONOMY.md`, `WEAKNESS_DIAGNOSIS.md`, `WHAT_RAISES_RATING.md`, `PRACTICE_DESIGN.md`,
  `SPACED_REPETITION.md`) are the resulting reports, one per research question.


## The product in one paragraph

A web app that generates and continuously adapts a **personalized, science-based, no-BS chess
training program**. It hosts no content and runs no games — every activity is a **reference to an
external resource** (Lichess puzzles by theme+rating, books, endgame trainers) and the app tracks
outcomes to re-prioritize the next session. It must work across **all rating bands** and is
multi-user from day one (personal-first, public-ready).

## The architectural idea that governs everything

The single most important design rule (`VISION.md` §4): **separate the generic Engine from the
Methodology.**

- **Engine** — generic, deterministic machinery (accounts/imports, user profile + constraints, game
  analysis, program generator, tracker, adaptation loop, transparency UI). It contains **no
  chess/learning knowledge of its own.** Build this first, with placeholder methodology so the whole
  loop runs end-to-end.
- **Methodology** — the actual science from `research/`, plugged in as a **versioned
  `MethodologyConfig`** (rules, parameters, copy). Science enters the system in **exactly one place**
  and is swapped in later **without re-architecting anything.**

When writing code, never hardcode chess knowledge, rating assumptions, or anything personal to the
builder into the Engine — it lives in data/config. This is what keeps "works for me" → "works for
the public" a change of degree, not a rewrite.

## Conventions that constrain the work

These come from `VISION.md` and the research brief; honor them in any code or recommendation:

- **No LLM/AI inside the product.** (AI agents build it; the running product uses none.)
- **No hosted content, no in-app play, no social/multiplayer, no payments/native apps in Phase 1.**
  Stay multi-user and billing-*capable*, but don't build billing yet.
- **Radical honesty is a feature, not copy.** Every recommendation carries an **evidence grade**
  (A = strong/replicated, B = suggestive/limited, C = theory/expert opinion, D = popular but
  unsupported myth) and a user-facing "why this / why now" rationale. Do not overstate evidence or
  promise rating gains.
- **English** for documents and code. Free-infrastructure tiers only (Phase 1 targets personal use →
  closed free beta).

## Working with the research reports

The reports are evidence-graded and deliberately distinguish **Tier 1** (chess-specific, mostly
observational/weak) from **Tier 2** (strong general learning-science, extrapolated to chess). The
central honest caveat to preserve everywhere: **no study has shown any training activity *causes* a
measured rating gain** — design and copy must not pretend otherwise. When extracting parameters into
config (success-rate targets, FSRS intervals, difficulty offsets, daily volumes, per-band
directives), carry the grade and citation with the number; don't strip the evidence from the value.
