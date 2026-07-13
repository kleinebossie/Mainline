import type { inferRouterOutputs } from "@trpc/server";

import type { AppRouter } from "@/server/routers/_app";

export type GameAnalysisData =
  inferRouterOutputs<AppRouter>["analysis"]["session"];
export type GameAnalysisSession = GameAnalysisData["session"];
export type GameAnalysisGame = GameAnalysisData["game"];
export type GameAnalysisRationales = GameAnalysisData["rationales"];
export type GameAnalysisRationale =
  GameAnalysisRationales[keyof GameAnalysisRationales];
