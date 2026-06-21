import { describe, it, expect } from "vitest";
import { rawGameFeaturesSchema } from "@/lib/raw-features";
import { extractFeatures } from "@/analysis/features";

describe("L1 Guard: rawGameFeaturesSchema", () => {
  const validOutput = extractFeatures({
    pgn: "1. e4 1-0",
    evals: [
      { cp: 20, mate: null },
      { cp: -20, mate: null },
    ],
    userColor: "w",
  });

  it("parses a valid extractFeatures output successfully", () => {
    const res = rawGameFeaturesSchema.safeParse(validOutput);
    expect(res.success).toBe(true);
  });

  it("rejects an object that adds an interpreted field (L1 guard)", () => {
    const badData1 = { ...validOutput, weakness: "tactics" };
    expect(rawGameFeaturesSchema.safeParse(badData1).success).toBe(false);

    const badData2 = { ...validOutput, evidenceGrade: "A" };
    expect(rawGameFeaturesSchema.safeParse(badData2).success).toBe(false);
  });

  it("has exactly the allowed top-level keys from the §5.2 contract", () => {
    const keys = Object.keys(validOutput).sort();
    const expectedKeys = [
      "acplOverall",
      "acplByPhase",
      "phaseBoundaries",
      "moveEvals",
      "blunders",
      "errorCounts",
      "conversion",
      "openingDeviation",
    ].sort();

    expect(keys).toEqual(expectedKeys);
  });
});
