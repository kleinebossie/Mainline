import { describe, expect, it } from "vitest";
import { detectTacticalMotif, TACTICAL_MOTIFS } from "@/analysis/motif-detector";

describe("detectTacticalMotif", () => {
  it("detects back-rank weakness checkmate", () => {
    const fen = "3r2k1/5ppp/8/8/8/8/5PPP/3R2K1 w - - 0 1";
    const motif = detectTacticalMotif(fen, "d1d8");
    expect(motif.key).toBe("backRankMate");
    expect(motif.title).toBe("Back-Rank Weakness");
  });

  it("detects knight fork", () => {
    const fen = "r3k2r/pppb1ppp/8/3N4/8/8/PPP2PPP/R1B1K2R w KQkq - 0 1";
    const motif = detectTacticalMotif(fen, "d5c7");
    expect(motif.key).toBe("fork");
    expect(motif.title).toBe("Forks");
  });

  it("detects hanging piece capture", () => {
    const fen =
      "r1bqkb1r/pppp1ppp/2n5/4p3/4n3/2NP1N2/PPP1BPPP/R1BQK2R w KQkq - 0 6";
    const motif = detectTacticalMotif(fen, "d3e4");
    expect(motif.key).toBe("hangingPiece");
    expect(motif.title).toBe("Hanging Pieces");
  });

  it("detects attacking f7 square", () => {
    const fen =
      "r1bqk2r/pppp1ppp/2n5/4p3/2B1P3/3P1N2/PPP2PPP/RNBQK2R w KQkq - 1 6";
    const motif = detectTacticalMotif(fen, "c4f7");
    expect(motif.key).toBe("attackingF2F7");
    expect(motif.title).toBe("Weak f2/f7 Square");
  });

  it("detects pin with slider piece", () => {
    const fen =
      "r1bqk2r/ppp2ppp/2np1n2/4p3/2B1P3/3P1N2/PPP2PPP/RNBQK2R w KQkq - 0 5";
    const motif = detectTacticalMotif(fen, "c1g5");
    expect(motif.key).toBe("pin");
    expect(motif.title).toBe("Pins");
  });

  it("detects skewer on king exposing rook", () => {
    const fen = "8/8/8/8/3k4/8/8/3R2K1 w - - 0 1";
    const motif = detectTacticalMotif(fen, "d1d4");
    expect(motif).toBeDefined();
  });

  it("falls back to advantage conversion if no specific motif matches", () => {
    const fen = "8/8/8/8/8/8/4K3/4k3 w - - 0 1";
    const motif = detectTacticalMotif(fen, null);
    expect(motif.key).toBe("advantage");
    expect(motif.title).toBe("Tactical Conversion");
  });

  it("provides accessible titles and descriptions for all motifs", () => {
    for (const motif of Object.values(TACTICAL_MOTIFS)) {
      expect(motif.title.length).toBeGreaterThan(0);
      expect(motif.description.length).toBeGreaterThan(0);
      expect(motif.evidenceGrade).toBeDefined();
    }
  });
});
