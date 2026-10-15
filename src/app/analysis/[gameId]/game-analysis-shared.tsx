import { formatGameDate, platformLabel, resultLabel } from "@/lib/format-game";
import { cn } from "@/lib/utils";
import type { GameAnalysisGame } from "@/app/analysis/[gameId]/game-analysis-types";

export function GameIdentity({
  game,
  externalUrl,
}: {
  game: GameAnalysisGame;
  /** Deep link to the game on its platform; rendered as one quiet line (feedback
   *  round 2): useful at every stage of analysis, never shouted. */
  externalUrl?: string | null;
}) {
  return (
    <div className="sheet flex flex-wrap items-center gap-x-4 gap-y-2 px-5 py-3.5 settle">
      <div className="flex items-center gap-2">
        <span
          className={cn(
            "inline-block h-3 w-3 rounded-full border border-ink",
            game.color === "w"
              ? "bg-paper"
              : game.color === "b"
                ? "bg-ink"
                : "border-rule bg-rule",
          )}
          aria-hidden
        />
        <span className="text-base font-semibold text-ink">
          {game.you ?? "You"}
        </span>
        {game.userRating != null && (
          <span className="text-graphite font-mono text-xs">
            {game.userRating}
          </span>
        )}
      </div>
      <span className="text-graphite font-mono text-[0.65rem] tracking-wider">
        vs
      </span>
      <div className="flex items-center gap-2">
        <span className="text-base font-semibold text-ink">
          {game.opponent ?? "Opponent"}
        </span>
        {game.opponentRating != null && (
          <span className="text-graphite font-mono text-xs">
            {game.opponentRating}
          </span>
        )}
      </div>
      <span
        className={cn(
          "rounded px-2 py-0.5 font-mono text-[0.65rem] font-bold tracking-wide",
          game.result === "win"
            ? "bg-grade-a/10 text-grade-a"
            : game.result === "loss"
              ? "bg-grade-d/10 text-grade-d"
              : "bg-grade-c/10 text-grade-c",
        )}
      >
        {resultLabel(game.result)}
      </span>
      <div className="ml-auto flex flex-wrap items-center gap-x-2 text-graphite font-mono text-xs">
        <span>{platformLabel(game.platform)}</span>
        {game.timeControl && (
          <>
            <span aria-hidden>·</span>
            <span>{game.timeControl}</span>
          </>
        )}
        <span aria-hidden>·</span>
        <span>{formatGameDate(game.playedAt, game.platform)}</span>
        {externalUrl && (
          <>
            <span aria-hidden>·</span>
            <a
              href={externalUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="underline decoration-rule underline-offset-2 transition-colors hover:text-ink"
            >
              View on {platformLabel(game.platform)}
            </a>
          </>
        )}
      </div>
      {(game.event || game.opening) && (
        <p className="basis-full border-t border-rule/60 pt-2 font-serif text-xs text-graphite">
          {game.event ? game.event : null}
          {game.event && game.opening ? " · " : null}
          {game.opening
            ? `${game.eco ? `${game.eco} · ` : ""}${game.opening}`
            : null}
        </p>
      )}
    </div>
  );
}
