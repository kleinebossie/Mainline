"use client";

import Link from "next/link";

import { trpc } from "@/lib/trpc/react";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { GradeMark } from "@/components/evidence";

// Adaptive calibration UI. The difficulty of each item is produced by the methodology
// (config-driven ladder); we present it as a strength target and record only the
// behavioural outcome (solved / missed). The real puzzle board wires in once the puzzle
// DB is ingested (M3 live step) and the generator lands (M6); here it is a faithful
// shell that drives the same scoring path.

type Grade = "A" | "B" | "C" | "D";
function asGrade(g: string): Grade {
  return g === "A" || g === "B" || g === "C" || g === "D" ? g : "C";
}

export function Calibration() {
  const utils = trpc.useUtils();
  const state = trpc.assessment.state.useQuery();

  const submit = trpc.assessment.submit.useMutation({
    onSuccess: () => void utils.assessment.state.invalidate(),
  });
  const reset = trpc.assessment.reset.useMutation({
    onSuccess: () => void utils.assessment.state.invalidate(),
  });

  if (state.isLoading || !state.data) {
    return <p className="text-graphite font-mono text-sm">Loading…</p>;
  }

  const { next, estimate, completed, responseCount, maxItems, timeBudgetMin } =
    state.data;
  const pending = submit.isPending || reset.isPending;

  const record = (correct: boolean) =>
    submit.mutate({ ratingShown: next.ratingTarget, correct });

  if (completed || next.done) {
    const softened = estimate.flag != null || estimate.evidenceGrade >= "C";
    return (
      <Card gutter={asGrade(estimate.evidenceGrade)} className="settle">
        <CardHeader className="pb-4">
          <CardTitle className="font-serif text-3xl font-semibold">
            Estimated tactical level ≈ {estimate.tacticalRatingEstimate}
          </CardTitle>
          <p className="text-graphite font-mono text-sm mt-1">
            ± {estimate.uncertainty} (uncertainty shrinks with more games and
            reviews).
          </p>
        </CardHeader>
        <CardContent className="flex flex-col gap-5">
          <div className="bg-paper/60 rounded-md border border-dashed p-4">
            <div className="flex items-center gap-2 mb-3">
              <GradeMark grade={estimate.evidenceGrade} />
              {estimate.flag && (
                <span className="border-clay/40 bg-clay/10 text-clay rounded px-1.5 py-0.5 font-mono text-[10px] font-bold uppercase tracking-wider">
                  {estimate.flag}
                </span>
              )}
            </div>
            <p className="text-ink font-serif text-[0.95rem] leading-relaxed">
              {softened
                ? "This calibration method is a placeholder — it estimates tactical vision only, and everything else comes from your actual games. Treat it as a rough starting point, not a verdict."
                : "Calibration estimates tactical vision only; the rest comes from your games."}
            </p>
          </div>
          <div className="flex flex-wrap gap-3 border-t border-line/80 pt-5">
            <Link href="/onboarding/constraints" className={buttonVariants()}>
              Continue
            </Link>
            <Button
              type="button"
              variant="outline"
              disabled={pending}
              onClick={() => reset.mutate()}
            >
              Retake calibration
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="settle">
      <CardHeader className="pb-4">
        <CardTitle className="font-serif text-3xl font-semibold">
          Item {next.itemNumber} of up to {maxItems}
        </CardTitle>
        <p className="text-graphite text-sm leading-relaxed mt-1">
          About a {timeBudgetMin}-minute check. Solve a puzzle around this
          strength, then tell us how it went.
        </p>
      </CardHeader>
      <CardContent className="flex flex-col gap-5">
        <div className="bg-paper/60 rounded-md border p-5 text-center">
          <p className="eyebrow !text-[0.65rem] mb-1">
            Puzzle strength target
          </p>
          <p className="text-4xl font-mono font-bold tracking-tight text-ink tabular-nums">
            {next.ratingTarget}
          </p>
        </div>
        <div className="flex gap-3">
          <Button
            type="button"
            className="flex-1"
            disabled={pending}
            onClick={() => record(true)}
          >
            I solved it
          </Button>
          <Button
            type="button"
            variant="outline"
            className="flex-1"
            disabled={pending}
            onClick={() => record(false)}
          >
            I missed it
          </Button>
        </div>
        {responseCount > 0 && (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="self-start text-xs"
            disabled={pending}
            onClick={() => reset.mutate()}
          >
            Start over
          </Button>
        )}
      </CardContent>
    </Card>
  );
}
