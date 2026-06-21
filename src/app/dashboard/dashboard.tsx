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
    <div className="flex flex-col gap-8">
      <section className="flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <h2 className="font-semibold">Current ratings</h2>
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
          <p className="text-destructive text-sm" role="alert">
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
          <p className="text-muted-foreground text-sm">Loading…</p>
        ) : profiles.data && profiles.data.length > 0 ? (
          <ul className="flex flex-col gap-2">
            {profiles.data.map((p) => (
              <li
                key={p.platform}
                className="flex items-center justify-between rounded-md border p-3 text-sm"
              >
                <span className="font-medium">
                  {PLATFORM_LABEL[p.platform] ?? p.platform}
                </span>
                <span className="text-muted-foreground">
                  {formatRatings(p.ratings)} · {p.totalGames} games
                </span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-muted-foreground text-sm">
            No ratings yet. Connect an account, then press “Sync now”.
          </p>
        )}
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="font-semibold">Recent games</h2>
        {games.isLoading ? (
          <p className="text-muted-foreground text-sm">Loading…</p>
        ) : games.data && games.data.length > 0 ? (
          <ul className="flex flex-col gap-2">
            {games.data.map((g) => (
              <li
                key={g.id}
                className="flex items-center justify-between rounded-md border p-3 text-sm"
              >
                <span>
                  <span className="font-medium">
                    {PLATFORM_LABEL[g.platform] ?? g.platform}
                  </span>{" "}
                  · {g.playedAt.toLocaleDateString()}
                  {g.opening ? (
                    <span className="text-muted-foreground">
                      {" "}
                      · {g.opening}
                    </span>
                  ) : null}
                </span>
                <span className="text-muted-foreground">
                  {g.result ? (RESULT_LABEL[g.result] ?? g.result) : "—"}
                  {g.userRatingAtGame ? ` · ${g.userRatingAtGame}` : ""}
                </span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-muted-foreground text-sm">
            No games imported yet. Press “Sync now” to pull your latest games.
          </p>
        )}
      </section>
    </div>
  );
}
