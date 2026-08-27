import { defineConfig, devices } from "@playwright/test";

// E2E tests run against the LIVE deployed app by default (no local dev
// server needed, no mocked contract/backend data -- these are real
// network requests to StudioNet and the production API). Override with
// PLAYWRIGHT_BASE_URL to point at a local dev server instead.
const baseURL = process.env.PLAYWRIGHT_BASE_URL ?? "https://witness-mark.vercel.app";

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: true,
  retries: process.env.CI ? 1 : 0,
  reporter: [["list"]],
  use: {
    baseURL,
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
  projects: [
    {
      name: "desktop-chromium",
      use: { ...devices["Desktop Chrome"] },
    },
    {
      name: "mobile",
      use: { ...devices["iPhone 13"] },
    },
  ],
});
