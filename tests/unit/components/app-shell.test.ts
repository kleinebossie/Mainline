import { readFileSync } from "node:fs";
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

  it("uses the shared nav source and protects the mobile top bar from wrapping", () => {
    const source = readFileSync("src/components/app-shell.tsx", "utf8");
    expect(source).toContain('import { NAV } from "@/components/navigation"');
    expect(source).toContain("whitespace-nowrap");
    expect(source).toContain('item.secondary && "hidden sm:inline-flex"');
  });

  it("keeps Today cards overflow-resistant at mobile widths", () => {
    const source = readFileSync("src/app/today/today.tsx", "utf8");
    expect(source).toContain("flex min-w-0 flex-wrap");
    expect(source).toContain("break-words font-serif");
    expect(source).not.toContain("grid-cols-[");
  });
});
