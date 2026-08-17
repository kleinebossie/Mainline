"use client";

import { useEffect, useMemo, useState } from "react";

import { trpc } from "@/lib/trpc/react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { StatusMessage } from "@/components/ui/status-message";
import { ErrorNotice } from "@/components/ui/error-notice";
import { errorMessage } from "@/lib/error-presentation";
import {
  getGuestSession,
  saveGuestConnection,
  removeGuestConnection,
  type GuestConnection,
} from "@/lib/guest-session";

const PLATFORM_LABEL: Record<string, string> = {
  lichess: "Lichess",
  chesscom: "Chess.com",
};

type ConnectionError = {
  scope: "lichess" | "chesscom" | "disconnect";
  message: string;
};

export function ConnectionsManager() {
  const utils = trpc.useUtils();
  const [mounted, setMounted] = useState(false);
  const [guestConnections, setGuestConnections] = useState<GuestConnection[]>(
    [],
  );

  useEffect(() => {
    setMounted(true);
    setGuestConnections(getGuestSession().connections ?? []);
  }, []);

  const list = trpc.connections.list.useQuery();

  const displayedConnections = useMemo(() => {
    const map = new Map<
      string,
      { id: string; platform: string; externalUsername: string; status: string }
    >();
    for (const c of guestConnections) {
      map.set(c.platform, c);
    }
    for (const c of list.data ?? []) {
      map.set(c.platform, c);
    }
    return Array.from(map.values());
  }, [list.data, guestConnections]);

  const [lichessUsername, setLichessUsername] = useState("");
  const [chessComUsername, setChessComUsername] = useState("");
  const [error, setError] = useState<ConnectionError | null>(null);

  const addLichess = trpc.connections.addLichessUsername.useMutation({
    onSuccess: (data) => {
      setLichessUsername("");
      setError(null);
      const newConn: GuestConnection = {
        id: data.id,
        platform: "lichess",
        externalUsername: data.externalUsername,
        status: "active",
        connectedAt: new Date().toISOString(),
        ratings: data.ratings as Record<
          string,
          { rating: number; rd?: number; games?: number }
        >,
      };
      const updated = saveGuestConnection(newConn);
      setGuestConnections(updated.connections ?? []);
      void utils.connections.list.invalidate();
    },
    onError: (e) =>
      setError({
        scope: "lichess",
        message: errorMessage(
          e,
          "The Lichess account was not added. Try again.",
        ),
      }),
  });

  const addChessCom = trpc.connections.addChessComUsername.useMutation({
    onSuccess: (data) => {
      setChessComUsername("");
      setError(null);
      const newConn: GuestConnection = {
        id: data.id,
        platform: "chesscom",
        externalUsername: data.externalUsername,
        status: "active",
        connectedAt: new Date().toISOString(),
        ratings: data.ratings as Record<
          string,
          { rating: number; rd?: number; games?: number }
        >,
      };
      const updated = saveGuestConnection(newConn);
      setGuestConnections(updated.connections ?? []);
      void utils.connections.list.invalidate();
    },
    onError: (e) =>
      setError({
        scope: "chesscom",
        message: errorMessage(
          e,
          "The Chess.com account was not added. Try again.",
        ),
      }),
  });

  const disconnect = trpc.connections.disconnect.useMutation({
    onSuccess: (_data, variables) => {
      const updated = removeGuestConnection(variables.id);
      setGuestConnections(updated.connections ?? []);
      void utils.connections.list.invalidate();
    },
    onError: (e) =>
      setError({
        scope: "disconnect",
        message: errorMessage(
          e,
          "The account stayed connected. Reload the list and try again.",
        ),
      }),
  });

  return (
    <div className="flex flex-col gap-10">
      <div className="flex flex-col gap-2 rounded-md border border-line bg-paper/60 p-4">
        <h3 className="font-serif text-base font-semibold text-ink">
          Connect your accounts to enable blunder practice
        </h3>
        <p className="text-graphite font-serif text-sm leading-relaxed">
          Mainline imports your public game history to detect key tactical
          mistakes and convert them into personalized spaced-repetition drills.
        </p>
      </div>

      <section className="flex flex-col gap-4">
        <h2 className="eyebrow border-b border-line/80 pb-3">Lichess</h2>
        <p className="text-graphite text-sm leading-relaxed font-serif">
          Link by username to import public profile and game data. Your Lichess
          password and token are not stored.
        </p>
        <div className="flex max-w-md flex-col gap-2">
          <label htmlFor="lichess-username" className="eyebrow !text-[0.65rem]">
            Lichess username
          </label>
          <form
            className="flex gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              const value = lichessUsername.trim();
              if (value) addLichess.mutate({ username: value });
            }}
          >
            <Input
              id="lichess-username"
              value={lichessUsername}
              onChange={(e) => {
                setLichessUsername(e.target.value);
                setError(null);
              }}
              placeholder="e.g. yourusername"
              autoComplete="username"
              disabled={addLichess.isPending}
              aria-invalid={error?.scope === "lichess"}
              aria-describedby={
                error?.scope === "lichess"
                  ? "lichess-connection-error"
                  : undefined
              }
            />
            <Button
              type="submit"
              disabled={addLichess.isPending || !lichessUsername.trim()}
            >
              {addLichess.isPending ? "Checking…" : "Add account"}
            </Button>
          </form>
        </div>
        {error?.scope === "lichess" && (
          <StatusMessage id="lichess-connection-error" tone="error">
            {error.message}
          </StatusMessage>
        )}
      </section>

      <section className="flex flex-col gap-4">
        <h2 className="eyebrow border-b border-line/80 pb-3">Chess.com</h2>
        <p className="text-graphite text-sm leading-relaxed font-serif">
          Link by username (read-only public data; no password or token stored).
        </p>
        <div className="flex max-w-md flex-col gap-2">
          <label
            htmlFor="chesscom-username"
            className="eyebrow !text-[0.65rem]"
          >
            Chess.com username
          </label>
          <form
            className="flex gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              const value = chessComUsername.trim();
              if (value) addChessCom.mutate({ username: value });
            }}
          >
            <Input
              id="chesscom-username"
              value={chessComUsername}
              onChange={(e) => {
                setChessComUsername(e.target.value);
                setError(null);
              }}
              placeholder="e.g. yourusername"
              autoComplete="username"
              disabled={addChessCom.isPending}
              aria-invalid={error?.scope === "chesscom"}
              aria-describedby={
                error?.scope === "chesscom"
                  ? "chesscom-connection-error"
                  : undefined
              }
            />
            <Button
              type="submit"
              disabled={addChessCom.isPending || !chessComUsername.trim()}
            >
              {addChessCom.isPending ? "Checking…" : "Add account"}
            </Button>
          </form>
        </div>
        {error?.scope === "chesscom" && (
          <StatusMessage id="chesscom-connection-error" tone="error">
            {error.message}
          </StatusMessage>
        )}
      </section>

      <section className="flex flex-col gap-4">
        <h2 className="eyebrow border-b border-line/80 pb-3">
          Connected accounts
        </h2>
        {error?.scope === "disconnect" && (
          <StatusMessage tone="error" heading="Account still connected">
            {error.message}
          </StatusMessage>
        )}
        {list.isLoading && !mounted ? (
          <StatusMessage tone="loading">
            Loading connected accounts…
          </StatusMessage>
        ) : list.error && !mounted ? (
          <ErrorNotice
            error={list.error}
            heading="Connections unavailable"
            message="Mainline could not load your connected accounts. Try the list again."
            onRetry={() => void list.refetch()}
            retrying={list.isFetching}
            retryLabel="Reload connections"
          />
        ) : displayedConnections.length > 0 ? (
          <ul className="flex flex-col gap-2">
            {displayedConnections.map((conn) => (
              <li
                key={conn.id}
                className="bg-card flex flex-col gap-3 rounded-lg border p-4 shadow-sheet sm:flex-row sm:items-center sm:justify-between"
              >
                <span className="text-sm">
                  <span className="font-serif text-base font-medium">
                    {PLATFORM_LABEL[conn.platform] ?? conn.platform}
                  </span>{" "}
                  ·{" "}
                  <span className="font-mono text-xs text-graphite">
                    {conn.externalUsername}
                  </span>
                  {conn.status !== "active" && (
                    <span className="text-clay font-mono text-xs">
                      {" "}
                      ({conn.status})
                    </span>
                  )}
                </span>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  disabled={disconnect.isPending}
                  onClick={() => {
                    setError(null);
                    disconnect.mutate({ id: conn.id });
                  }}
                  className="self-start text-clay hover:bg-clay/[0.06] hover:text-clay sm:self-auto"
                >
                  {disconnect.isPending && disconnect.variables?.id === conn.id
                    ? "Disconnecting…"
                    : "Disconnect"}
                </Button>
              </li>
            ))}
          </ul>
        ) : (
          <StatusMessage tone="neutral" heading="No accounts connected">
            Add a Chess.com username or connect Lichess to import games.
          </StatusMessage>
        )}
      </section>
    </div>
  );
}
