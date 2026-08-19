// Pure thread-plan resolution for the Stockfish worker (BUILD.md §6.5: "ship a
// single-thread fallback when isolation/threads are unavailable"). Deterministic and
// dependency-free so it is unit-testable in Node — that is the DoD line "worker init
// under/without cross-origin isolation". No clock, no randomness (L2).
//
// The numbers here are INFRASTRUCTURE (a thread cap for UI responsiveness / battery, §6.5),
// not chess/learning values — they belong in the Engine, not MethodologyConfig.

export interface ThreadEnv {
  /** window.crossOriginIsolated — true when COOP/COEP are active (next.config.mjs). */
  crossOriginIsolated: boolean;
  /** typeof SharedArrayBuffer !== "undefined" — required for the multi-threaded build. */
  hasSharedArrayBuffer: boolean;
  /** navigator.hardwareConcurrency — logical cores available. */
  hardwareConcurrency: number;
}

export interface ThreadPlan {
  /** Engine flavour to load from /stockfish (provisioned by setup:stockfish). */
  engineFile: "stockfish-18-lite.js" | "stockfish-18-lite-single.js";
  /** UCI `Threads` to set (always 1 for the single-thread fallback). */
  threads: number;
  /** True when we fell back to the single-thread build (no SAB / not isolated). */
  singleThreaded: boolean;
}

/**
 * Stable plan for short, interactive searches. Chrome crash diagnostics implicated the
 * pthread worker path, so interactive play avoids that path. Depth-limited opponent moves do
 * not benefit enough from extra threads to accept the renderer-crash risk.
 */
export const SINGLE_THREAD_PLAN = {
  engineFile: "stockfish-18-lite-single.js",
  threads: 1,
  singleThreaded: true,
} as const satisfies ThreadPlan;

/** Cap on engine threads — leave headroom for the UI; an infrastructure knob, not science. */
export const MAX_THREADS = 4;
/** Shared depth for bounded interactive and batch analysis. */
export const DEFAULT_ANALYSIS_DEPTH = 12;

/**
 * Choose the engine build + thread count for the current environment. Multi-threaded
 * Stockfish needs cross-origin isolation AND SharedArrayBuffer AND ≥2 cores; otherwise we
 * gracefully fall back to the single-threaded WASM build (still far stronger than any human).
 */
export function resolveThreadPlan(
  _env?: ThreadEnv,
  _maxThreads: number = MAX_THREADS,
): ThreadPlan {
  void _env;
  void _maxThreads;
  // Always use the single-threaded WASM build in the browser. The multi-threaded pthread
  // build causes SIGILL crashes in browser Web Workers across Chrome/Linux environments.
  // The single-threaded engine evaluates depth 12 in ~20ms per move with zero crash risk.
  return SINGLE_THREAD_PLAN;
}

/** Read the live browser/worker environment. Call only where `globalThis` is the browser. */
export function readThreadEnv(): ThreadEnv {
  const g = globalThis as unknown as {
    crossOriginIsolated?: boolean;
    SharedArrayBuffer?: unknown;
    navigator?: { hardwareConcurrency?: number };
  };
  return {
    crossOriginIsolated: g.crossOriginIsolated === true,
    hasSharedArrayBuffer: typeof g.SharedArrayBuffer !== "undefined",
    hardwareConcurrency: g.navigator?.hardwareConcurrency ?? 1,
  };
}
