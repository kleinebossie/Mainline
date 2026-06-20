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
    <div className="flex flex-col gap-8">
      <section className="flex flex-col gap-3">
        <div>
          <h2 className="font-semibold">Chess.com</h2>
          <p className="text-muted-foreground text-sm">
            Link by username (read-only public data — no password or token
            stored).
          </p>
        </div>
        <form
          className="flex gap-2"
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
          <p className="text-destructive text-sm" role="alert">
            {error}
          </p>
        )}
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="font-semibold">Connected accounts</h2>
        {list.isLoading ? (
          <p className="text-muted-foreground text-sm">Loading…</p>
        ) : list.data && list.data.length > 0 ? (
          <ul className="flex flex-col gap-2">
            {list.data.map((conn) => (
              <li
                key={conn.id}
                className="flex items-center justify-between rounded-md border p-3"
              >
                <span className="text-sm">
                  <span className="font-medium">
                    {PLATFORM_LABEL[conn.platform] ?? conn.platform}
                  </span>{" "}
                  · {conn.externalUsername}
                  {conn.status !== "active" && (
                    <span className="text-muted-foreground">
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
          <p className="text-muted-foreground text-sm">
            No accounts connected yet.
          </p>
        )}
      </section>
    </div>
  );
}
