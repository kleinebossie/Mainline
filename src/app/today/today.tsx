"use client";

import { trpc } from "@/lib/trpc/react";
import { Button, buttonVariants } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { TransparencyCard } from "@/components/transparency-card";
import type { TodayItem } from "@/server/program";

// The "Today" screen (BUILD.md §7.6, M6/M7). Renders the generated daily session: each item
// is an external-resource activity with its difficulty params and a TransparencyCard
// carrying the graded "why" (L3). Honest framing up top (process goal + expectations,
// Seam 8). M7: logging an outcome (solved/struggled/done) feeds the adaptation loop — a miss
// is scheduled to come back spaced, and "Regenerate" rebuilds the session from the new state.

function itemDetails(item: TodayItem): string {
  const p = item.params;
  if (item.activityType === "spaced_review") {
    const n = p.dueItemRefs?.length ?? 0;
    return n > 0
      ? `Re-solve your due misses: ${p.dueItemRefs!.join(", ")}`
      : "Spaced review of your earlier misses.";
  }
  if (p.track) {
    const bits: string[] = [];
    if (typeof p.targetRating === "number")
      bits.push(`target ~${p.targetRating}`);
    if (typeof p.count === "number") bits.push(`${p.count} puzzles`);
    if (p.structure) bits.push(p.structure);
    if (p.workedExample) bits.push("worked example first");
    return bits.join(" · ");
  }
  return "Do this away from the app, then log it below.";
}

function isPuzzle(item: TodayItem): boolean {
  return item.params.track !== null && item.activityType !== "spaced_review";
}

export function Today() {
  const utils = trpc.useUtils();
  const today = trpc.program.getToday.useQuery();
  const dueReviews = trpc.tracker.dueReviews.useQuery();
  const generate = trpc.program.generate.useMutation({
    onSuccess: () => {
      void utils.program.getToday.invalidate();
      void utils.tracker.dueReviews.invalidate();
    },
  });
  const log = trpc.tracker.logOutcome.useMutation({
    onSuccess: () => {
      void utils.program.getToday.invalidate();
      void utils.tracker.dueReviews.invalidate();
    },
  });

  if (today.isLoading) {
    return <p className="text-muted-foreground text-sm">Loading…</p>;
  }

  const program = today.data;
  const pendingItemId = log.isPending
    ? log.variables?.programItemId
    : undefined;

  if (!program) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-xl">No session yet</CardTitle>
          <CardDescription>
            Generate your first training session from your calibration, games
            and constraints.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Button
            type="button"
            disabled={generate.isPending}
            onClick={() => generate.mutate()}
          >
            {generate.isPending ? "Generating…" : "Generate today's session"}
          </Button>
        </CardContent>
      </Card>
    );
  }

  const due = dueReviews.data ?? 0;

  return (
    <div className="flex flex-col gap-4">
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Today&apos;s focus</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-2">
          <p className="text-sm">{program.honesty.processGoal}</p>
          <p className="text-muted-foreground text-xs">
            {program.honesty.expectations}
          </p>
          {due > 0 && (
            <p className="text-xs font-medium">
              {due} review{due === 1 ? "" : "s"} due — regenerate to pull them
              into your session.
            </p>
          )}
        </CardContent>
      </Card>

      {program.items.map((item) => {
        const done = item.status === "done";
        const skipped = item.status === "skipped";
        const busy = pendingItemId === item.id;
        return (
          <Card key={item.id} className={done ? "opacity-70" : undefined}>
            <CardHeader>
              <div className="flex items-baseline justify-between gap-3">
                <CardTitle className="text-xl">{item.label}</CardTitle>
                {item.estMinutes != null && (
                  <span className="text-muted-foreground shrink-0 text-sm tabular-nums">
                    ~{item.estMinutes} min
                  </span>
                )}
              </div>
              <CardDescription>{itemDetails(item)}</CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col gap-3">
              {item.dimensionLabels.length > 0 && (
                <div className="flex flex-wrap gap-2">
                  {item.dimensionLabels.map((d) => (
                    <span
                      key={d}
                      className="bg-secondary text-secondary-foreground rounded-full px-2 py-0.5 text-xs"
                    >
                      {d}
                    </span>
                  ))}
                </div>
              )}

              {item.externalUrl && (
                <a
                  href={item.externalUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={buttonVariants({ variant: "outline", size: "sm" })}
                >
                  Open on Lichess ↗
                </a>
              )}

              <TransparencyCard
                rationaleText={item.rationaleText}
                evidenceGrade={item.evidenceGrade}
                evidenceTier={item.evidenceTier}
                citationKey={item.citationKey}
                citationSource={item.citationSource}
                confidence={item.confidence}
                soften={item.soften}
              />

              {/* M7 — log the outcome; a miss is scheduled to return spaced. */}
              <div className="flex flex-wrap items-center gap-2 border-t pt-3">
                {done || skipped ? (
                  <span className="text-muted-foreground text-xs">
                    {done ? "✓ Logged" : "Skipped"}
                  </span>
                ) : isPuzzle(item) ? (
                  <>
                    <Button
                      type="button"
                      size="sm"
                      disabled={busy}
                      onClick={() =>
                        log.mutate({
                          programItemId: item.id,
                          type: "puzzle_attempt",
                          correct: true,
                        })
                      }
                    >
                      Solved them
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      disabled={busy}
                      onClick={() =>
                        log.mutate({
                          programItemId: item.id,
                          type: "puzzle_attempt",
                          correct: false,
                        })
                      }
                    >
                      Struggled
                    </Button>
                  </>
                ) : (
                  <Button
                    type="button"
                    size="sm"
                    disabled={busy}
                    onClick={() =>
                      log.mutate({
                        programItemId: item.id,
                        type: "drill_done",
                      })
                    }
                  >
                    Mark done
                  </Button>
                )}
                {!done && !skipped && (
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    disabled={busy}
                    onClick={() =>
                      log.mutate({ programItemId: item.id, type: "skip" })
                    }
                  >
                    Skip
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>
        );
      })}

      {log.data && log.data.scheduledReviews > 0 && (
        <p className="text-muted-foreground text-xs">
          Logged — {log.data.scheduledReviews} item
          {log.data.scheduledReviews === 1 ? "" : "s"} queued to come back
          spaced over the next days.
        </p>
      )}

      <div className="flex items-center gap-3">
        <Button
          type="button"
          variant="ghost"
          size="sm"
          disabled={generate.isPending}
          onClick={() => generate.mutate()}
        >
          {generate.isPending ? "Regenerating…" : "Regenerate session"}
        </Button>
        <span className="text-muted-foreground text-xs">
          Built from your data on {program.createdAt.toLocaleDateString()} ·{" "}
          {program.methodologyVersion}
        </span>
      </div>
    </div>
  );
}
