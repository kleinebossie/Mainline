"use client";

import { useState } from "react";

import { trpc } from "@/lib/trpc/react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

const PLATFORM_LABEL: Record<string, string> = {
  lichess: "Lichess",
  chesscom: "Chess.com",
};

export function ConnectionsManager() {
  const utils = trpc.useUtils();
  const list = trpc.connections.list.useQuery();

  const [username, setUsername] = useState("");
  const [error, setError] = useState<string | null>(null);

  const addChessCom = trpc.connections.addChessComUsername.useMutation({
    onSuccess: () => {
      setUsername("");
      setError(null);
      void utils.connections.list.invalidate();
    },
    onError: (e) => setError(e.message),
  });

  const disconnect = trpc.connections.disconnect.useMutation({
    onSuccess: () => void utils.connections.list.invalidate(),
  });

  return (
    <div className="flex flex-col gap-12">
      <section className="flex flex-col gap-4">
        <h2 className="eyebrow border-b border-line/80 pb-3">Chess.com</h2>
        <p className="text-graphite text-sm leading-relaxed font-serif">
          Link by username (read-only public data; no password or token
          stored).
        </p>
        <form
          className="flex max-w-md gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            const value = username.trim();
            if (value) addChessCom.mutate({ username: value });
          }}
        >
          <Input
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            placeholder="Chess.com username"
            aria-label="Chess.com username"
          />
          <Button type="submit" disabled={addChessCom.isPending}>
            {addChessCom.isPending ? "Checking…" : "Add"}
          </Button>
        </form>
        {error && (
          <p className="text-clay text-sm font-mono" role="alert">
            {error}
          </p>
        )}
      </section>

      <section className="flex flex-col gap-4">
        <h2 className="eyebrow border-b border-line/80 pb-3">
          Connected accounts
        </h2>
        {list.isLoading ? (
          <p className="text-graphite font-mono text-sm">Loading…</p>
        ) : list.data && list.data.length > 0 ? (
          <ul className="flex flex-col gap-2">
            {list.data.map((conn) => (
              <li
                key={conn.id}
                className="bg-card flex items-center justify-between gap-4 rounded-lg border p-4 shadow-sheet"
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
                  onClick={() => disconnect.mutate({ id: conn.id })}
                >
                  Disconnect
                </Button>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-graphite text-sm font-serif">
            No accounts connected yet.
          </p>
        )}
      </section>
    </div>
  );
}
