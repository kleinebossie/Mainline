import { describe, it, expect } from "vitest";
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

// Architecture guard for L2 (BUILD.md §0.1, §13.4): decision code in engine/ and
// methodology/ must take an injected Clock/seed — no wall-clock or randomness.
// This is the CI `guards` gate; it activates automatically as those dirs fill in.
const DECISION_DIRS = ["src/engine", "src/methodology"];
const FORBIDDEN: ReadonlyArray<readonly [RegExp, string]> = [
  [/\bDate\.now\s*\(/, "Date.now() — inject a Clock"],
  [/\bMath\.random\s*\(/, "Math.random() — inject a seed"],
  [/\bnew\s+Date\s*\(\s*\)/, "new Date() — inject a Clock"],
];

// L1 (BUILD.md §0.1, §13.4): the Engine consumes the Methodology only through its typed
// surface (`@/methodology`), never reaching into its internals (provider/loader/schema/
// configs). Importing an internal would let science leak past the seam boundary (§2.3).
const CONSUMER_DIRS = ["src/engine", "src/analysis", "src/server", "src/app"];
const METHODOLOGY_INTERNAL_IMPORT = /from\s+["']@\/methodology\/[^"']+["']/;

function tsFiles(dir: string): string[] {
  if (!existsSync(dir)) return [];
  const out: string[] = [];
  for (const entry of readdirSync(dir)) {
    const p = join(dir, entry);
    if (statSync(p).isDirectory()) out.push(...tsFiles(p));
    else if (p.endsWith(".ts") || p.endsWith(".tsx")) out.push(p);
  }
  return out;
}

describe("architecture guards", () => {
  it("L2: decision code has no wall-clock or randomness", () => {
    const violations: string[] = [];
    for (const dir of DECISION_DIRS) {
      for (const file of tsFiles(dir)) {
        const src = readFileSync(file, "utf8");
        for (const [pattern, why] of FORBIDDEN) {
          if (pattern.test(src)) violations.push(`${file}: ${why}`);
        }
      }
    }
    expect(violations, violations.join("\n")).toEqual([]);
  });

  it("L1: the Engine imports the methodology surface, not its internals", () => {
    const violations: string[] = [];
    for (const dir of CONSUMER_DIRS) {
      for (const file of tsFiles(dir)) {
        const src = readFileSync(file, "utf8");
        if (METHODOLOGY_INTERNAL_IMPORT.test(src)) {
          violations.push(
            `${file}: import from "@/methodology/..." internal — use the "@/methodology" surface (L1).`,
          );
        }
      }
    }
    expect(violations, violations.join("\n")).toEqual([]);
  });
});
