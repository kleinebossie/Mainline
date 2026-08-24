import type { GameAnalysisRationale } from "@/app/analysis/[gameId]/game-analysis-types";
import type { RationaleEntry } from "@/methodology";
import { MethodologyRationaleCard } from "@/components/methodology-rationale-card";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";

/**
 * `mode` comes from the queue's prompt rung (TEMP_ANALYSIS_QUEUE_PLAN §6.4):
 * - "timed": the protocol's calibration wait applies; the countdown, the completed
 *   mark, and the skip row render only when a wait is actually configured.
 * - "untimed": games older than the fresh window skip the pause entirely — no
 *   countdown, no completed mark, no skip row, no pause rationale.
 */
export function CalibrationStep({
  prompt,
  reflectionNote,
  countdown,
  initialCountdown = countdown,
  mode = "timed",
  skipped,
  rationale,
  recallWhy,
  onReflectionChange,
  onSkip,
  onContinue,
}: {
  prompt: string;
  reflectionNote: string;
  countdown: number;
  /** The configured delay at session start (0 means no wait exists at all). */
  initialCountdown?: number;
  mode?: "timed" | "untimed";
  skipped: boolean;
  rationale: GameAnalysisRationale;
  /** Graded why-this note for the write-first step (retrieval practice); shown when
   *  the pause is dropped so the reflection never looks arbitrary. */
  recallWhy?: RationaleEntry | null;
  onReflectionChange: (value: string) => void;
  onSkip: () => void;
  onContinue: () => void;
}) {
  const untimed = mode === "untimed" || initialCountdown <= 0;
  const incomplete = untimed
    ? reflectionNote.trim().length < 3
    : countdown > 0 || reflectionNote.trim().length < 3;
  const showsTimer = !untimed && countdown > 0;
  const showsCompletedMark = !untimed && initialCountdown > 0 && countdown <= 0;

  return (
    <div className="mx-auto w-full max-w-2xl">
      <Card>
        <CardHeader>
          <CardTitle>Reflect before you review</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <p className="text-ink font-serif text-base leading-relaxed">
            {prompt}
          </p>

          <Textarea
            value={reflectionNote}
            onChange={(event) => onReflectionChange(event.target.value)}
            placeholder="What were you feeling, calculating, or overlooking?"
            rows={4}
            aria-describedby="reflection-help"
          />

          <p id="reflection-help" className="text-graphite font-mono text-xs">
            {untimed
              ? "Write at least a few words, then continue."
              : "Write at least a few words, then continue when the timer ends."}
          </p>

          <div className="mt-2 flex items-center justify-between gap-4">
            {showsTimer ? (
              <span className="text-graphite font-mono text-xs">
                Review unlocks in {Math.floor(countdown / 60)}:
                {String(countdown % 60).padStart(2, "0")}
              </span>
            ) : showsCompletedMark ? (
              <span className="text-evergreen font-mono text-xs font-semibold">
                ✓ Calibration delay completed
              </span>
            ) : (
              <span aria-hidden="true" />
            )}

            <Button disabled={incomplete} onClick={onContinue}>
              Start active reproduction
            </Button>
          </div>

          {!untimed && initialCountdown > 0 && incomplete && !skipped && (
            <div className="flex flex-wrap items-center justify-between gap-3 border-t border-line/60 pt-3">
              <p className="text-grade-d font-serif text-xs">
                Skipping this reflection isn&apos;t recommended. See the
                rationale below.
              </p>
              <Button size="sm" variant="outline" onClick={onSkip}>
                Skip anyway
              </Button>
            </div>
          )}
          {!untimed && skipped && (
            <p className="text-graphite font-mono text-xs">
              Calibration skipped for this session.
            </p>
          )}

          {!untimed && (
            <div className="mt-4 border-t border-line/60 pt-4">
              <MethodologyRationaleCard rationale={rationale} />
            </div>
          )}

          {untimed && recallWhy && (
            <div className="mt-4 border-t border-line/60 pt-4">
              <MethodologyRationaleCard rationale={recallWhy} />
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
