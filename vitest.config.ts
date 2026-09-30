import { defineConfig } from "vitest/config";
import path from "node:path";

export default defineConfig({
  test: {
    environment: "node",
    include: ["src/**/*.test.ts"],
    exclude: ["src/**/*.int.test.ts", "**/node_modules/**"],
  },
  resolve: {
    alias: {
      "server-only": path.resolve(import.meta.dirname, "./src/test/server-only-stub.ts"),
      "@": path.resolve(import.meta.dirname, "./src"),
    },
  },
});
