import { defineConfig } from "vitest/config";
import path from "node:path";

// Testes só das regras do RPG (engine e catálogo).
export default defineConfig({
  test: { environment: "node", include: ["src/**/*.test.ts"] },
  resolve: { alias: { "@": path.resolve(import.meta.dirname, "./src") } },
});
