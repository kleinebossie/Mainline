import {
  pctWinChance,
  type Attempt,
  type MomentAnalysis,
} from "@/app/analysis/[gameId]/game-analysis-evaluation";
import type {
  GameAnalysisRationale,
  GameAnalysisSession,
} from "@/app/analysis/[gameId]/game-analysis-types";
import {
  MethodologyRationaleCard,
  MethodologyRationaleGroup,
} from "@/components/methodology-rationale-card";
import {
  BOARD_SIZE_CLASS,
  InteractiveBoard,
  type BoardMove,
} from "@/components/interactive-board";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { StatusMessage } from "@/components/ui/status-message";

export type AnalysisStatus = "loading" | "ready" | "error";

export function ActiveReproductionStep({
  session,
  moment,
  boardFen,
  boardOrientation,
  highlightedSquares,
  currentMomentIndex,
  analysis,
  analysisStatus,
  lastAttempt,
  grading,
  solved,
  revealed,
  canReveal,
  triesLeft,
  engineDelayRationale,
  filterRationale,
  guessToleranceRationale,
  onMove,
  onReveal,
  onContinue,
  onFinish,
}: {
  session: GameAnalysisSession;
  moment?: GameAnalysisSession["criticalMoments"][number];
  boardFen: string | null;
  boardOrientation: "white" | "black";
  highlightedSquares: string[];
  currentMomentIndex: number;
  analysis: MomentAnalysis | null;
  analysisStatus: AnalysisStatus;
  lastAttempt?: Attempt;
  grading: boolean;
  solved: boolean;
  revealed: boolean;
  canReveal: boolean;
  triesLeft: number;
  engineDelayRationale: GameAnalysisRationale;
  filterRationale: GameAnalysisRationale;
  guessToleranceRationale: GameAnalysisRationale;
  onMove: (move: BoardMove) => void;
  onReveal: () => void;
  onContinue: () => void;
  onFinish: () => void;
}) {
  if (session.criticalMoments.length === 0) {
    return (
      <div className="mx-auto w-full max-w-2xl">
        <Card>
          <CardHeader>
            <CardTitle>No critical moments at your level</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            <p className="text-ink font-serif text-base leading-relaxed">
              Nothing in this game met the configured threshold for active
              reproduction.
            </p>
            <MethodologyRationaleCard rationale={filterRationale} />
            <div className="flex justify-end">
              <Button onClick={onFinish}>Finish review</Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!boardFen || !moment) return null;

  return (
    <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_24rem]">
      <div className="flex flex-col gap-3">
        <InteractiveBoard
          fen={boardFen}
          onMove={onMove}
          orientation={boardOrientation}
          disabled={analysisStatus !== "ready" || grading || solved || revealed}
          highlightedSquares={highlightedSquares}
          className={BOARD_SIZE_CLASS}
        />
        <div
          className={`${BOARD_SIZE_CLASS} flex items-center justify-between px-1`}
        >
          <span className="text-graphite font-mono text-xs">
            Moment {currentMomentIndex + 1} of {session.criticalMoments.length}
          </span>
          {!solved && !revealed && (
            <span className="text-graphite font-mono text-xs">
              {triesLeft > 0
                ? `${triesLeft} ${triesLeft === 1 ? "try" : "tries"} before reveal`
                : "Reveal available"}
            </span>
          )}
        </div>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="font-serif text-lg">
            Find a better move
          </CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          {analysisStatus === "loading" && (
            <StatusMessage tone="loading" className="py-2">
              Stockfish is reading the position…
            </StatusMessage>
          )}
          {analysisStatus === "error" && (
            <StatusMessage tone="error" className="py-2">
              We couldn&apos;t review this position. You can still continue.
            </StatusMessage>
          )}

          {analysisStatus === "ready" && (
            <>
              <p className="text-graphite font-serif text-sm leading-relaxed">
                The engine is held back. Play a stronger move than the one you
                chose directly on the board.
              </p>

              {analysis?.gameMoveSan && (
                <p className="text-graphite font-mono text-xs">
                  In the game you played{" "}
                  <span className="font-bold text-ink">
                    {analysis.gameMoveSan}
                  </span>
                  {analysis.gameWinProbDrop < 0.05
                    ? ": you stayed clearly ahead; the engine just had a cleaner finish."
                    : `, dropping ~${pctWinChance(analysis.gameWinProbDrop)}% win chance.`}
                </p>
              )}

              {grading && (
                <p className="text-graphite font-mono text-sm">
                  Checking your move…
                </p>
              )}

              {!grading && solved && lastAttempt && (
                <div className="rounded-md border border-grade-a/30 bg-grade-a/10 p-3">
                  <p className="text-grade-a font-mono text-xs font-bold uppercase">
                    ✓ Found it: {lastAttempt.san}
                  </p>
                  <p className="mt-1 font-serif text-sm text-ink">
                    {lastAttempt.pctBetter != null
                      ? `This move is ${lastAttempt.pctBetter}% better than the move you played in the game.`
                      : "This move steers clear of the mistake you played."}
                  </p>
                </div>
              )}

              {!grading && !solved && !revealed && lastAttempt && (
                <div className="rounded-md border border-line bg-ink/[0.03] p-3">
                  <p className="text-grade-d font-mono text-xs font-bold uppercase">
                    Not the strongest: {lastAttempt.san}
                  </p>
                  <p className="mt-1 font-serif text-sm text-ink">
                    That move still gives up ~
                    {pctWinChance(lastAttempt.winProbDrop)}% win chance. Try
                    another.
                  </p>
                </div>
              )}

              {canReveal && (
                <Button variant="outline" onClick={onReveal}>
                  Show engine moves
                </Button>
              )}

              {revealed && analysis && (
                <div className="flex max-h-48 flex-col gap-2 overflow-y-auto pr-1">
                  <h4 className="text-graphite font-mono text-xs font-semibold uppercase">
                    Top engine moves
                  </h4>
                  {analysis.topMoves.map((move, index) => (
                    <div
                      key={`${move.uci}-${index}`}
                      className="flex items-center justify-between gap-2 rounded-lg border border-line bg-card p-3"
                    >
                      <span className="font-mono text-sm font-bold text-ink">
                        {index + 1}. {move.san}
                      </span>
                      <div className="text-right">
                        <span className="text-graphite font-mono text-xs">
                          {move.mate != null
                            ? "Mate"
                            : `${move.cp > 0 ? "+" : ""}${(move.cp / 100).toFixed(1)}`}
                        </span>
                        {move.pctBetter != null && (
                          <p className="text-evergreen font-mono text-[0.7rem]">
                            {move.pctBetter}% better than your move
                          </p>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {(solved || revealed) && (
                <Button onClick={onContinue}>
                  {currentMomentIndex + 1 < session.criticalMoments.length
                    ? "Next critical moment"
                    : "Continue to spaced repetition"}
                </Button>
              )}
            </>
          )}

          {analysisStatus === "error" && (
            <Button onClick={onContinue}>Continue</Button>
          )}

          <div className="mt-2 border-t border-line/60 pt-4">
            <MethodologyRationaleGroup
              items={[
                {
                  title: "Delayed engine feedback",
                  rationale: engineDelayRationale,
                },
                ...(lastAttempt || revealed
                  ? [
                      {
                        title: "Move grading tolerance",
                        rationale: guessToleranceRationale,
                      },
                    ]
                  : []),
              ]}
            />
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
