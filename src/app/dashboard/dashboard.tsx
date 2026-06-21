"use client";

import { trpc } from "@/lib/trpc/react";
import { Button } from "@/components/ui/button";

const PLATFORM_LABEL: Record<string, string> = {
  lichess: "Lichess",
  chesscom: "Chess.com",
};

const RESULT_LABEL: Record<string, string> = {
  win: "Win",
  loss: "Loss",
  draw: "Draw",
};

const RESULT_CLR: Record<string, string> = {
  win: "text-evergreen",
  loss: "text-clay",
  draw: "text-graphite",
};

function formatRatings(ratings: unknown): string {
  if (!ratings || typeof ratings !== "object") return "—";
  const entries = Object.entries(ratings as Record<string, { rating?: number }>)
    .filter(([, v]) => typeof v?.rating === "number")
    .map(([fmt, v]) => `${fmt} ${v.rating}`);
  return entries.length ? entries.join(" · ") : "—";
}

export function Dashboard() {
  const utils = trpc.useUtils();
  const profiles = trpc.import.latestProfiles.useQuery();
  const games = trpc.import.recentGames.useQuery();

  const syncMutation = trpc.import.sync.useMutation({
    onSuccess: () => {
      void utils.import.recentGames.invalidate();
      void utils.import.latestProfiles.invalidate();
    },
  });

  return (
    <div className="flex flex-col gap-12">
      <section className="flex flex-col gap-4">
        <div className="flex items-center justify-between gap-4 border-b border-line/80 pb-3">
          <h2 className="eyebrow">Current ratings</h2>
          <Button
            type="button"
            size="sm"
            disabled={syncMutation.isPending}
            onClick={() => syncMutation.mutate()}
          >
            {syncMutation.isPending ? "Syncing…" : "Sync now"}
          </Button>
        </div>
        {syncMutation.data?.errors.length ? (
          <p className="text-clay text-sm" role="alert">
            Some platforms couldn’t be reached:{" "}
            {syncMutation.data.errors
              .map(
                (e) =>
                  `${PLATFORM_LABEL[e.platform] ?? e.platform} (${e.code})`,
              )
              .join(", ")}
            .
          </p>
        ) : null}
        {profiles.isLoading ? (
          <p className="text-graphite font-mono text-sm">Loading…</p>
        ) : profiles.data && profiles.data.length > 0 ? (
          <ul className="flex flex-col gap-2">
            {profiles.data.map((p) => (
              <li
                key={p.platform}
                className="bg-card flex items-center justify-between gap-4 rounded-md border p-3.5"
              >
                <span className="font-serif text-base font-medium">
                  {PLATFORM_LABEL[p.platform] ?? p.platform}
                </span>
                <span className="text-graphite font-mono text-xs tabular-nums">
                  {formatRatings(p.ratings)} · {p.totalGames} games
                </span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-graphite text-sm">
            No ratings yet. Connect an account, then press “Sync now”.
          </p>
        )}
      </section>

      <section className="flex flex-col gap-4">
        <h2 className="eyebrow border-b border-line/80 pb-3">Recent games</h2>
        {games.isLoading ? (
          <p className="text-graphite font-mono text-sm">Loading…</p>
        ) : games.data && games.data.length > 0 ? (
          <ul className="flex flex-col gap-1.5">
            {games.data.map((g) => (
              <li
                key={g.id}
                className="flex items-center justify-between gap-4 rounded-md border border-transparent px-3.5 py-2.5 hover:border-line hover:bg-card"
              >
                <span className="text-sm">
                  <span className="font-mono text-xs uppercase tracking-wide text-graphite">
                    {PLATFORM_LABEL[g.platform] ?? g.platform}
                  </span>{" "}
                  <span className="text-graphite font-mono text-xs">
                    {g.playedAt.toLocaleDateString()}
                  </span>
                  {g.opening ? (
                    <span className="ml-1 font-serif">· {g.opening}</span>
                  ) : null}
                </span>
                <span className="font-mono text-xs tabular-nums">
                  <span className={g.result ? RESULT_CLR[g.result] : ""}>
                    {g.result ? (RESULT_LABEL[g.result] ?? g.result) : "—"}
                  </span>
                  {g.userRatingAtGame ? (
                    <span className="text-graphite"> · {g.userRatingAtGame}</span>
                  ) : (
                    ""
                  )}
                </span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-graphite text-sm">
            No games imported yet. Press “Sync now” to pull your latest games.
          </p>
        )}
      </section>
    </div>
  );
}
