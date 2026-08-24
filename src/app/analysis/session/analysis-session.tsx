"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";

import { trpc } from "@/lib/trpc/react";
import { PageShell } from "@/components/app-shell";
import { StatusMessage } from "@/components/ui/status-message";
import { ErrorNotice } from "@/components/ui/error-notice";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  isAnalysisBlockComplete,
} from "@/engine/interactive/analysis-queue";
import type { AnalysisPromptRung } from "@/methodology";
import { analysisPromptFor, loadMethodology } from "@/methodology";

interface QueueGameView {
  id: string;
  playedAt: string | null;
  color: string | null;
  result: string | null;
  timeControl: string | null;
  opening: string | null;
  opponent: string | null;
  opponentRating: number | null;
  platform: string;
  externalGameId: string;
  promptRung: AnalysisPromptRung;
  externalUrl: string | null;
}

type QueueData = {
  budgetMinutes: number;
  usedMinutes: number;
  completedReviews: number;
  targetCount: number;
  games: QueueGameView[];
};

const RUNG_LABELS: Record<AnalysisPromptRung, string> = {
  fresh: "Fresh game · recall it first",
  recent: "Recent game · name what comes back",
  old: "Older game · recognize before you reveal",
};

function resultLabel(result: string | null): string {
  if (result === "win") return "Win";
  if (result === "loss") return "Loss";
  if (result === "draw") return "Draw";
  return "Result unknown";
}

function colorLabel(color: string | null): string {
  if (color === "w") return "White";
  if (color === "b") return "Black";
  return "Unknown color";
}

const dateFormatter = new Intl.DateTimeFormat(undefined, {
  month: "short",
  day: "numeric",
});

function playedLabel(playedAt: string | null): string | null {
  if (!playedAt) return null;
  const date = new Date(playedAt);
  if (Number.isNaN(date.getTime())) return null;
  return dateFormatter.format(date);
}

function formatMinutes(minutes: number): string {
  const rounded = Math.max(1, Math.ceil(minutes));
  return `${rounded} min`;
}

