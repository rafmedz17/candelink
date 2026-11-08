import { defineConfig, devices } from "@playwright/test";
export default defineConfig({
  testDir: "./tests/e2e",
  globalTeardown: "./tests/owner-teardown.ts",
  testMatch: "business-owner.spec.ts",
  fullyParallel: false,
  workers: 1,
  timeout: 60000,
  expect: { timeout: 15000 },
  use: {
    baseURL: "http://localhost:3103",
    actionTimeout: 15000,
    trace: "retain-on-failure",
  },
  webServer: {
    command: "node scripts/owner-test-server.mjs",
    url: "http://localhost:3103/login",
    timeout: 240000,
    reuseExistingServer: false,
  },
  projects: [
    { name: "owner-desktop", use: { ...devices["Desktop Chrome"] } },
    {
      name: "owner-mobile",
      use: { ...devices["iPhone 13"], defaultBrowserType: "chromium" },
    },
  ],
});
