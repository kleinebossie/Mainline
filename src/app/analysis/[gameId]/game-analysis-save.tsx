import type {
  GameAnalysisRationale,
  GameAnalysisSession,
} from "@/app/analysis/[gameId]/game-analysis-types";
import { MethodologyRationaleCard } from "@/components/methodology-rationale-card";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ErrorNotice } from "@/components/ui/error-notice";
import { cn } from "@/lib/utils";

export function SaveReviewStep({
  session,
  outcomes,
  rationale,
  saveError,
  saving,
  onSave,
}: {
  session: GameAnalysisSession;
  outcomes: Record<number, boolean>;
  rationale: GameAnalysisRationale;
  saveError: string | null;
  saving: boolean;
  onSave: () => void;
}) {
  const hasMoments = session.criticalMoments.length > 0;

  return (
    <div className="mx-auto w-full max-w-2xl">
      <Card>
        <CardHeader>
          <CardTitle>Spaced Repetition (SRS) Integration</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          {hasMoments ? (
            <>
              <p className="text-ink font-serif text-base leading-relaxed">
                Saving this review will create{" "}
                <strong>
                  {session.criticalMoments.length} mistake puzzle
                  {session.criticalMoments.length === 1 ? "" : "s"}
                </strong>{" "}
                and add them to the review schedule.
              </p>

              <div className="flex flex-col gap-3 rounded-lg border bg-card p-4">
                <h4 className="text-graphite font-mono text-xs font-semibold uppercase">
                  Puzzles to schedule
                </h4>
                {session.criticalMoments.map((moment, index) => (
                  <div
                    key={moment.ply}
                    className="flex items-center justify-between border-b pb-2 font-mono text-xs last:border-0 last:pb-0"
                  >
                    <span>Moment at ply {moment.ply}</span>
                    <span
                      className={cn(
                        "font-bold",
                        outcomes[index] ? "text-grade-a" : "text-grade-d",
                      )}
                    >
                      {outcomes[index]
                        ? "Good (Standard Schedule)"
                        : "Again (Lapse Schedule)"}
                    </span>
                  </div>
                ))}
              </div>

              <MethodologyRationaleCard rationale={rationale} />
            </>
          ) : (
            <p className="text-ink font-serif text-base leading-relaxed">
              There are no mistake puzzles to schedule from this game. Saving
              will still record the review.
            </p>
          )}

          <div className="mt-2 flex flex-wrap items-center justify-end gap-3">
            {saveError && (
              <ErrorNotice
                className="basis-full sm:mr-auto sm:basis-auto"
                heading="Review not saved"
                message={saveError}
                onRetry={onSave}
                retrying={saving}
                retryLabel="Try saving again"
              />
            )}
            <Button disabled={saving} onClick={onSave}>
              {saving ? "Saving..." : "Save Session & Finish"}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
