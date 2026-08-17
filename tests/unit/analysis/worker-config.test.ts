import { describe, it, expect } from "vitest";
import {
  DEFAULT_ANALYSIS_DEPTH,
  resolveThreadPlan,
  SINGLE_THREAD_PLAN,
} from "@/analysis/worker-config";

describe("resolveThreadPlan", () => {
  it("shares one bounded depth across analysis callers", () => {
    expect(DEFAULT_ANALYSIS_DEPTH).toBe(12);
  });

  it("exposes a stable single-thread plan for interactive searches", () => {
    expect(SINGLE_THREAD_PLAN).toEqual({
      engineFile: "stockfish-18-lite-single.js",
      singleThreaded: true,
      threads: 1,
    });
  });

  it("resolves to SINGLE_THREAD_PLAN across environments to prevent SIGILL crashes", () => {
    const plan = resolveThreadPlan({
      crossOriginIsolated: true,
      hasSharedArrayBuffer: true,
      hardwareConcurrency: 8,
    });
    expect(plan).toEqual(SINGLE_THREAD_PLAN);
  });

  it("resolves to single-threaded if not crossOriginIsolated", () => {
    const plan = resolveThreadPlan({
      crossOriginIsolated: false,
      hasSharedArrayBuffer: true,
      hardwareConcurrency: 8,
    });
    expect(plan).toEqual(SINGLE_THREAD_PLAN);
  });

  it("resolves to single-threaded if no SharedArrayBuffer", () => {
    const plan = resolveThreadPlan({
      crossOriginIsolated: true,
      hasSharedArrayBuffer: false,
      hardwareConcurrency: 8,
    });
    expect(plan).toEqual(SINGLE_THREAD_PLAN);
  });

  it("resolves to single-threaded if hardwareConcurrency < 2", () => {
    const plan = resolveThreadPlan({
      crossOriginIsolated: true,
      hasSharedArrayBuffer: true,
      hardwareConcurrency: 1,
    });
    expect(plan).toEqual(SINGLE_THREAD_PLAN);
  });
});
