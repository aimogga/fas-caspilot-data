import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    alias: {
      "@": import.meta.dirname,
    },
  },
  test: {
    include: ["lib/**/*.test.{ts,tsx}", "scripts/*.test.mjs", "packages/ingest/**/*.test.ts"],
  },
});
