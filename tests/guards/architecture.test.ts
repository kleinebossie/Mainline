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
});
