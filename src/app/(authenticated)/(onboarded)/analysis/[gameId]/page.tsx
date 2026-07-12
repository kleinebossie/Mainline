import { GameAnalysisFlow } from "@/app/analysis/[gameId]/game-analysis-flow";

// The Game Analysis structured session page (BUILD.md M10). Auth-gated.
// Runs the 5-step structured protocol for the specified game.
export default function GameAnalysisPage() {
  return <GameAnalysisFlow />;
}
