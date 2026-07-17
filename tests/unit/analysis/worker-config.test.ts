import { describe, it, expect } from "vitest";
import {
  resolveThreadPlan,
  MAX_THREADS,
  SINGLE_THREAD_PLAN,
} from "@/analysis/worker-config";

describe("resolveThreadPlan", () => {
  it("exposes a stable single-thread plan for interactive searches", () => {
    expect(SINGLE_THREAD_PLAN).toEqual({
      engineFile: "stockfish-18-lite-single.js",
      singleThreaded: true,
      threads: 1,
    });
  });

  it("uses multi-threaded lite engine when isolated, SAB present, and cores >= 2", () => {
    const plan = resolveThreadPlan({
      crossOriginIsolated: true,
      hasSharedArrayBuffer: true,
      hardwareConcurrency: 8,
    });
    expect(plan).toEqual({
      engineFile: "stockfish-18-lite.js",
      singleThreaded: false,
      threads: Math.min(MAX_THREADS, 7),
    });
  });

  it("falls back to single-threaded if not crossOriginIsolated", () => {
    const plan = resolveThreadPlan({
      crossOriginIsolated: false,
      hasSharedArrayBuffer: true,
      hardwareConcurrency: 8,
    });
    expect(plan).toEqual({
      engineFile: "stockfish-18-lite-single.js",
      singleThreaded: true,
      threads: 1,
    });
  });

  it("falls back to single-threaded if no SharedArrayBuffer", () => {
    const plan = resolveThreadPlan({
      crossOriginIsolated: true,
      hasSharedArrayBuffer: false,
      hardwareConcurrency: 8,
    });
    expect(plan).toEqual({
      engineFile: "stockfish-18-lite-single.js",
      singleThreaded: true,
      threads: 1,
    });
  });

  it("falls back to single-threaded if hardwareConcurrency < 2", () => {
    const plan = resolveThreadPlan({
      crossOriginIsolated: true,
      hasSharedArrayBuffer: true,
      hardwareConcurrency: 1,
    });
    expect(plan).toEqual({
      engineFile: "stockfish-18-lite-single.js",
      singleThreaded: true,
      threads: 1,
    });
  });
});
