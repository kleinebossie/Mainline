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
          <CardTitle className="font-serif text-2xl font-semibold">Calibration not done yet</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <p className="text-graphite text-sm leading-relaxed font-serif">
            Finish the short tactical calibration and your starting picture
            appears here.
          </p>
          <Link
            href="/onboarding/calibration"
            className={buttonVariants()}
          >
            Go to calibration →
          </Link>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <Card gutter={asGrade(estimate.evidenceGrade)} className="settle">
        <CardHeader className="pb-4">
          <CardTitle className="font-serif text-2xl font-semibold">
            Tactical vision ≈ {estimate.tacticalRatingEstimate}
          </CardTitle>
          <p className="text-graphite font-mono text-sm mt-1">
            ± {estimate.uncertainty} (uncertainty shrinks with more games and reviews).
          </p>
        </CardHeader>
        <CardContent>
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
              This starting estimate measures tactical vision only. It is a rough calibration point used to tailor your initial sessions; your real strengths and weaknesses will emerge from your actual games.
            </p>
          </div>
        </CardContent>
      </Card>

      <Card className="settle [animation-delay:100ms]">
        <CardHeader className="pb-4">
          <CardTitle className="font-serif text-2xl font-semibold">What we don&apos;t know yet</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-5">
          <p className="text-graphite text-sm leading-relaxed font-serif">
            Your real weaknesses (blunders, phase leaks, time use) come from
            analysing your games — that lands with the analysis engine and your
            first training program in a later step. We won&apos;t guess at them
            here.
          </p>
          <div className="flex flex-wrap items-center gap-3 border-t border-line/80 pt-5">
            <Link
              href="/today"
              className={buttonVariants()}
            >
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
