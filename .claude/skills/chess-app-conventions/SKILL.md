---
name: chess-app-conventions
description: Standing house rules for ANY code change in the chess-training app — the stack, the strict src/ import boundaries, the Engine-vs-chess-engine naming, the three architectural laws, and the CI/verification gates. Loads on any app-code task so prompts can stay terse.
---

# House rules (apply to any code in this repo)

The standing context every code change assumes, so prompts don't repeat it. Specifics live in
`planning/BUILD.md`; this is the always-on summary. For a full milestone, use [[build-slice]].

## Stack (BUILD.md §3 — don't substitute)

TypeScript **strict** (`noUncheckedIndexedAccess`) · **Next.js App Router** · **tRPC + Zod** (schemas
shared client/server/loader) · **PostgreSQL / Supabase free** · **Prisma** · **Auth.js (NextAuth v5)**,
Google + Lichess OAuth2 **PKCE** · **Tailwind + shadcn/ui** · **chess.js** + react-chessboard/chessground ·
**stockfish.wasm** client-side in a Web Worker · **FSRS** as a generic Engine util · **Vitest** (golden) ·
**Playwright** (e2e) · **Vercel Hobby + Vercel Cron**. One Next.js app, modular `src/`.

## Repo boundaries (BUILD.md §4 — load-bearing)

- `engine/` and `analysis/` may import `methodology/` (types + provider fns) and `lib/` — **never the
  reverse** — and hold **no science constants**.
- `methodology/` imports only `lib/` and `engine/math` (generic algorithms).
- `db/` holds **no business logic**; `app/`/`server/` orchestrate, they don't decide graded choices.

## Naming (avoid the collision)

- **Engine** (capital-E) = the generic, science-free machinery in `src/engine/`.
- **chess engine / Stockfish** = the WASM analysis engine behind `AnalysisEngineAdapter`. Never call the
  Engine "the chess engine."

## The three laws (BUILD.md §0.1)

- **L1** — science only in config. Deep-dive + checklist: [[engine-methodology-guard]].
- **L2** — decisions pure & deterministic; inject `Clock`/seed; no `Date.now()` / `Math.random()` in
  `engine/` or `methodology/` decision code.
- **L3** — every methodology leaf is a `GradedValue` (grade/tier/citation); snapshot it onto persisted
  artifacts; C/D/stub values carry `soften`/`stub` and never render as fact ([[evidence-grade]]).

## Done means green (BUILD.md §13)

All required CI gates: `typecheck (tsc --noEmit) → lint (incl. L1/L2 rules) → unit (vitest) →
build (next build) → e2e (playwright) → guards`. Golden snapshots regenerate only via an explicit
command; drift fails CI.

## Phase-1 scope — do NOT build (BUILD.md §14)

No payments/billing (stay billing-capable via `User.patronStatus`), no native apps, no
social/multiplayer, no hosted content / in-app play, **no LLM at runtime**, no opening-repertoire
trainer, no server-side engine analysis, no Chess.com OAuth login (username-only read).

Source of truth: `planning/BUILD.md` §0,§3,§4,§13,§14. Related: [[build-slice]],
[[engine-methodology-guard]], [[evidence-grade]].
