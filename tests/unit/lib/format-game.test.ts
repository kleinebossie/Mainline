import { describe, expect, it } from "vitest";

import { formatGameDate } from "@/lib/format-game";

describe("formatGameDate", () => {
  it("renders manual date-only values in UTC", () => {
    expect(formatGameDate(new Date("2026-07-04T12:00:00.000Z"), "manual")).toBe(
      "4 Jul 2026",
    );
  });

  it("keeps missing and invalid dates explicit", () => {
    expect(formatGameDate(null, "manual")).toBe("Date unknown");
    expect(formatGameDate("not-a-date", "manual")).toBe("Date unknown");
  });
});
