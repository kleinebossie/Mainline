// Copies the browser-ready Stockfish WASM "lite" builds out of the pinned `stockfish`
// devDependency into `public/stockfish/`, where the client-side analysis worker (M5,
// BUILD.md §6.5) loads them same-origin (so they satisfy the COOP/COEP cross-origin
// isolation headers in next.config.mjs). It ships two flavours:
//
//   * stockfish-18-lite.js / .wasm         — multi-threaded (needs SharedArrayBuffer →
//                                             cross-origin isolation; the primary engine)
//   * stockfish-18-lite-single.js / .wasm  — single-threaded fallback (no SAB required)
//
// Engine binaries are GPLv3 and ~7 MB each, so they are NOT committed (.gitignore); this
// script regenerates them from node_modules. It is idempotent (skips up-to-date copies)
// and runs automatically via the `predev`/`prebuild` npm hooks, so a clean `npm ci` →
// build (CI/Vercel) provisions the engine with no manual step. Run it directly with
// `npm run setup:stockfish`.
//
// Plain Node ESM (no tsx) so it can run in any build context. It NEVER fails the build:
// if the source package is missing it warns and exits 0 (the app still builds; analysis
// just stays unavailable until the engine is present).

import { existsSync, mkdirSync, copyFileSync, statSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const srcDir = join(root, "node_modules", "stockfish", "bin");
const destDir = join(root, "public", "stockfish");

// The lite WASM flavours only — the full builds are >100 MB (free-tier unfriendly) and
// the asm.js fallback is ~10 MB for a vanishing audience (documented, deliberately omitted).
const FILES = [
  "stockfish-18-lite.js",
  "stockfish-18-lite.wasm",
  "stockfish-18-lite-single.js",
  "stockfish-18-lite-single.wasm",
];

if (!existsSync(srcDir)) {
  console.warn(
    `[setup-stockfish] node_modules/stockfish not found — skipping engine copy. ` +
      `Run \`npm install\` then \`npm run setup:stockfish\` to enable client-side analysis.`,
  );
  process.exit(0);
}

mkdirSync(destDir, { recursive: true });

let copied = 0;
let skipped = 0;
for (const name of FILES) {
  const from = join(srcDir, name);
  const to = join(destDir, name);
  if (!existsSync(from)) {
    console.warn(`[setup-stockfish] missing source ${name} — skipped.`);
    continue;
  }
  // Idempotent: skip if the destination already matches the source size.
  if (existsSync(to) && statSync(to).size === statSync(from).size) {
    skipped += 1;
    continue;
  }
  copyFileSync(from, to);
  copied += 1;
}

console.log(
  `[setup-stockfish] engine ready in public/stockfish (${copied} copied, ${skipped} up-to-date).`,
);
