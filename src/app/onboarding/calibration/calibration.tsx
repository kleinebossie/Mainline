"use client";

import Link from "next/link";

import { trpc } from "@/lib/trpc/react";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { GradeMark } from "@/components/evidence";

// Adaptive calibration UI. Difficulty for each item is produced by the methodology
// (config-driven ladder); we present it as a strength target and record only the
// behavioural outcome (solved / missed). Now MULTI-TRACK: the same ladder runs once per
// configured skill dimension (tactics → calculation → endgames), building a broader
// behavioural baseline. The real puzzle board wires in once the generator lands; this is a
// faithful shell that drives the same scoring path.

type Grade = "A" | "B" | "C" | "D";
function asGrade(g: string): Grade {
  return g === "A" || g === "B" || g === "C" || g === "D" ? g : "C";
}

// Display-only gauge axis (UI scale, not a methodology value).
const MIN = 800;
const MAX = 2500;
function pct(r: number): number {
  return Math.min(100, Math.max(0, ((r - MIN) / (MAX - MIN)) * 100));
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

  const {
    completed,
    maxItems,
    timeBudgetMin,
    trackCount,
    activeTrackIndex,
    activeTrack,
    tracks,
  } = state.data;
  const pending = submit.isPending || reset.isPending;

  // --- Completed: the multi-dimensional baseline -----------------------------
  if (completed || !activeTrack) {
    const primary = tracks[0]!;
    return (
      <Card gutter={asGrade(primary.estimate.evidenceGrade)} className="settle">
        <CardHeader className="pb-4">
          <CardTitle className="font-serif text-3xl font-semibold">
            Your starting baseline
          </CardTitle>
          <p className="text-graphite font-mono text-sm mt-1">
            A behavioural read across {trackCount} dimension
            {trackCount === 1 ? "" : "s"} — uncertainty shrinks with more games
            and reviews.
          </p>
        </CardHeader>
        <CardContent className="flex flex-col gap-5">
          <div className="flex flex-col gap-4">
            {tracks.map((t) => {
              const v = t.estimate.tacticalRatingEstimate;
              const u = t.estimate.uncertainty;
              const left = pct(v - u);
              const width = pct(v + u) - left;
              return (
                <div
                  key={t.id}
                  className="flex flex-col gap-2 rounded-md border p-4 bg-paper/30"
                >
                  <div className="flex items-center justify-between gap-3">
                    <span className="font-serif text-base font-semibold text-ink">
                      {t.label}
                    </span>
                    <span className="flex items-center gap-2">
                      <span className="font-mono text-sm font-semibold tabular-nums text-ink">
                        ≈ {v} ± {u}
                      </span>
                      <GradeMark grade={t.estimate.evidenceGrade} />
                    </span>
                  </div>
                  <div className="relative h-3 w-full bg-ink/5 dark:bg-ink/20 rounded-sm border border-line overflow-hidden">
                    <div
                      className="absolute top-0 bottom-0 bg-evergreen/15 dark:bg-evergreen/35 border-x border-evergreen/30"
                      style={{ left: `${left}%`, width: `${width}%` }}
                    />
                    <div
                      className="absolute top-0 bottom-0 w-0.5 bg-evergreen"
                      style={{ left: `${pct(v)}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>

          <p className="text-graphite font-serif text-sm leading-relaxed border-t border-line/80 pt-4">
            These are rough calibration points, not verdicts — a placeholder
            method that estimates a few skills directly. The fuller picture comes
            from analysing your real games.
          </p>

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

  // --- In progress: the active track's next item -----------------------------
  const record = (correct: boolean) =>
    submit.mutate({ ratingShown: activeTrack.next.ratingTarget, correct });

  return (
    <Card className="settle">
      <CardHeader className="pb-4">
        <div className="flex items-center justify-between gap-3">
          <p className="eyebrow !text-[0.65rem]">
            Track {activeTrackIndex + 1} of {trackCount} · {activeTrack.label}
          </p>
          <p className="text-graphite font-mono text-[0.65rem] uppercase tracking-wider">
            ~{timeBudgetMin} min each
          </p>
        </div>
        <CardTitle className="font-serif text-3xl font-semibold mt-2">
          {activeTrack.label}: item {activeTrack.next.itemNumber} of up to{" "}
          {maxItems}
        </CardTitle>
        <p className="text-graphite text-sm leading-relaxed mt-1">
          Solve a {activeTrack.label.toLowerCase()} puzzle around this strength,
          then tell us how it went.
        </p>
      </CardHeader>
      <CardContent className="flex flex-col gap-5">
        {/* Track progress dots */}
        <div className="flex items-center gap-1.5">
          {tracks.map((t, i) => (
            <span
              key={t.id}
              aria-hidden
              className={
                "h-1.5 flex-1 rounded-full " +
                (t.completed
                  ? "bg-evergreen"
                  : i === activeTrackIndex
                    ? "bg-evergreen/40"
                    : "bg-line")
              }
            />
          ))}
        </div>

        <div className="bg-paper/60 rounded-md border p-5 text-center">
          <p className="eyebrow !text-[0.65rem] mb-1">Puzzle strength target</p>
          <p className="text-4xl font-mono font-bold tracking-tight text-ink tabular-nums">
            {activeTrack.next.ratingTarget}
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
        {(activeTrackIndex > 0 || activeTrack.responseCount > 0) && (
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
