import { defineConfig } from "vitest/config";

// Mocked-DB/Redis/GenLayer unit tests only. Real-service tests live under
// tests/integration/ with their own config (vitest.integration.config.ts,
// `npm run test:integration`) and are explicitly excluded here -- running
// them under this config would use the wrong (mocked) setup file and
// either fail outright or, worse, silently mismatch expectations.
export default defineConfig({
  test: {
    environment: "node",
    setupFiles: ["./tests/vitest.setup.ts"],
    include: ["tests/*.test.ts"],
    exclude: ["tests/integration/**"],
    globals: false,
  },
});
