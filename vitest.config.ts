import { defineConfig } from "vitest/config";
import { fileURLToPath } from "node:url";

export default defineConfig({
  test: {
    include: [
      "tests/unit/**/*.test.{ts,tsx}",
      "tests/guards/**/*.test.{ts,tsx}",
    ],
    environment: "node",
  },
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
    },
  },
  esbuild: {
    jsx: "automatic",
  },
});
