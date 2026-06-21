"use client";

import Link from "next/link";

import { trpc } from "@/lib/trpc/react";
import { Button, buttonVariants } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

// Adaptive calibration UI. The difficulty of each item is produced by the methodology
// (config-driven ladder); we present it as a strength target and record only the
// behavioural outcome (solved / missed). The real puzzle board wires in once the puzzle
// DB is ingested (M3 live step) and the generator lands (M6); here it is a faithful
// shell that drives the same scoring path.
const GRADE_NOTE: Record<string, string> = {
  A: "Strong evidence",
  B: "Suggestive evidence",
  C: "Theory / best-guess",
  D: "Unsupported — avoid",
};

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
    return <p className="text-muted-foreground text-sm">Loading…</p>;
  }

  const { next, estimate, completed, responseCount, maxItems, timeBudgetMin } =
    state.data;
  const pending = submit.isPending || reset.isPending;

  const record = (correct: boolean) =>
    submit.mutate({ ratingShown: next.ratingTarget, correct });

  if (completed || next.done) {
    const softened = estimate.flag != null || estimate.evidenceGrade >= "C";
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-2xl">
            Estimated tactical level ≈ {estimate.tacticalRatingEstimate}
          </CardTitle>
          <CardDescription>
            ± {estimate.uncertainty} (uncertainty shrinks with more games and
            reviews).
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <p
            className="text-muted-foreground rounded-md border border-dashed p-3 text-sm"
            role="note"
          >
            <span className="font-medium">
              Grade {estimate.evidenceGrade} ·{" "}
              {GRADE_NOTE[estimate.evidenceGrade] ?? "—"}
              {estimate.flag ? ` (${estimate.flag})` : ""}.
            </span>{" "}
            {softened
              ? "This calibration method is a placeholder — it estimates tactical vision only, and everything else comes from your actual games. Treat it as a rough starting point, not a verdict."
              : "Calibration estimates tactical vision only; the rest comes from your games."}
          </p>
          <div className="flex flex-wrap gap-3">
            <Link href="/onboarding/constraints" className={buttonVariants()}>
              Continue
            </Link>
            <Button
              type="button"
              variant="ghost"
              disabled={pending}
              onClick={() => reset.mutate()}
            >
              Retake
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-2xl">
          Item {next.itemNumber} of up to {maxItems}
        </CardTitle>
        <CardDescription>
          About a {timeBudgetMin}-minute check. Solve a puzzle around this
          strength, then tell us how it went.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <div className="rounded-md border p-4 text-center">
          <p className="text-muted-foreground text-xs uppercase tracking-wide">
            Puzzle strength
          </p>
          <p className="text-3xl font-bold tabular-nums">{next.ratingTarget}</p>
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
          <button
            type="button"
            className="text-muted-foreground hover:text-foreground self-start text-xs underline"
            disabled={pending}
            onClick={() => reset.mutate()}
          >
            Start over
          </button>
        )}
      </CardContent>
    </Card>
  );
}
