import { redirect } from "next/navigation";

import { auth } from "@/server/auth";
import { PageShell } from "@/components/app-shell";
import { ReviewBoard } from "@/components/review-board";

// M12 — the interactive game review: a step-through advantage graph over the game's raw
// evals, blunder markers, on-demand best line, and "drill these blunders" (spaced). Distinct
// from the structured 5-step analysis flow at /analysis/[gameId]. Auth-gated.
interface GameReviewPageProps {
  params: Promise<{ gameId: string }>;
}

export default async function GameReviewPage({ params }: GameReviewPageProps) {
  const session = await auth();
  if (!session?.user) redirect("/signin");

  const { gameId } = await params;

  return (
    <PageShell
      eyebrow="Game review"
      title="Step through your game"
      lede="Walk the advantage graph, see where it turned, and turn your blunders into spaced drills — engine on demand, not in your face."
      width="wide"
    >
      <ReviewBoard gameId={gameId} />
    </PageShell>
  );
}
