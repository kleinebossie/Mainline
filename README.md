# Mainline

Mainline is a personalized, science-based chess training app. It builds and adapts a dynamic training program around your games, time budget, and goals.

Mainline is currently in closed beta.

## What Mainline Does

Mainline answers three basic questions: what to train, when to train, and why.

- **Adaptive program**: Your training session updates continuously as you complete drills and play games.
- **In-app training**: Solve puzzles, drill your own blunders, review games, and practice endgames using a local Stockfish engine.
- **External references**: Track your real games on Lichess or Chess.com, and log study time for external books or courses.
- **Personal constraints**: You set your daily time limit and training days. The app fits the plan to your schedule.

## What Mainline Is Not

Mainline stays strictly within clear boundaries:

- No runtime LLM or AI inside the app.
- No social features or multiplayer gameplay.
- No hosted copyrighted books or course material.
- No paywalled training features or advertisements.

## Science and Honesty

Most chess training products promise fast rating gains. Mainline takes a different approach based on two principles:

1. **Science-based**: Every activity comes with a clear evidence grade (A, B, C, or D) and citation.
2. **Radically honest**: No training activity has been proven to guarantee a rating increase. Mainline helps you use available evidence without making fake promises.

Mainline uses evidence-based motivation. It avoids manipulative streak counters and slot-machine rewards. You remain in control of your plan.

## Beta Information

Mainline is open-source software licensed under the AGPL-3.0 license.

During the beta:
- All training features are free.
- The app uses free tier infrastructure.
- User data is used strictly to run your adaptation loop and improve training recommendations. Data is never sold or shared with third parties.

## Local Development

If you want to run Mainline locally, ensure you have Node 25.2.0 and npm 11 installed.

1. Clone the repository and navigate to the project folder.
2. Copy the environment template:
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

Open [http://localhost:3000](http://localhost:3000) in your browser to view the app.

## Feedback and Issues

If you find a bug or have feedback during the beta, please open an issue on GitHub.
