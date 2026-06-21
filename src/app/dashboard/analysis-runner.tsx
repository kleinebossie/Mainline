"use client";

// Client-side analysis runner (BUILD.md M5 · §6.5, onboarding step 4). Runs Stockfish in
// the browser over the user's unanalysed games and posts RAW features back — zero server
// compute (§12). Display is deliberately judgement-free (L1): these are measurements, not
// advice; interpretation ("why this is a weakness") arrives with the program engine (M6).

import { useState } from "react";

import { trpc } from "@/lib/trpc/react";
import { Button } from "@/components/ui/button";

// Bounded analysis depth (infrastructure: responsive UI / sane battery, §6.5 — not science).
const ANALYSIS_DEPTH = 12;

type Status = "idle" | "running" | "done" | "error";

export function AnalysisRunner() {
  const utils = trpc.useUtils();
  const pending = trpc.analysis.pending.useQuery();
  const summary = trpc.analysis.summary.useQuery();
  const save = trpc.analysis.save.useMutation();

  const [status, setStatus] = useState<Status>("idle");
  const [progress, setProgress] = useState<{ done: number; total: number }>({
    done: 0,
    total: 0,
  });
  const [engineLabel, setEngineLabel] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function run() {
    const games = pending.data ?? [];
    if (games.length === 0) return;
    setStatus("running");
    setError(null);
    setProgress({ done: 0, total: games.length });

    try {
      // Lazy-load the engine: keeps the ~7 MB WASM off the initial bundle and off the server.
      const { StockfishAnalysisEngine } = await import("@/analysis");
      const engine = new StockfishAnalysisEngine();
      await engine.init();
      setEngineLabel(
        `${engine.engineVersion}${engine.singleThreaded ? " (single-thread fallback)" : ""}`,
      );

      try {
        let done = 0;
        for (const game of games) {
          const features = await engine.analyzeGame(
            game.pgn,
            { depth: ANALYSIS_DEPTH },
            { userColor: game.color === "b" ? "b" : "w" },
          );
          await save.mutateAsync({
            gameId: game.id,
            engineVersion: engine.engineVersion,
            depth: ANALYSIS_DEPTH,
            rawFeatures: features,
          });
          done += 1;
          setProgress({ done, total: games.length });
        }
      } finally {
        engine.dispose();
      }

      await Promise.all([
        utils.analysis.pending.invalidate(),
        utils.analysis.summary.invalidate(),
      ]);
      setStatus("done");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Analysis failed.");
      setStatus("error");
    }
  }

  const counts = summary.data;
  const pendingCount = pending.data?.length ?? 0;

  return (
    <section className="flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <h2 className="font-semibold">Game analysis</h2>
        <Button
          type="button"
          size="sm"
          disabled={status === "running" || pendingCount === 0}
          onClick={() => void run()}
        >
          {status === "running"
            ? `Analysing ${progress.done}/${progress.total}…`
            : pendingCount > 0
              ? `Analyse ${pendingCount} game${pendingCount === 1 ? "" : "s"}`
              : "Up to date"}
        </Button>
      </div>

      <p className="text-muted-foreground text-sm">
        Runs entirely in your browser (Stockfish WASM) — your games never leave
        your device for analysis. These are raw engine measurements only; the
        program engine turns them into training in a later step.
      </p>

      {counts ? (
        <p className="text-sm">
          Analysed{" "}
          <span className="font-medium">
            {counts.analysed}/{counts.total}
          </span>{" "}
          imported games
          {engineLabel ? (
            <span className="text-muted-foreground"> · {engineLabel}</span>
          ) : null}
          .
        </p>
      ) : null}

      {status === "error" && error ? (
        <p className="text-destructive text-sm" role="alert">
          {error}
        </p>
      ) : null}

      {pendingCount === 0 && counts && counts.total === 0 ? (
        <p className="text-muted-foreground text-sm">
          No games to analyse yet. Import games first, then run analysis.
        </p>
      ) : null}
    </section>
  );
}
