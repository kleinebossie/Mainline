import { describe, expect, it } from "vitest";

import {
  calibrationRatingFromSnapshot,
  highestLiveRatingFromSnapshot,
  playingRatingEntryFromSnapshot,
  playingRatingWithDeviationFromSnapshot,
  ratingEntriesFromSnapshot,
} from "@/lib/rating-snapshot";

const ratings = {
  puzzle: { rating: 2100, rd: 55 },
  bullet: { rating: 1450, rd: 90 },
  blitz: { rating: 1510, rd: 80 },
  rapid: { rating: 1490, rd: 70 },
  classical: { rating: 1600, rd: 65 },
  chess960: { rating: 1700, rd: 75 },
};

describe("rating snapshot rules", () => {
  it("keeps tactical and playing-strength priorities distinct", () => {
    expect(calibrationRatingFromSnapshot(ratings)).toBe(2100);
    expect(playingRatingEntryFromSnapshot(ratings)).toEqual({
      format: "rapid",
      rating: 1490,
      rd: 70,
    });
  });

  it("does not use bullet as a playing-strength fallback", () => {
    expect(
      playingRatingEntryFromSnapshot({
        puzzle: { rating: 2100, rd: 55 },
        bullet: { rating: 1450, rd: 90 },
      }),
    ).toBeNull();
  });

  it("falls through to the next playing format when measurement needs RD", () => {
    expect(
      playingRatingWithDeviationFromSnapshot({
        rapid: { rating: 1490 },
        blitz: { rating: 1510, rd: 80 },
        puzzle: { rating: 2100, rd: 55 },
      }),
    ).toEqual({ format: "blitz", rating: 1510, rd: 80 });
  });

  it("uses the highest live rating for the library band", () => {
    expect(highestLiveRatingFromSnapshot(ratings)).toBe(1510);
  });

  it("returns only supported playing formats in canonical order", () => {
    expect(
      ratingEntriesFromSnapshot(ratings).map((entry) => entry.format),
    ).toEqual(["bullet", "blitz", "rapid", "classical"]);
  });

  it("fails closed on invalid ratings and treats invalid deviation as missing", () => {
    expect(
      ratingEntriesFromSnapshot({
        bullet: { rating: -1, rd: 80 },
        blitz: { rating: Number.NaN, rd: 80 },
        rapid: { rating: 1500.4, rd: 0 },
      }),
    ).toEqual([{ format: "rapid", rating: 1500, rd: null }]);
  });
});
