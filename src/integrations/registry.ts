// The single place that maps a platform id → its adapter (BUILD.md §6). Everything
// else (auth events, tRPC routers, connection helpers) goes through here so the set
// of platforms is declared once.

import type { Platform, PlatformAdapter } from "@/integrations/adapter";
import { chessComAdapter } from "@/integrations/chesscom/adapter";
import { lichessAdapter } from "@/integrations/lichess/adapter";

const ADAPTERS: Record<Platform, PlatformAdapter> = {
  lichess: lichessAdapter,
  chesscom: chessComAdapter,
};

export function getAdapter(platform: Platform): PlatformAdapter {
  return ADAPTERS[platform];
}
