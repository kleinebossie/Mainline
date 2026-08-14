import { describe, expect, it } from "vitest";

import { cn } from "@/lib/utils";

describe("cn utility", () => {
  it("merges class names correctly", () => {
    expect(cn("base-class", "additional-class")).toBe(
      "base-class additional-class",
    );
  });

  it("handles conditional class values", () => {
    const isVisible = true;
    const isHidden = false;
    expect(cn("base", isVisible && "visible", isHidden && "hidden")).toBe(
      "base visible",
    );
  });

  it("resolves conflicting tailwind class names", () => {
    expect(cn("p-4", "p-2")).toBe("p-2");
    expect(cn("text-red-500", "text-blue-500")).toBe("text-blue-500");
  });
});
