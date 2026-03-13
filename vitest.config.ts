import { defineConfig } from "vitest/config";

import path from "path";

export default defineConfig({
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
export default defineConfig({
  test: {
    environment: "jsdom",
    include: ["src/**/*.test.ts", "src/**/*.spec.ts"],
    coverage: {
      reporter: ["text", "json", "html"],
    },
  },
});