function GameMetadataLine({ game }: { game: QueueGameView }) {
  const parts = [
    game.opponent ?? "Unknown opponent",
    resultLabel(game.result),
    colorLabel(game.color),
    playedLabel(game.playedAt),
    game.opening ?? null,
    game.opponentRating != null ? `~${game.opponentRating}` : null,
  ].filter((part): part is string => part !== null);
  return (
    <p className="text-graphite font-mono text-xs leading-relaxed">
      {parts.join(" · ")}
      {game.externalUrl && (
        <>
          {" · "}
          <a
            href={game.externalUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="underline decoration-line underline-offset-2 hover:text-ink"
          >
            View on {game.platform === "chesscom" ? "Chess.com" : "Lichess"} ↗
          </a>
        </>
      )}
    </p>
  );
}

export function AnalysisQueueSession() {
  const searchParams = useSearchParams();
  const programItemId = searchParams.get("item");
  // Set by the review flow on its way back; shows the between-games breather once.
  const [returningFromReview, setReturningFromReview] = useState(
    () => searchParams.get("done") != null,
  );

  const queue = trpc.analysis.queueGames.useQuery(
    { programItemId: programItemId ?? "" },
    {
      enabled: programItemId != null,
      refetchOnWindowFocus: false,
      retry: false,
    },
  );

  const data = queue.data as QueueData | undefined;

  const state = useMemo(() => {
    if (!data) return null;
    const finished = isAnalysisBlockComplete(
      data.completedReviews,
      data.usedMinutes,
      data.targetCount,
      data.budgetMinutes,
    );
    const head = data.games[0] ?? null;
    if (finished || !head) return { kind: "wrap-up" as const };
    // Soft stop lives between games only: an active review is never interrupted.
    if (returningFromReview) {
      return { kind: "breather" as const, head };
    }
    return { kind: "pre-game" as const, head };
  }, [data, returningFromReview]);

  if (programItemId == null) {
    return (
      <PageShell width="default">
        <ErrorNotice
          heading="Review queue unavailable"
          message="Open the review queue from a game analysis block on Today."
          secondaryAction={
            <Link
              href="/today"
              className={buttonVariants({ variant: "outline", size: "sm" })}
            >
              Back to Today
            </Link>
          }
        />
      </PageShell>
    );
  }

  if (queue.isLoading) {
    return (
      <StatusMessage tone="loading">Loading your review queue…</StatusMessage>
    );
  }

  if (queue.error || !data || !state) {
    return (
      <PageShell width="default">
        <ErrorNotice
          error={queue.error}
          heading="Review queue unavailable"
          message="Mainline could not load this review queue. Try again, or open the block again from Today."
          onRetry={() => void queue.refetch()}
          retrying={queue.isFetching}
          retryLabel="Reload queue"
        />
      </PageShell>
    );
  }

  const minutesLeft = Math.max(0, data.budgetMinutes - data.usedMinutes);

  return (
    <PageShell
      eyebrow="Guided game review"
      title="Review your games"
      lede={
        data.completedReviews > 0
          ? `${data.completedReviews} of about ${data.targetCount} games reviewed today. ${formatMinutes(data.usedMinutes)} of ${formatMinutes(data.budgetMinutes)} used.`
          : `About ${data.targetCount} games within ${formatMinutes(data.budgetMinutes)}. The timer never runs while you review; the budget is checked between games.`
      }
      width="default"
    >
      <div className="settle flex flex-col gap-5">
        <QueueProgressStrip
          completed={data.completedReviews}
          target={data.targetCount}
        />

        {state.kind === "wrap-up" && (
          <WrapUpCard
            completedReviews={data.completedReviews}
            usedMinutes={data.usedMinutes}
            minutesLeft={minutesLeft}
            emptyLibrary={data.completedReviews === 0 && data.games.length === 0}
          />
        )}

        {state.kind === "breather" && (
          <Card className="p-5 sm:p-6" gutter="C">
            <div className="flex flex-col gap-4">
              <p className="eyebrow text-evergreen">
                Game {data.completedReviews} done
              </p>
              <p className="font-serif text-xl font-semibold leading-snug text-ink">
                {formatMinutes(minutesLeft)}
                {minutesLeft > 0
                  ? " left in this block."
                  : " used. That covers the planned budget."}
              </p>
              <p className="text-graphite font-serif text-sm leading-relaxed">
                About {Math.max(1, data.targetCount - data.completedReviews)}{" "}
                more {data.targetCount - data.completedReviews === 1 ? "game" : "games"}{" "}
                fit the plan.
              </p>
              <div className="border-t border-line pt-4">
                <p className="eyebrow">{RUNG_LABELS[state.head.promptRung]}</p>
                <p className="mt-2 font-serif text-base font-medium leading-relaxed text-ink">
                  {state.head.opponent ?? "A game"}
                  {state.head.playedAt
                    ? `, played ${playedLabel(state.head.playedAt)}`
                    : ""}
                  . Next prompt:
                </p>
                <NextPrompt rung={state.head.promptRung} />
                <GameMetadataLine game={state.head} />
              </div>
              <div className="flex flex-wrap items-center gap-3">
                <Button onClick={() => setReturningFromReview(false)}>
                  Continue
                </Button>
                <Link
                  href="/today"
                  className={buttonVariants({ variant: "ghost", size: "sm" })}
                >
                  Back to Today
                </Link>
              </div>
              <p className="text-graphite font-mono text-[0.65rem] leading-relaxed">
                Stopping here keeps the block open. Mainline checks the budget
                only between games, so your next review always runs to its end.
              </p>
            </div>
          </Card>
        )}

        {state.kind === "pre-game" && (
          <PreGameCard game={state.head} programItemId={programItemId} />
        )}
      </div>
    </PageShell>
  );
}

function NextPrompt({ rung }: { rung: AnalysisPromptRung }) {
  const prompt = useQueuePrompt(rung);
  return (
    <p className="mt-1 font-serif italic leading-relaxed text-graphite">
      “{prompt}”
    </p>
  );
}

function useQueuePrompt(rung: AnalysisPromptRung): string {
  return useMemo(() => analysisPromptFor(rung, loadMethodology()).value, [
    rung,
  ]);
}

function QueueProgressStrip({
  completed,
  target,
}: {
  completed: number;
  target: number;
}) {
  const slots = Math.max(target, completed, 1);
  return (
    <div
      className="grid gap-1"
      style={{ gridTemplateColumns: `repeat(${slots}, minmax(0, 1fr))` }}
      aria-label={`${completed} of ${target} games reviewed`}
    >
      {Array.from({ length: slots }, (_, index) => (
        <span
          key={index}
          className={
            index < completed
              ? "h-2 rounded-full border border-evergreen bg-evergreen"
              : "h-2 rounded-full border border-line bg-paper"
          }
        />
      ))}
    </div>
  );
}

function PreGameCard({
  game,
  programItemId,
}: {
  game: QueueGameView;
  programItemId: string;
}) {
  const prompt = useQueuePrompt(game.promptRung);
  const reviewHref = `/analysis/${game.id}?return=queue&item=${encodeURIComponent(programItemId)}&rung=${game.promptRung}`;
  return (
    <Card className="p-5 sm:p-6" gutter="C">
      <article className="flex flex-col gap-4">
        <div>
          <p className="eyebrow">{RUNG_LABELS[game.promptRung]}</p>
          <h2 className="mt-1 font-serif text-2xl font-semibold leading-tight text-ink">
            {game.opponent ?? "An unreviewed game"}
          </h2>
          <div className="mt-2">
            <GameMetadataLine game={game} />
          </div>
        </div>

        <blockquote className="border-l-2 border-evergreen/40 py-1 pl-4">
          <p className="font-serif text-lg leading-relaxed text-ink">
            {prompt}
          </p>
        </blockquote>

        <div className="flex flex-wrap items-center gap-3 border-t border-line pt-4">
          <Link
            href={reviewHref}
            className={buttonVariants({ size: "lg" }) + " h-11 px-6"}
          >
            Start review →
          </Link>
          <Link
            href="/today"
            className={buttonVariants({ variant: "ghost", size: "sm" })}
          >
            Back to Today
          </Link>
        </div>
      </article>
    </Card>
  );
}

function WrapUpCard({
  completedReviews,
  usedMinutes,
  minutesLeft,
  emptyLibrary,
}: {
  completedReviews: number;
  usedMinutes: number;
  minutesLeft: number;
  emptyLibrary: boolean;
}) {
  const heading = emptyLibrary
    ? "No games are waiting for review"
    : "Review block complete";
  const message = emptyLibrary
    ? "Every scanned game in your library has been reviewed. Play or import new games, and the next session will pick them up."
    : `You reviewed ${completedReviews} ${completedReviews === 1 ? "game" : "games"} today (${formatMinutes(usedMinutes)}).${
        minutesLeft <= 0 ? " You used the full planned budget." : ""
      } Blunders from these games come back as spaced drills.`;
  return (
    <Card className="p-5 sm:p-6">
      <div className="flex flex-col gap-4">
        <p className="eyebrow text-evergreen">{heading}</p>
        <p className="font-serif text-base leading-relaxed text-ink">
          {message}
        </p>
        <div className="flex flex-wrap items-center gap-3 border-t border-line pt-4">
          <Link href="/today" className={buttonVariants({ size: "sm" })}>
            Back to Today
          </Link>
          <Link
            href="/analysis"
            className={buttonVariants({ variant: "ghost", size: "sm" })}
          >
            Browse all games
          </Link>
        </div>
      </div>
    </Card>
  );
}
