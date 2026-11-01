import { fileURLToPath } from "node:url";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vitest/config";

export default defineConfig({
  plugins: [react()],
  test: {
    projects: [
      { extends: true, test: { name: "domain-api", environment: "node", setupFiles: ["./vitest.node.setup.ts"], include: ["tests/**/*.test.ts"], exclude: ["tests/storage.test.ts"] } },
      { extends: true, test: { name: "ui-storage", environment: "jsdom", setupFiles: ["./vitest.setup.ts"], include: ["tests/**/*.test.tsx", "tests/storage.test.ts"] } },
    ],
    coverage: {
      provider: "v8",
      reporter: ["text", "json-summary"],
      include: ["src/domain/**/*.ts", "src/lib/**/*.ts", "src/app/api/**/route.ts"],
      thresholds: {
        lines: 88,
        statements: 82,
        functions: 86,
        branches: 68,
      },
    },
  },
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
    },
  },
});
