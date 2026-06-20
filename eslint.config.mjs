import { dirname } from "path";
import { fileURLToPath } from "url";
import { FlatCompat } from "@eslint/eslintrc";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const compat = new FlatCompat({ baseDirectory: __dirname });

const eslintConfig = [
  ...compat.extends("next/core-web-vitals", "next/typescript"),
  {
    // L2 (determinism, BUILD.md §0.1/§13.4): decision code must take an injected Clock/seed.
    // No wall-clock or randomness inside engine/ or methodology/ decision modules.
    files: ["src/engine/**/*.{ts,tsx}", "src/methodology/**/*.{ts,tsx}"],
    rules: {
      "no-restricted-syntax": [
        "error",
        {
          selector:
            "CallExpression[callee.object.name='Date'][callee.property.name='now']",
          message:
            "L2: inject a Clock; no Date.now() in engine/ or methodology/ decision code.",
        },
        {
          selector:
            "CallExpression[callee.object.name='Math'][callee.property.name='random']",
          message:
            "L2: inject a seed; no Math.random() in engine/ or methodology/ decision code.",
        },
        {
          selector: "NewExpression[callee.name='Date'][arguments.length=0]",
          message:
            "L2: inject a Clock; no `new Date()` without args in engine/ or methodology/ decision code.",
        },
      ],
    },
  },
  {
    ignores: [
      "**/.next/**",
      "**/node_modules/**",
      "next-env.d.ts",
      "**/*.config.ts",
      "**/*.config.mjs",
      "**/*.config.js",
      "**/.agents/**",
    ],
  },
];

export default eslintConfig;
