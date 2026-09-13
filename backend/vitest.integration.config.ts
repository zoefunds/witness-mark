import { defineConfig } from "vitest/config";

// Separate from vitest.config.ts (mocked-DB unit tests): this config runs
// tests/integration/*.test.ts against REAL Postgres + Redis instances
// (see docker-compose.test.yml). Run:
//   docker compose -f docker-compose.test.yml up -d
//   npm run test:integration
export default defineConfig({
  test: {
    environment: "node",
    setupFiles: ["./tests/integration/vitest.setup.ts"],
    include: ["tests/integration/**/*.test.ts"],
    testTimeout: 15_000,
    // Real-service tests share one DB/Redis instance -- run them
    // sequentially so one test's rows/keys can't race another's.
    fileParallelism: false,
  },
});
