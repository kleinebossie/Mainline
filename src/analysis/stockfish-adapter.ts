// StockfishAnalysisEngine — the browser implementation of AnalysisEngineAdapter (§6.5).
//
// It runs entirely CLIENT-SIDE (zero server compute, §12): the vendored single-file
// engine (`/stockfish/stockfish-18-lite[-single].js`, provisioned by setup:stockfish) IS
// a Web Worker, so we spawn it directly and speak UCI to it. Loading it same-origin from
// public/ keeps it within the COOP/COEP cross-origin isolation the multi-thread build
// needs (next.config.mjs). The thread/fallback choice is the pure resolveThreadPlan.
//
// DEVIATION FROM §4 (documented): BUILD.md §4 sketches a separate `stockfish.worker.ts`
// host. The nmrugg build already ships the engine AS the worker, so a hand-written wrapper
// worker would only add bundler risk (Next worker bundling) for no behavioural gain. The
// "Web Worker host" role is therefore the vendored engine worker + this adapter's UCI
// bridge; UCI line-parsing (trivial string work) runs on the main thread, the search runs
// in the worker. All M5 DoD items (client-side, raw-only, graceful fallback, zero server
// compute) hold.
//
// Emits RAW features only (L1) — it delegates all feature math to the pure extractFeatures.

import { Chess } from "chess.js";

import type {
  AnalysisEngineAdapter,
  AnalysisLimit,
  AnalyzeGameContext,
  EvalResult,
} from "@/analysis/engine-adapter";
import { extractFeatures, type PositionEval } from "@/analysis/features";
import type { RawGameFeatures } from "@/lib/raw-features";
import {
  readThreadEnv,
  resolveThreadPlan,
  type ThreadPlan,
} from "@/analysis/worker-config";

// Infrastructure bounds (§6.5: bound depth/movetime; keep the UI responsive). Not science.
const ENGINE_BASE = "/stockfish";
const DEFAULT_DEPTH = 12;
const DEFAULT_HASH_MB = 16;
const UCI_TIMEOUT_MS = 30_000;

type Line = string;
type Listener = (line: Line) => void;

export class StockfishAnalysisEngine implements AnalysisEngineAdapter {
  private worker: Worker | null = null;
  private readonly plan: ThreadPlan;
  private readonly listeners = new Set<Listener>();
  private ready = false;

  constructor(plan?: ThreadPlan) {
    this.plan = plan ?? resolveThreadPlan(readThreadEnv());
  }

  /** Provenance string persisted on AnalysisResult.engineVersion. */
  get engineVersion(): string {
    return this.plan.singleThreaded
      ? "stockfish-18-lite-single"
      : "stockfish-18-lite";
  }

  get singleThreaded(): boolean {
    return this.plan.singleThreaded;
  }

  async init(
    opts: { threads: number; hashMb: number } = {
      threads: this.plan.threads,
      hashMb: DEFAULT_HASH_MB,
    },
  ): Promise<void> {
    if (this.worker) return;
    const worker = new Worker(`${ENGINE_BASE}/${this.plan.engineFile}`);
    this.worker = worker;
    worker.onmessage = (e: MessageEvent) => {
      // nmrugg builds post the UCI line as a string; be defensive about {data} shapes.
      const line: string =
        typeof e.data === "string"
          ? e.data
          : String((e.data as { data?: unknown })?.data ?? e.data ?? "");
      for (const l of [...this.listeners]) l(line);
    };

    await this.waitFor("uci", (l) => l.startsWith("uciok"));
    if (!this.plan.singleThreaded) {
      this.post(`setoption name Threads value ${Math.max(1, opts.threads)}`);
    }
    this.post(`setoption name Hash value ${Math.max(1, opts.hashMb)}`);
    await this.waitFor("isready", (l) => l.startsWith("readyok"));
    this.ready = true;
  }

