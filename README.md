# Mainline

<p align="center">
  <img src="public/icons/mainline.svg" alt="Mainline Logo" width="96" height="96" />
</p>

<h3 align="center">Personalized, Science-Based Chess Training</h3>

<p align="center">
  Mainline turns your games, constraints, and goals into an adaptive daily chess training session.
</p>

<p align="center">
  <a href="https://mainline-ten.vercel.app"><strong>Try the Live Beta »</strong></a>
</p>

<p align="center">
  <a href="https://github.com/kleinebossie/Mainline/actions"><img src="https://github.com/kleinebossie/Mainline/actions/workflows/ci.yml/badge.svg" alt="CI Status" /></a>
  <a href="https://github.com/kleinebossie/Mainline/blob/main/LICENSE"><img src="https://img.shields.io/badge/license-AGPL--3.0-blue.svg" alt="License: AGPL-3.0" /></a>
  <img src="https://img.shields.io/badge/node-25.2.0-brightgreen.svg" alt="Node.js 25.2.0" />
  <img src="https://img.shields.io/badge/status-Open%20Beta-orange.svg" alt="Open Beta" />
</p>

---

## App Overview

Mainline is a personalized, science-based chess training app. It decides **what to train, when, and why**.

Instead of giving you generic material, Mainline builds a dynamic daily session around your real schedule, connected accounts, and proven learning science.

### 1. Landing Page

![Landing Page](docs/screenshots/landing-page.png)

### 2. Daily Training Session ("Today")

![Today Page](docs/screenshots/today-page.png)

### 3. Process Signals ("Progress")

![Progress Page](docs/screenshots/progress-page.png)

---

## Core Capabilities

- **Adaptive Program Generation**: Fits daily sessions to your available time and target days. Updates work as you complete drills.
- **Client-Side Engine Drills**: Solve puzzles, repair your blunders, review games, and practice endgames in-app using Stockfish WASM.
- **Spaced Repetition Engine**: Schedules review items using the FSRS memory algorithm.
- **Platform Integrations**: Connects to Lichess and Chess.com to analyze real games and track ratings. Accepts manual PGN files.
- **External Resource Logging**: Recommends external books or courses and tracks your study time without hosting copyrighted content.

---

## What Mainline Is Not

Mainline follows strict product boundaries:

- **No runtime LLM or AI**: Uses deterministic algorithms and client-side Stockfish.
- **No dopamine traps**: Excludes streak counters, forced loss aversion, and slot-machine rewards.
- **No paywalls**: All training features stay free.
- **No hosted copyrighted content**: Recommends external resources without hosting them.

---

## Science and Evidence Grades

Mainline grounds every activity in peer-reviewed skill acquisition research. Every recommendation includes an **Evidence Grade** and citation:

| Grade       | Meaning                                                  | Example                                  |
| :---------- | :------------------------------------------------------- | :--------------------------------------- |
| **Grade A** | High confidence from direct or strong transfer research. | Retrieval practice and spaced review     |
| **Grade B** | Moderate confidence from general learning science.       | Process goal setting                     |
| **Grade C** | Reasonable theoretical support, thin direct evidence.    | Specific tactical pattern categorization |
| **Grade D** | Minimal evidence, exploratory practice.                  | Passive game replay                      |

Mainline states its primary principle clearly: **no training activity has been proven to guarantee a rating gain**. Mainline helps you use available evidence without false promises.

---

## Architecture: Engine vs Methodology

The codebase separates generic execution machinery from chess learning science:

- **The Engine** (`src/engine/`, `src/analysis/`, `src/server/`, `src/db/`): Science-free, deterministic code.
- **The Methodology** (`src/methodology/`): Pure functions and versioned JSON configs that contain science values and rationales.

### The Three Laws (CI Enforced)

1. **L1 (Science in Config)**: The Engine contains no chess or learning constants. It reads science strictly through `@/methodology`.
2. **L2 (Pure & Deterministic)**: Generators, adaptation loops, and methodology functions are pure. Time and randomness are injected.
3. **L3 (Graded Evidence)**: Recommendations return a `GradedValue<T>` with a grade, tier, and citation.

Read [VISION.md](file:///home/joebos/programming/Mainline/planning/VISION.md), [BUILD.md](file:///home/joebos/programming/Mainline/planning/BUILD.md), and [METHODOLOGY.md](file:///home/joebos/programming/Mainline/planning/METHODOLOGY.md) for full architecture details.

---

## Local Development

### Prerequisites

- **Node.js**: `25.2.0` (npm `11.x`)
- **Database**: PostgreSQL (Supabase free tier or local instance)

### Quick Start

1. Clone the repository:

   ```bash
   git clone https://github.com/kleinebossie/Mainline.git
   cd Mainline
   ```

2. Copy the environment configuration:

   ```bash
   cp .env.example .env.local
   ```

3. Install dependencies:

   ```bash
   npm ci
   ```

4. Run database migrations:

   ```bash
   npm run prisma:migrate
   ```

5. Start the development server:
   ```bash
   npm run dev
   ```

Open [http://localhost:3000](http://localhost:3000) in your browser.

### Script Registry

| Command               | Action                                                 |
| :-------------------- | :----------------------------------------------------- |
| `npm run dev`         | Starts the local dev server with Stockfish WASM setup. |
| `npm run build`       | Runs Prisma generation and builds the Next.js app.     |
| `npm run typecheck`   | Runs TypeScript compiler checks (`tsc --noEmit`).      |
| `npm run lint`        | Runs ESLint and architectural guard checks.            |
| `npm test`            | Runs all Vitest unit and architectural guard tests.    |
| `npm run test:guards` | Runs architecture and methodology boundary tests.      |
| `npm run test:e2e`    | Runs Playwright end-to-end browser tests.              |
| `npm run format`      | Formats source files with Prettier.                    |

---

## Data Privacy and Open Source

Mainline is open-source software under the **AGPL-3.0** license.

- **No Ads**: Free features stay free without ad tracking.
- **Data Control**: Export or delete your data anytime.
- **Data Privacy**: Your data runs your adaptation loop and improves aggregate recommendations. We never sell user data.

---

## Feedback and Issues

If you find a bug or have feature feedback, please [open an issue on GitHub](https://github.com/kleinebossie/Mainline/issues).
