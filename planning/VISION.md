# VISION.md — what the app is

> **Purpose of this document:** a **high-level overview** of what the app should become — the
> product idea, the principles it's built on, and the boundaries around it. It is deliberately
> _not_ detailed. The concrete technical plan (stack, data model, build order, conventions) lives
> in `BUILD.md`; the science lives in the research phase (`research/`). Read this first to
> understand _what_ and _why_; read `BUILD.md` for _how_.
>
> **Build intent:** built **personal-first** — the builder is user zero and the first goal is a tool
> good enough to train _himself_. But it is **architected from day one to become a public, monetized
> product.** Nothing personal is ever hardcoded; everything user-specific lives in data, so the jump
> from "works for me" to "works for the public" is a change of degree, not a rewrite.
>
> **Language:** English (document + code). User-facing UI copy may be localized later.

Phases 2 (_Shipping_) and 3 (_Acquiring Users_) are tracked in `SHIPPING.md` and `GROWTH.md`.
This document is about Phase 1 (_Building_) at the level of intent.

---

## 1. The idea

An app that generates a **personalized, science-based, no-BS chess training program** — and then
keeps adapting it.

It is **not** another game-analysis tool, puzzle trainer, or spaced-repetition deck. Those exist
and many are good. This app sits one layer up: it is the **training-program layer** that decides
_what you should work on, with which resources, and why_ — and revises that plan continuously as
you train and play.

Three things make it different:

1. **Personalization through constraints.** The user describes their situation — time per day,
   days per week, goals, the resources they already own, preferences — and connects their chess
   accounts. The program is built around _their_ reality, not a generic curriculum.
2. **It's alive.** After generation the program is **super dynamic**: a tracker records every
   outcome, and the program re-prioritizes itself over time. There is no fixed syllabus.
3. **It hosts no content.** Every activity is a **reference to an external resource** (Lichess
   puzzles, books, courses, etc.). The app orchestrates; it does not host exercises, run games, or
   use any LLM/AI inside the product.

---

## 2. The brand: science-based and radically honest

The product's identity is **trust**. Two commitments, both visible _in the app itself_:

- **Science-based.** Recommendations are grounded in research on skill acquisition, practice
  design, and retention — not folklore or guru opinion.
- **No-BS.** The app is honest about _why_ it suggests each activity and **how strong the evidence
  is**. It shows a "why this / why now" rationale and is candid where the science is thin or where
  expectations should be realistic. It does not over-promise rating gains.

The strongest honest statement, and the app says it plainly: **no training activity has been
_proven_ to cause a measured rating gain.** The app helps you train smarter on the best available
evidence; it never promises you a rating.

The stance is deliberately **polarizing, and that's fine.** If a user would rather follow their
favorite course-selling guru, that's their choice. The honest position is: _training with weak or
indirect evidence is still better than training with none_ — but only when that's actually true, so
the app never pretends evidence is stronger than it is. It shows the grade and the reasoning, and
lets the user decide. This honesty isn't a footnote — it's the differentiator. Every recommendation
is explainable.

---

## 3. Adherence is a first-class problem

The hardest problem in chess improvement isn't _knowing_ what to train — it's actually doing it,
consistently, over months. A smarter plan that no one follows is worthless. So **engagement and
adherence are a first-class product concern, not a late add-on.**

But engagement must stay **on-brand**: aggressive dopamine engineering (unbreakable streaks,
manipulative loss-aversion, slot-machine reward) is exactly the manipulative, un-scientific design
this app is a reaction against — using it would make the "no-BS" brand hypocritical. Instead the
engagement layer is **evidence-based motivation design**, grounded in the research on what sustains
effort: Self-Determination Theory — **autonomy** (the user stays in control of the plan),
**competence** (visible progress and honest feedback), and the finding that **intrinsic motivation
outlasts extrinsic rewards.** Same priority as any dopamine-driven app; a defensible, durable, and
on-brand execution.

---

## 4. The one architectural idea that matters

The single most important design decision: **separate the generic engine from the science.**

