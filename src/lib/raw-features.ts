// Shared boundary between analysis and methodology. These strict schemas contain raw
// measurements only; interpretation belongs in methodology.
//
// Centipawn values use the mover's perspective. `cpLoss` is
// `max(0, cpBefore - cpAfter)`. Mate scores use a bounded centipawn value.

import { z } from "zod";

export const MAX_ANALYSIS_PLIES = 600;
export const MAX_ANALYSIS_BLUNDERS = 80;
export const MAX_FEN_LENGTH = 128;

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
    fen: z.string().min(1).max(MAX_FEN_LENGTH),
    cpLoss: finite,
    motifTags: z.array(z.string().min(1).max(64)).max(32).optional(),
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
    moveEvals: z.array(moveEvalSchema).max(MAX_ANALYSIS_PLIES),
    blunders: z.array(blunderSchema).max(MAX_ANALYSIS_BLUNDERS),
    errorCounts: errorCountsSchema,
    clock: z.array(clockEntrySchema).max(MAX_ANALYSIS_PLIES).optional(),
    conversion: conversionSchema.optional(),
    openingDeviation: openingDeviationSchema.optional(),
  })
  .strict();

export type RawGameFeatures = z.infer<typeof rawGameFeaturesSchema>;
export type MoveEval = z.infer<typeof moveEvalSchema>;
export type Blunder = z.infer<typeof blunderSchema>;
export type ClockEntry = z.infer<typeof clockEntrySchema>;
