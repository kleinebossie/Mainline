"use client";

import Link from "next/link";

import { trpc } from "@/lib/trpc/react";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { GradeMark } from "@/components/evidence";

type Grade = "A" | "B" | "C" | "D";
function asGrade(g: string): Grade {
  return g === "A" || g === "B" || g === "C" || g === "D" ? g : "C";
}

// Reveal scaffold. Surfaces the calibration estimate with its evidence grade and a clear
// "what we don't know yet" so a placeholder value never reads as a verdict (L3). The
// game-signal contrast (Seam 3) fills in once analysis + the program engine land.
export function Reveal() {
  const state = trpc.assessment.state.useQuery();

  if (state.isLoading || !state.data) {
    return <p className="text-graphite font-mono text-sm">Loading…</p>;
  }

  const { estimate, completed } = state.data;

  if (!completed) {
    return (
      <Card className="settle">
        <CardHeader className="pb-4">
          <CardTitle className="font-serif text-2xl font-semibold">
            Calibration not done yet
          </CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <p className="text-graphite text-sm leading-relaxed font-serif">
            Finish the short tactical calibration and your starting picture
            appears here.
          </p>
          <Link href="/onboarding/calibration" className={buttonVariants()}>
            Go to calibration →
          </Link>
        </CardContent>
      </Card>
    );
  }

  const minRating = 800;
  const maxRating = 2500;
  const range = maxRating - minRating;
  const ratingVal = estimate.tacticalRatingEstimate;
  const unc = estimate.uncertainty;

  const pctEstimate = Math.min(
    100,
    Math.max(0, ((ratingVal - minRating) / range) * 100),
  );
  const pctMin = Math.min(
    100,
    Math.max(0, ((ratingVal - unc - minRating) / range) * 100),
  );
  const pctMax = Math.min(
    100,
    Math.max(0, ((ratingVal + unc - minRating) / range) * 100),
  );
  const widthPct = pctMax - pctMin;

  return (
    <div className="flex flex-col gap-6">
      <Card gutter={asGrade(estimate.evidenceGrade)} className="settle">
        <CardHeader className="pb-4">
          <CardTitle className="font-serif text-2xl font-semibold">
            Tactical vision ≈ {estimate.tacticalRatingEstimate}
          </CardTitle>
          <p className="text-graphite font-mono text-sm mt-1">
            ± {estimate.uncertainty} (uncertainty shrinks with more games and
            reviews).
          </p>
        </CardHeader>
        <CardContent className="flex flex-col gap-5">
          <div className="flex flex-col gap-2 rounded-md border p-4 bg-paper/30 mb-1">
            <div className="flex justify-between font-mono text-[0.62rem] text-graphite uppercase tracking-wider">
              <span>Calibration Gauge</span>
              <span>800 – 2500</span>
            </div>
            <div className="relative h-4 w-full bg-ink/5 dark:bg-ink/20 rounded-sm border border-line overflow-hidden">
              {/* Uncertainty range block */}
              <div
                className="absolute top-0 bottom-0 bg-evergreen/15 dark:bg-evergreen/35 border-x border-evergreen/30"
                style={{ left: `${pctMin}%`, width: `${widthPct}%` }}
              />
              {/* Estimate indicator line */}
              <div
                className="absolute top-0 bottom-0 w-0.5 bg-evergreen"
                style={{ left: `${pctEstimate}%` }}
              />
            </div>
            <div className="flex justify-between font-mono text-[0.65rem] text-graphite/70 tabular-nums">
              <span>800</span>
              <span>1200</span>
              <span>1600</span>
              <span>2000</span>
              <span>2400</span>
            </div>
          </div>

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
              This starting estimate measures tactical vision only. It is a
              rough calibration point used to tailor your initial sessions; your
              real strengths and weaknesses will emerge from your actual games.
            </p>
          </div>
        </CardContent>
      </Card>

      <Card className="settle [animation-delay:100ms]">
        <CardHeader className="pb-4">
          <CardTitle className="font-serif text-2xl font-semibold">
            What we don&apos;t know yet
          </CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-5">
          <p className="text-graphite text-sm leading-relaxed font-serif">
            Your real weaknesses (blunders, phase leaks, time use) come from
            analysing your games — that lands with the analysis engine and your
            first training program in a later step. We won&apos;t guess at them
            here.
          </p>
          <div className="flex flex-wrap items-center gap-3 border-t border-line/80 pt-5">
            <Link href="/today" className={buttonVariants()}>
              Go to Today →
            </Link>
            <Link
              href="/dashboard"
              className={buttonVariants({ variant: "outline" })}
            >
              Open dashboard
            </Link>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
