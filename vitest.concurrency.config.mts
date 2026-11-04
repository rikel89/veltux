import { defineConfig } from "vitest/config";

/** Concurrencia con PostgreSQL real (embedded-postgres): aparte porque tarda más. */
export default defineConfig({
  resolve: { tsconfigPaths: true },
  test: {
    name: "concurrency",
    include: ["tests/concurrency/**/*.test.ts"],
    environment: "node",
    testTimeout: 60_000,
    hookTimeout: 180_000,
    fileParallelism: false,
  },
});
