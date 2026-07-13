import { describe, expect, it } from "vitest";
import { NAV } from "@/components/navigation";

describe("app shell navigation", () => {
  it("keeps Progress as a top-level item in the requested order", () => {
    expect(NAV.map((item) => item.label)).toEqual([
      "Today",
      "Analysis",
      "Library",
      "Progress",
      "About",
    ]);
    expect(NAV.find((item) => item.label === "Progress")?.secondary).toBe(
      undefined,
    );
  });
});
