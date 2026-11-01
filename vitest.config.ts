import path from "node:path";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vitest/config";

export default defineConfig({
  plugins: [react()],
  test: {
    environment: "jsdom",
    setupFiles: ["./vitest.setup.ts"],
    include: ["tests/**/*.test.ts", "tests/**/*.test.tsx"],
    coverage: {
      provider: "v8",
      reporter: ["text", "json-summary"],
      include: ["src/domain/**/*.ts", "src/lib/http.ts", "src/lib/sanitize.ts", "src/lib/rate-limit.ts", "src/lib/normalize-draft.ts", "src/lib/security-headers.ts"],
      thresholds: {
        lines: 78,
        statements: 72,
        functions: 70,
        branches: 58,
      },
    },
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
});