- **The Engine** — generic, deterministic machinery: accounts and imports, the user profile and
  constraints, raw game analysis, the program generator, the tracker, the adaptation loop, the
  transparency UI. It contains **no chess/learning knowledge of its own.**
- **The Methodology** — the actual science: what skills to measure, how to read a player's games,
  which resource fits which weakness at which level, how hard tasks should be, how to space and
  prioritize, and the "why" copy. This is produced later in the research phase and plugged in as a
  **versioned configuration**.

The engine is built **now** and ships with safe placeholder methodology so the whole thing runs
end-to-end. The real science is **swapped in later without re-architecting anything.** Science
enters the system in exactly one place.

This is what lets the project move forward before the research is done — and lets the research land
later without a rewrite.

---

## 5. What the experience looks like

1. **Sign in** with an existing account (e.g. Google or Lichess).
2. **Connect** chess accounts (Lichess, Chess.com) so the app can see real games and ratings.
3. **Assess** — a short calibration plus capturing the user's constraints and goals.
4. **Get a program** — a daily training session made of external-resource activities that fit the
   user's time budget and current priorities, each with a visible rationale.
5. **Train and track** — the user does the activities and logs outcomes.
6. **Watch it adapt** — new results and freshly imported games reshape what comes next.

---

## 6. Who it's for and how it's built

- **Personal-first, public-ready.** The builder is the first user and the first validator. But the
  app is multi-user from day one and nothing personal is hardcoded — the methodology must generalize
  beyond the builder's own rating, resources, and tastes, or the path to a public product is broken.
- **Every rating.** The app makes no hardcoded assumptions about level; a beginner and an expert
  both get something coherent. Level lives in the user's data, not in the code. (This also _serves_
  the public-product goal — it forces the methodology to generalize.)
- **Built solo, via AI coding agents,** by a non-professional developer working limited hours on a
  tight budget. This shapes every technical choice toward simplicity, type-safety, and tooling that
  AI agents handle reliably — detailed in `BUILD.md`.
- **Built on external platforms.** The product depends on Lichess and Chess.com (their APIs, data,
  and goodwill) and on open data like the Lichess puzzle database. This is a real dependency — their
  APIs or terms can change and break features — and the app names it honestly. It treats those
  platforms as **partners to respect, not resources to exploit**: it caches aggressively, honors
  rate limits, and never hammers them, and keeps a clean adapter boundary so platforms can be added
  or swapped (detail in `BUILD.md`).
- **Web first.** Responsive web now; native mobile/desktop is a possible future, not a Phase 1
  concern.
- **Quality over speed.** No hard deadline. Correct and trustworthy beats fast.

---

## 7. What makes it defensible, and how it's funded

The long-term intent is to **monetize**, but modestly and on-brand. The model is designed in
Phase 2/3, not now; Phase 1 only has to stay multi-user and **billing-capable.**

### The moat

