// @ts-check
// Online-play E2E config. Assumes `yarn emulate` and the dev server are
// already running; it does not start a webServer.
const { defineConfig, devices } = require("@playwright/test");

module.exports = defineConfig({
  testDir: "./e2e-online",
  fullyParallel: false,
  workers: 1,
  forbidOnly: !!process.env.CI,
  retries: 0,
  reporter: "list",
  use: {
    baseURL: process.env.BASE_URL || "http://localhost:8082",
    trace: "on-first-retry",
    screenshot: "only-on-failure",
    // Optional: run against an installed Chromium-based browser
    launchOptions: process.env.CHROMIUM_PATH
      ? { executablePath: process.env.CHROMIUM_PATH }
      : {},
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
});
