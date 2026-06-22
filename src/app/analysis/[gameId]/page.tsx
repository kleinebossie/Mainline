import { redirect } from "next/navigation";
import { auth } from "@/server/auth";
import { GameAnalysisFlow } from "@/app/analysis/[gameId]/game-analysis-flow";

// The Game Analysis structured session page (BUILD.md M10). Auth-gated.
// Runs the 5-step structured protocol for the specified game.
export default async function GameAnalysisPage() {
  const session = await auth();
  if (!session?.user) redirect("/signin");

  return <GameAnalysisFlow />;
}
