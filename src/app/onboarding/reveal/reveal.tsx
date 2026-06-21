"use client";

import Link from "next/link";

import { trpc } from "@/lib/trpc/react";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

// Reveal scaffold. Surfaces the calibration estimate with its evidence grade and a clear
// "what we don't know yet" so a placeholder value never reads as a verdict (L3). The
// game-signal contrast (Seam 3) fills in once analysis + the program engine land.
export function Reveal() {
  const state = trpc.assessment.state.useQuery();

  if (state.isLoading || !state.data) {
    return <p className="text-muted-foreground text-sm">Loading…</p>;
  }

  const { estimate, completed } = state.data;

  if (!completed) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-xl">Calibration not done yet</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          <p className="text-muted-foreground text-sm">
            Finish the short tactical calibration and your starting picture appears
            here.
          </p>
          <Link
            href="/onboarding/calibration"
            className={buttonVariants({ size: "sm" })}
          >
            Go to calibration
          </Link>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <Card>
        <CardHeader>
          <CardTitle className="text-xl">
            Tactical vision ≈ {estimate.tacticalRatingEstimate} ±{" "}
            {estimate.uncertainty}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p
            className="text-muted-foreground rounded-md border border-dashed p-3 text-sm"
            role="note"
          >
            Grade {estimate.evidenceGrade}
            {estimate.flag ? ` (${estimate.flag})` : ""} — a placeholder calibration
            method, tactical vision only. It&apos;s a rough starting point, not a
            judgement of your overall play.
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-xl">What we don&apos;t know yet</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          <p className="text-muted-foreground text-sm">
            Your real weaknesses (blunders, phase leaks, time use) come from analysing
            your games — that lands with the analysis engine and your first training
            program in a later step. We won&apos;t guess at them here.
          </p>
          <Link href="/dashboard" className={buttonVariants({ variant: "ghost", size: "sm" })}>
            Back to dashboard
          </Link>
        </CardContent>
      </Card>
    </div>
  );
}
