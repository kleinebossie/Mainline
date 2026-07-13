import type { GameAnalysisRationale } from "@/app/analysis/[gameId]/game-analysis-types";
import { MethodologyRationaleCard } from "@/components/methodology-rationale-card";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";

export function CalibrationStep({
  prompt,
  reflectionNote,
  countdown,
  skipped,
  rationale,
  onReflectionChange,
  onSkip,
  onContinue,
}: {
  prompt: string;
  reflectionNote: string;
  countdown: number;
  skipped: boolean;
  rationale: GameAnalysisRationale;
  onReflectionChange: (value: string) => void;
  onSkip: () => void;
  onContinue: () => void;
}) {
  const incomplete = countdown > 0 || reflectionNote.trim().length < 3;

  return (
    <div className="mx-auto w-full max-w-2xl">
      <Card>
        <CardHeader>
          <CardTitle>Reflect Before You Review</CardTitle>
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
            Write at least a few words, then continue when the timer ends.
          </p>

          <div className="mt-2 flex items-center justify-between gap-4">
            {countdown > 0 ? (
              <span className="text-graphite font-mono text-xs">
                Review unlocks in {Math.floor(countdown / 60)}:
                {String(countdown % 60).padStart(2, "0")}
              </span>
            ) : (
              <span className="text-evergreen font-mono text-xs font-semibold">
                ✓ Calibration delay completed
              </span>
            )}

            <Button disabled={!skipped && incomplete} onClick={onContinue}>
              Start Active Reproduction
            </Button>
          </div>

          {incomplete && !skipped && (
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
          {skipped && (
            <p className="text-graphite font-mono text-xs">
              Calibration skipped for this session.
            </p>
          )}

          <div className="mt-4 border-t border-line/60 pt-4">
            <MethodologyRationaleCard rationale={rationale} />
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