  async analyzePosition(
    fen: string,
    limit: AnalysisLimit = {},
  ): Promise<EvalResult> {
    await this.ensureReady();
    this.post(`position fen ${fen}`);

    let cp: number | null = null;
    let mate: number | null = null;
    let depth = 0;
    const go = limit.movetimeMs
      ? `go movetime ${limit.movetimeMs}`
      : `go depth ${limit.depth ?? DEFAULT_DEPTH}`;

    return this.run(go, (line, resolve) => {
      if (line.startsWith("info") && line.includes(" score ")) {
        const d = line.match(/ depth (\d+)/);
        if (d) depth = Number(d[1]);
        const m = line.match(/ score mate (-?\d+)/);
        const c = line.match(/ score cp (-?\d+)/);
        if (m) {
          mate = Number(m[1]);
          cp = null;
        } else if (c) {
          cp = Number(c[1]);
          mate = null;
        }
      } else if (line.startsWith("bestmove")) {
        const bm = line.match(/^bestmove (\S+)/);
        resolve({
          // scoreCp stays a number for consumers; mate carries the real signal when set.
          scoreCp: cp ?? 0,
          mate,
          bestMove: bm ? bm[1] : undefined,
          depth,
        });
      }
    });
  }

  async analyzeGame(
    pgn: string,
    limit: AnalysisLimit = {},
    ctx: AnalyzeGameContext,
  ): Promise<RawGameFeatures> {
    await this.ensureReady();
    const chess = new Chess();
    chess.loadPgn(pgn);
    const moves = chess.history({ verbose: true });

    // Positions p0..pN, aligned to what extractFeatures expects.
    const fens: string[] = [moves.length > 0 ? moves[0]!.before : chess.fen()];
    for (const m of moves) fens.push(m.after);

    const evals: PositionEval[] = [];
    for (const fen of fens) {
      const probe = new Chess(fen);
      if (probe.isGameOver()) {
        // Don't query a terminal position (engine returns "bestmove (none)"): synthesize.
        evals.push(
          probe.isCheckmate() ? { cp: null, mate: 0 } : { cp: 0, mate: null },
        );
        continue;
      }
      const r = await this.analyzePosition(fen, limit);
      evals.push({ cp: r.mate !== null ? null : r.scoreCp, mate: r.mate });
    }

    return extractFeatures({ pgn, evals, userColor: ctx.userColor });
  }

  dispose(): void {
    this.worker?.terminate();
    this.worker = null;
    this.listeners.clear();
    this.ready = false;
  }

  // --- UCI plumbing ---

  private post(cmd: string): void {
    this.worker?.postMessage(cmd);
  }

  private async ensureReady(): Promise<void> {
    if (!this.ready) await this.init();
  }

  /** Send a command and resolve once `done(line)` is true (with a hard timeout). */
  private waitFor(cmd: string, done: (line: Line) => boolean): Promise<void> {
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        this.listeners.delete(listener);
        reject(new Error(`Stockfish timed out waiting after "${cmd}"`));
      }, UCI_TIMEOUT_MS);
      const listener: Listener = (line) => {
        if (!done(line)) return;
        clearTimeout(timer);
        this.listeners.delete(listener);
        resolve();
      };
      this.listeners.add(listener);
      this.post(cmd);
    });
  }

  /** Send a `go` command and drive a per-line handler until it resolves a value. */
  private run<T>(
    cmd: string,
    handle: (line: Line, resolve: (value: T) => void) => void,
  ): Promise<T> {
    return new Promise<T>((resolve, reject) => {
      const timer = setTimeout(() => {
        this.listeners.delete(listener);
        reject(new Error(`Stockfish timed out during "${cmd}"`));
      }, UCI_TIMEOUT_MS);
      const settle = (value: T) => {
        clearTimeout(timer);
        this.listeners.delete(listener);
        resolve(value);
      };
      const listener: Listener = (line) => handle(line, settle);
      this.listeners.add(listener);
      this.post(cmd);
    });
  }
}
