# VISION.md: Product Intent and Core Principles

This document provides the high-level product vision, brand principles, and system boundaries for Mainline.

## Context Pointers

- **Technical Plan**: Read [BUILD.md](file:///home/joebos/programming/Mainline/planning/BUILD.md) to inspect engine architecture, data schemas, and the 0-to-1 build specification.
- **Methodology**: Read [METHODOLOGY.md](file:///home/joebos/programming/Mainline/planning/METHODOLOGY.md) to inspect evidence grades, citations, and research seams.
- **Release and Operations**: Read [SHIPPING.md](file:///home/joebos/programming/Mainline/planning/SHIPPING.md) and [OPERATIONS.md](file:///home/joebos/programming/Mainline/planning/OPERATIONS.md) for launch stages and operational procedures.

---

## 1. The Core Idea

Mainline generates and continuously adapts a personalized, science-based chess training program.

Mainline is not another game analysis tool, puzzle trainer, or flashcard deck. Mainline operates at the training-program layer. It decides what you should train, which resources to use, and why. The application continuously adapts this plan as you train and play.

Three principles differentiate Mainline:

1. **Personalization through Constraints**: The user defines time budgets, days per week, goals, owned resources, and preferences. The application connects to Lichess and Chess.com. The program adapts to the user's real schedule rather than imposing a fixed curriculum.
2. **Dynamic Adaptation**: The training tracker records every outcome. The program reprioritizes upcoming sessions automatically. There is no static syllabus.
3. **In-App Drills with External References**: The application delivers interactive drills in-browser using open data and client-side Stockfish WASM. This includes tactical puzzles, personal blunder practice, game review, and endgame sparring. Activities that require external platforms remain references (playing rated games on Lichess or Chess.com, or studying copyrighted books). The application hosts no copyrighted books, operates no multiplayer gameplay server, and runs no runtime AI or LLMs.

---

## 2. Brand Identity: Science-Based and Radically Honest

The product identity centers on user trust through two commitments:

- **Science-Based**: Recommendations derive from peer-reviewed research on skill acquisition, cognitive load, and memory retention rather than folklore.
- **Radical Honesty**: The application displays explicit "why this / why now" rationales and evidence grades for every recommendation. It explains when evidence is strong and when evidence is limited. It never promises rating increases.

### The Central Scientific Truth

No scientific study has proven that any chess training activity causes a measured rating gain. Mainline helps users train effectively using the best available evidence, but it never guarantees rating outcomes.

Honesty is our primary differentiator. Every recommendation remains transparent and explainable.

---

## 3. Adherence and Motivation

Knowing what to train does not guarantee consistent execution over months. Training adherence is a primary design priority.

Mainline avoids manipulative engagement techniques, such as artificial streaks, loss-aversion shaming, and slot-machine animations. Instead, the application applies evidence-based motivation design rooted in Self-Determination Theory:

- **Autonomy**: Users retain full control over training constraints, weekly goals, and activity choices.
- **Competence**: Progress views highlight controllable effort and tactical precision rather than volatile rating changes.
- **Intrinsic Motivation**: Focusing on mastery and problem solving produces longer-lasting engagement than extrinsic point rewards.

---

## 4. Core Architecture: Engine vs Methodology Split

The codebase separates generic application machinery from chess learning science:

- **The Engine**: Generic, deterministic code covering authentication, platform imports, raw Stockfish analysis, session scheduling, outcome logging, and user interfaces. The Engine contains zero chess or learning constants.
- **The Methodology**: The learning science parameters: measured skills, game interpretation rules, resource mappings, difficulty targets, spacing intervals, and rationale copy. Methodology is loaded as a versioned JSON configuration.

This separation enables development of the core engine while research evolves. Science enters the system through a single typed interface.

---

## 5. The User Experience Flow

1. **Sign In**: Authenticate using an existing account (such as Google or Lichess OAuth).
2. **Connect Platforms**: Link Lichess and Chess.com accounts to import real games and ratings.
3. **Assess and Calibrate**: Complete a brief tactical calibration and set daily time constraints and goals.
4. **Receive Daily Program**: Access a personalized daily session with visible evidence rationales.
5. **Train and Track**: Complete in-app drills with automatic outcome recording and log external study.
6. **Adaptive Revision**: Watch upcoming sessions adapt as new game results and drill outcomes arrive.

---

## 6. Target Audience and Build Constraints

- **Personal-First and Public-Ready**: The developer is user zero. However, the system is multi-user from day one. Nothing personal is hardcoded in the codebase.
- **All Rating Levels**: The application serves beginners and advanced players alike. Rating levels live in user data rather than application logic.
- **Solo AI-Assisted Development**: Built using automated AI coding agents. Technical choices prioritize type safety, deterministic testing, and simplicity.
- **Respect for External Platforms**: The application respects Lichess and Chess.com API terms. It caches responses, respects rate limits, and uses clean platform adapters.
- **Web-First Delivery**: Responsive web application running on desktop and mobile browsers.

---

## 7. Business Model and Open Source Strategy

### Funding Model: Developer Patronage

Mainline uses a developer patronage model:

- **100% Free Core Access**: All training features, science, and adaptation algorithms remain free for all users.
- **Optional Patronage Subscription**: Users can fund operations via an optional subscription (such as 5 euros per month).
- **Revenue Allocation**: Patronage revenue funds server hosting, database compute, external APIs, and developer compensation.
- **Zero Advertisements**: The application contains no advertising.
- **No Paywalled Training**: The application never locks training quality or science behind a paywall.

### Open Source Strategy

- **AGPL-3.0 License**: Mainline is licensed under AGPL-3.0. Anyone can inspect, verify, and self-host the code. The license prevents proprietary closed-source commercial forks.
- **Sustainable Moats**: The code is open source, while user trust, curated methodology, and longitudinal outcome datasets form the durable product advantage.
- **Secret Isolation**: All credentials and API keys remain strictly in environment variables outside the repository.

---

## 8. Data Privacy and Observational Research

Mainline is transparent about data collection:

- **Data Collected**: Account profile details, imported chess games, and training outcome metrics.
- **Purpose**: Power the adaptive engine and build an observational dataset on chess skill acquisition.
- **User Control**: Full data export and account deletion are available in Settings. The application is GDPR-compliant by design.
- **Data Protection**: Personal data is never sold or shared with third parties.
- **Research Consent**: Observational research exports use HMAC pseudonymization and require explicit, revocable user consent.

---

## 9. Deliberate System Boundaries

Mainline explicitly excludes the following features:

- **No Social or Multiplayer**: No friend feeds, chat rooms, or player-versus-player matchmaking.
- **No Runtime AI or LLMs**: No runtime language models or conversational AI in the core application.
- **No Hosted Copyrighted Content**: No scanned chess books or unauthorized video hosting.
- **No Competing Gameplay Platform**: Real games remain hosted on Lichess and Chess.com.

---

## 10. Definition of Phase 1 Success

Phase 1 succeeds when an end-to-end training loop runs smoothly:

A user signs in, connects chess accounts, receives a personalized training program, trains in-browser with automatic outcome tracking, and sees upcoming sessions adapt deterministically. The application operates within free infrastructure tiers with cleanly swappable methodology configurations.