The moat is **not** a secret, black-box algorithm. That would conflict with the transparency brand
(you can't both "explain everything" and hide the sauce), and competitors read the same public
research anyway. The durable advantages are:

- **A curated, evidence-graded methodology corpus** — the slow, hard work of mapping a thin and
  scattered literature into concrete, honest recommendations. Hard to replicate well.
- **Trust and brand** — being _the_ honest, science-first option in a market full of hype.
- **Longitudinal data** — over time, what actually moves real users' ratings. This compounds and
  cannot be copied.

### Funding model — patronage, not extraction

The app follows the **Lichess model**: it is **free for everyone, with all training features
included**, and a single optional **patronage subscription** lets users support the creator and
further development. Target price **€5/month** (optionally allow paying more; an annual ~€50/yr can
come later). One tier, kept deliberately simple.

This also makes the app **unattractive to clone** — there is very little revenue to extract — which
is a feature, not a bug.

Two hard rules keep this on-brand:

- **No ads.** Ads are an attention-extraction, hype-laden mechanism — the exact thing this app
  positions against — and at this scale they earn almost nothing while inviting tracking/consent
  burden. Free means genuinely free, not ad-supported.
- **Never paywall training quality.** The science, the program, and the adaptation are free
  forever. Premium perks are **cosmetic or non-functional only** (e.g. a supporter badge, maybe
  early access). The moment better _training_ sits behind the paywall, the app has become the thing
  it's fighting.

### Open source

The app is intended to be **open source** — the strongest possible proof of the transparency brand,
and the rest of the Lichess playbook. Key decisions:

- **License: AGPL-3.0** (copyleft _with_ the network clause), the same as Lichess. This lets anyone
  read, verify, and self-host, but **forbids a closed-source commercial fork run as a service** — a
  permissive license (MIT/Apache) would let a competitor clone it, add ads, and monetize. AGPL is
  what makes "free + open" safe rather than self-defeating.
- **What is _not_ given away:** open-sourcing the _code_ (engine + methodology config) does not
  surrender the compounding moats — the **longitudinal outcome data** (private user data, never in
  the repo) and the **ongoing curation + trust**. The methodology is already exposed in-app by the
  transparency brand, so opening it formally is consistent, not a new sacrifice.
- **Secrets stay out of the repo** — OAuth keys, DB credentials, etc. live in environment config,
  always.
- **Timing: open by beta.** The personal-first phase stays private while the architecture is messy;
  the repo goes public once it coheres, by the closed beta at the latest. Do it for verifiability
  and trust, not in expectation of contributors — a niche solo app will draw few early on.

### Data, privacy, and the built-in study

Honesty extends to data. The app is open about **what** it collects (connected-account data,
imported games, and training outcomes) and **why**: those outcomes power the adaptation loop and,
over time, build the longitudinal picture of what actually helps. In effect the app runs **its own
small scientific study on its users' data** — and it says so plainly rather than burying it in a
policy. The users this app is for will understand that contributing anonymized outcome data is how
the app improves, and how the thin chess-training evidence base gets a little less thin.

Principles:

- **Transparent, not extractive.** Clear about what is stored and why; **never sold or shared** for
  advertising or any third-party purpose.
- **User control.** Easy data **export and deletion**; GDPR-aligned by default (the builder is EU-based).
- **Aggregate and anonymized** for any study or product-improvement use; an individual's data stays
  the individual's.
- **Continuous, light-touch user feedback.** Feedback is invited as an ongoing signal — but **never
  obsessively or naggingly**; that would violate the adherence ethic in §3.

---

## 8. Boundaries (what this app is deliberately _not_)

- **No social or multiplayer.** Not in the beta, not after it. It isn't the goal of the app.
- **No LLM/AI in the product** — AI plays chess poorly and invites cost and abuse.
- **No hosted content or in-app play** — everything points outward to external resources.
- **No payments, no native apps, no opening-repertoire trainers** in Phase 1 (payments come later;
  the architecture stays billing-capable).

The build progresses **personal use → closed free beta → public**. Phase 1 targets the first two,
staying inside free infrastructure tiers.

---

## 9. Where the science plugs in

The research phase fills a fixed set of **seams** — well-defined slots in the methodology
configuration that the engine already knows how to read. Filling them tunes the product's behavior
and copy; it never changes the architecture. At a high level the seams cover:

- which skills to measure and how to assess them,
- how to turn a player's games into an understanding of their weaknesses,
- which external resource to recommend, at what difficulty,
- how to space, prioritize, and periodize the work,
- the "why" and the honest evidence rating shown to the user,
- and the rules for healthy, evidence-based engagement (see §3).

The precise list and interfaces are documented in `BUILD.md`; the answers come from `research/`.

---

## 10. Definition of success for Phase 1

A working end-to-end loop that is good enough to train the builder **and** generalizes beyond him:
a user can sign in, connect their chess accounts, get a personalized program of external activities
with honest rationales, log their training, and see the next session genuinely adapt — all running
on free infrastructure, with the science cleanly swappable as research arrives, and nothing
personal hardcoded. In other words: a foundation that can expand into a shippable, monetizable
product without re-architecting.
