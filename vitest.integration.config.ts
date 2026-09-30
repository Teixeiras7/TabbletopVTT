import { defineConfig } from "vitest/config";
import path from "node:path";

export default defineConfig({
  test: {
    environment: "node",
    include: ["src/**/*.int.test.ts"],
    setupFiles: ["src/test/load-env.ts"],
    testTimeout: 30_000,
    fileParallelism: false,
  },
  resolve: {
    alias: {
      "server-only": path.resolve(import.meta.dirname, "./src/test/server-only-stub.ts"),
      "@": path.resolve(import.meta.dirname, "./src"),
    },
  },
});
