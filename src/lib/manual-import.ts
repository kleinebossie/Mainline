import { z } from "zod";

export const MANUAL_PGN_MAX_BATCH_BYTES = 512 * 1024;
export const MANUAL_PGN_MAX_GAMES = 25;
export const MANUAL_PGN_MAX_GAME_BYTES = 128 * 1024;
export const MANUAL_PGN_MAX_PLIES = 600;
/** Storage safeguard for the closed-beta manual library. This is not methodology. */
export const MANUAL_PGN_MAX_GAMES_PER_USER = 500;

export const MANUAL_GAME_RESULTS = ["win", "loss", "draw"] as const;

const utf8Encoder = new TextEncoder();

export const manualPgnTextSchema = z
  .string()
  .min(1, "Paste PGN text or choose a PGN file.")
  .max(MANUAL_PGN_MAX_BATCH_BYTES, "The PGN file is too large.")
  .refine(
    (value) =>
      utf8Encoder.encode(value).byteLength <= MANUAL_PGN_MAX_BATCH_BYTES,
    `The PGN file must be ${MANUAL_PGN_MAX_BATCH_BYTES / 1024} KiB or smaller.`,
  );

const optionalText = (max: number) =>
  z.string().trim().min(1).max(max).optional();

export const manualGameImportInputSchema = z
  .object({
    index: z
      .number()
      .int()
      .min(0)
      .max(MANUAL_PGN_MAX_GAMES - 1),
    color: z.enum(["w", "b"]).optional(),
    playedDate: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/)
      .optional(),
    timeControl: optionalText(64),
    result: z.enum(MANUAL_GAME_RESULTS).optional(),
    userRating: z.number().int().min(0).max(9_999).optional(),
    opponentRating: z.number().int().min(0).max(9_999).optional(),
    event: optionalText(200),
  })
  .strict();

export const manualPgnImportInputSchema = z
  .object({
    pgnText: manualPgnTextSchema,
    games: z.array(manualGameImportInputSchema).max(MANUAL_PGN_MAX_GAMES),
  })
  .strict()
  .superRefine((input, ctx) => {
    const seen = new Set<number>();
    for (const [position, game] of input.games.entries()) {
      if (seen.has(game.index)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Each PGN game may have only one metadata entry.",
          path: ["games", position, "index"],
        });
      }
      seen.add(game.index);
    }
  });

export type ManualGameImportInput = z.infer<typeof manualGameImportInputSchema>;
export type ManualPgnImportInput = z.infer<typeof manualPgnImportInputSchema>;
