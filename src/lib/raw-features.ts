// Shared boundary between analysis and methodology. These strict schemas contain raw
// measurements only; interpretation belongs in methodology.
//
// Centipawn values use the mover's perspective. `cpLoss` is
// `max(0, cpBefore - cpAfter)`. Mate scores use a bounded centipawn value.

import { z } from "zod";

const finite = z.number().finite();
const intPly = z.number().int();

const winProbUnit = z.number().min(0).max(1);

const moveEvalSchema = z
  .object({
    ply: intPly,
    cpBefore: finite,
    cpAfter: finite,
    cpLoss: finite,
    // Optional for compatibility with analyses saved before win probability was recorded.
    winProbBefore: winProbUnit.optional(),
    winProbAfter: winProbUnit.optional(),
    winProbDrop: winProbUnit.optional(),
  })
  .strict();

const blunderSchema = z
  .object({
    ply: intPly,
    fen: z.string(),
    cpLoss: finite,
    motifTags: z.array(z.string()).optional(),
  })
  .strict();

const errorCountsSchema = z
  .object({
    inaccuracies: intPly,
    mistakes: intPly,
    blunders: intPly,
    grossBlunders: intPly,
  })
  .strict();

const clockEntrySchema = z
  .object({
    ply: intPly,
    remainingMs: finite,
    spentMs: finite,
  })
  .strict();

const conversionSchema = z
  .object({
    reachedWinningPlus: z.boolean(),
    converted: z.boolean(),
    reachedLosingMinus: z.boolean(),
    saved: z.boolean(),
  })
  .strict();

const openingDeviationSchema = z
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
export type ClockEntry = z.infer<typeof clockEntrySchema>;
