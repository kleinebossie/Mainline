import { describe, expect, it } from "vitest";
import { NAV } from "@/components/navigation";

describe("app shell navigation", () => {
  it("keeps the four primary tabs in the requested order", () => {
    expect(NAV.map((item) => item.label)).toEqual([
      "Today",
      "Analysis",
      "Library",
      "Progress",
    ]);
    expect(NAV.find((item) => item.label === "Progress")?.secondary).toBe(
      undefined,
    );
  });
});
