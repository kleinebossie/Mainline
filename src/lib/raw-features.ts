// RawGameFeatures — the contract for one game's analysis output (BUILD.md §5.2).
//
// This type lives in lib/ (not analysis/ or methodology/) on purpose: it is the shared
// boundary shape between the PRODUCER (src/analysis — Stockfish, M5) and the future
// CONSUMER (the Seam 3 methodology fn interpretGameFeatures, M6). Putting it here lets
// both import it without crossing the engine⟷methodology import direction (BUILD.md §4).
//
// L1 — RAW MEASUREMENTS ONLY. Nothing here encodes "good/bad", a weakness, a grade, or a
// recommendation; interpretation is methodology (Seam 3). The schemas below are `.strict()`,
// so an accidentally-added interpreted field (e.g. `weakness`, `evidenceGrade`) FAILS to
// parse — the L1 boundary is enforced structurally, at runtime, every time a result is
// persisted (and asserted by tests/guards/raw-features.test.ts).
//
// Sign convention (documented once, used everywhere): centipawn numbers are from the
// MOVER's perspective. For a played move, `cpBefore` is the eval with the mover to play
// and `cpAfter` is the eval after the move from the mover's perspective, so
// `cpLoss = max(0, cpBefore − cpAfter)` is how much the move gave away. Mate scores are
// mapped to a large bounded centipawn value (a measurement convention, see analysis/).

import { z } from "zod";

const finite = z.number().finite();
const intPly = z.number().int();

export const moveEvalSchema = z
  .object({
    ply: intPly,
    cpBefore: finite,
    cpAfter: finite,
    cpLoss: finite,
  })
  .strict();

export const blunderSchema = z
  .object({
    ply: intPly,
    fen: z.string(),
    cpLoss: finite,
    // Raw motif tags (e.g. cross-referenced from the puzzle DB); never interpreted here.
    motifTags: z.array(z.string()).optional(),
  })
  .strict();

export const errorCountsSchema = z
  .object({
    inaccuracies: intPly,
    mistakes: intPly,
    blunders: intPly,
    grossBlunders: intPly,
  })
  .strict();

export const clockEntrySchema = z
  .object({
    ply: intPly,
    remainingMs: finite,
    spentMs: finite,
  })
  .strict();

export const conversionSchema = z
  .object({
    reachedWinningPlus: z.boolean(),
    converted: z.boolean(),
    reachedLosingMinus: z.boolean(),
    saved: z.boolean(),
  })
  .strict();

export const openingDeviationSchema = z
  .object({
    firstDeviationPly: intPly,
    earlyCpl: finite,
  })
  .strict();

export const rawGameFeaturesSchema = z
  .object({
    acplOverall: finite,
    acplByPhase: z
      .object({ opening: finite, middlegame: finite, endgame: finite })
      .strict(),
    phaseBoundaries: z
      .object({ openingEndsPly: intPly, endgameStartsPly: intPly })
      .strict(),
    moveEvals: z.array(moveEvalSchema),
    blunders: z.array(blunderSchema),
    errorCounts: errorCountsSchema,
    clock: z.array(clockEntrySchema).optional(),
    conversion: conversionSchema.optional(),
    openingDeviation: openingDeviationSchema.optional(),
  })
  .strict();

export type RawGameFeatures = z.infer<typeof rawGameFeaturesSchema>;
export type MoveEval = z.infer<typeof moveEvalSchema>;
export type Blunder = z.infer<typeof blunderSchema>;
export type ErrorCounts = z.infer<typeof errorCountsSchema>;
export type ClockEntry = z.infer<typeof clockEntrySchema>;
export type Conversion = z.infer<typeof conversionSchema>;
export type OpeningDeviation = z.infer<typeof openingDeviationSchema>;
