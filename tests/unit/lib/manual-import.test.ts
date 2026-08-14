import { describe, expect, it } from "vitest";

import {
  MANUAL_PGN_MAX_BATCH_BYTES,
  manualGameImportInputSchema,
  manualPgnImportInputSchema,
  manualPgnTextSchema,
} from "@/lib/manual-import";

describe("manual-import schemas", () => {
  describe("manualPgnTextSchema", () => {
    it("accepts valid PGN text within size limit", () => {
      const valid = "1. e4 e5 2. Nf3 Nc6 *";
      expect(manualPgnTextSchema.safeParse(valid).success).toBe(true);
    });

    it("rejects empty PGN text", () => {
      expect(manualPgnTextSchema.safeParse("").success).toBe(false);
    });

    it("rejects PGN exceeding maximum byte size", () => {
      const oversized = "x".repeat(MANUAL_PGN_MAX_BATCH_BYTES + 1);
      expect(manualPgnTextSchema.safeParse(oversized).success).toBe(false);
    });
  });

  describe("manualGameImportInputSchema", () => {
    it("accepts valid game import metadata", () => {
      const input = {
        index: 0,
        color: "w" as const,
        playedDate: "2026-07-15",
        timeControl: "90+30",
        result: "win" as const,
        userRating: 1800,
        opponentRating: 1750,
        event: "Local Open",
      };
      expect(manualGameImportInputSchema.safeParse(input).success).toBe(true);
    });

    it("rejects invalid date format", () => {
      const input = {
        index: 0,
        playedDate: "15-07-2026",
      };
      expect(manualGameImportInputSchema.safeParse(input).success).toBe(false);
    });

    it("rejects index out of bounds", () => {
      expect(manualGameImportInputSchema.safeParse({ index: -1 }).success).toBe(false);
      expect(manualGameImportInputSchema.safeParse({ index: 25 }).success).toBe(false);
    });
  });

  describe("manualPgnImportInputSchema", () => {
    it("accepts valid batch with distinct game indices", () => {
      const batch = {
        pgnText: "1. e4 e5 *\n\n1. d4 d5 *",
        games: [
          { index: 0, color: "w" as const },
          { index: 1, color: "b" as const },
        ],
      };
      expect(manualPgnImportInputSchema.safeParse(batch).success).toBe(true);
    });

    it("rejects batch with duplicate game indices", () => {
      const batch = {
        pgnText: "1. e4 e5 *",
        games: [
          { index: 0, color: "w" as const },
          { index: 0, color: "b" as const },
        ],
      };
      const result = manualPgnImportInputSchema.safeParse(batch);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0]?.message).toBe(
          "Each PGN game may have only one metadata entry.",
        );
      }
    });
  });
});
