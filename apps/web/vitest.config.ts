import path from "node:path";
import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    alias: { "@": path.resolve(__dirname, "src") },
  },
  test: {
    include: ["src/**/*.test.ts"],
    environment: "node",
    // Database tests share one Postgres; run files one at a time.
    fileParallelism: false,
  },
});
