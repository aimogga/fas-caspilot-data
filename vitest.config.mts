import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    alias: {
      "@": import.meta.dirname,
      // Next resolves `server-only` to an empty module on the server; tests run server code, so they do too.
      "server-only": `${import.meta.dirname}/node_modules/server-only/empty.js`,
    },
  },
  test: {
    include: ["lib/**/*.test.{ts,tsx}", "scripts/*.test.mjs", "packages/ingest/**/*.test.ts"],
  },
});
