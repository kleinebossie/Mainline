import { describe, expect, it } from "vitest";

import { chessComAdapter } from "@/integrations/chesscom/adapter";
import { lichessAdapter } from "@/integrations/lichess/adapter";
import { getAdapter } from "@/integrations/registry";

describe("integrations/registry", () => {
  it("returns lichess adapter for lichess platform", () => {
    expect(getAdapter("lichess")).toBe(lichessAdapter);
  });

  it("returns chess.com adapter for chesscom platform", () => {
    expect(getAdapter("chesscom")).toBe(chessComAdapter);
  });
});
