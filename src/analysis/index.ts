// Public surface of the analysis module (BUILD.md §4). Emits RAW features only (L1) —
// interpretation is methodology (Seam 3). The pure core (extractFeatures, resolveThreadPlan)
// is golden-tested in Node; the StockfishAnalysisEngine runs the real engine in the browser.

export type {
  AnalysisEngineAdapter,
  AnalysisLimit,
  AnalyzeGameContext,
  EvalLine,
  EvalResult,
  Color,
} from "@/analysis/engine-adapter";

export {
  extractFeatures,
  type ExtractFeaturesInput,
  type PositionEval,
} from "@/analysis/features";

export {
  resolveThreadPlan,
  readThreadEnv,
  MAX_THREADS,
  SINGLE_THREAD_PLAN,
  type ThreadEnv,
  type ThreadPlan,
} from "@/analysis/worker-config";

export { StockfishAnalysisEngine } from "@/analysis/stockfish-adapter";
