"use client";

// Client-side analysis runner (BUILD.md M5 · §6.5, onboarding step 4). Runs Stockfish in
// the browser over the user's unanalysed games and posts RAW features back — zero server
// compute (§12). Display is deliberately judgement-free (L1): these are measurements, not
// advice; interpretation ("why this is a weakness") arrives with the program engine (M6).

import { useState } from "react";

import { trpc } from "@/lib/trpc/react";
import { Button } from "@/components/ui/button";
import { ErrorNotice } from "@/components/ui/error-notice";
import { StatusMessage } from "@/components/ui/status-message";
import { errorMessage } from "@/lib/error-presentation";

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
      setError(
        errorMessage(
          e,
          "Analysis stopped. Completed games are saved. Try the remaining queue again.",
        ),
      );
      setStatus("error");
    }
  }

  const counts = summary.data;
  const pendingCount = pending.data?.length ?? 0;

  return (
    <section className="flex flex-col gap-4">
      <div className="flex items-center justify-between gap-4 border-b border-line/80 pb-3">
        <h2 className="eyebrow">Game analysis</h2>
        <Button
          type="button"
          size="sm"
          disabled={
            pending.isLoading || status === "running" || pendingCount === 0
          }
          onClick={() => void run()}
        >
          {pending.isLoading
            ? "Checking games…"
            : status === "running"
              ? `Analysing ${progress.done}/${progress.total}…`
              : pendingCount > 0
                ? `Analyse ${pendingCount} game${pendingCount === 1 ? "" : "s"}`
                : "Up to date"}
        </Button>
      </div>

      <p className="text-graphite text-sm leading-relaxed font-serif">
        Runs entirely in your browser (Stockfish WASM). Your games never leave
        your device for analysis. These are raw engine measurements only; the
        program engine turns them into training in a later step.
      </p>

      {counts ? (
        <p className="text-ink text-sm font-serif">
          Analysed{" "}
          <span className="font-mono text-xs font-semibold tabular-nums">
            {counts.analysed}/{counts.total}
          </span>{" "}
          imported games
          {engineLabel ? (
            <span className="text-graphite font-mono text-xs">
              {" "}
              · {engineLabel}
            </span>
          ) : null}
          .
        </p>
      ) : null}

      {(pending.error || summary.error) && (
        <ErrorNotice
          error={pending.error ?? summary.error}
          heading="Analysis queue unavailable"
          message="Mainline could not check which games still need analysis. Try the queue again."
          onRetry={() => {
            void pending.refetch();
            void summary.refetch();
          }}
          retrying={pending.isFetching || summary.isFetching}
          retryLabel="Reload queue"
        />
      )}

      {status === "error" && error ? (
        <ErrorNotice
          heading="Analysis stopped"
          message={error}
          onRetry={() => void run()}
          retryLabel="Analyse remaining games"
        />
      ) : null}

      {status === "done" && (
        <StatusMessage tone="success">
          Analysis complete. Your next program can use these game signals.
        </StatusMessage>
      )}

      {pendingCount === 0 && counts && counts.total === 0 ? (
        <StatusMessage tone="neutral" heading="No games to analyse">
          Import games first, then run analysis here.
        </StatusMessage>
      ) : null}
    </section>
  );
}
