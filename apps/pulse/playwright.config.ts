import { defineConfig, devices } from "@playwright/test";

/**
 * Browser-level E2E.
 *
 * The jsdom suite covers structure and ARIA; this one exists for the things
 * jsdom cannot judge — real colour contrast, real focus order, real rendering
 * in both light and dark schemes.
 */
export default defineConfig({
  testDir: "./e2e",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  workers: process.env.CI ? 1 : undefined,
  use: {
    baseURL: "http://127.0.0.1:4173",
    trace: "on-first-retry",
  },
  projects: [
    {
      name: "chromium",
      use: {
        ...devices["Desktop Chrome"],
        // Use the browser already present in the environment rather than
        // downloading one pinned to this @playwright/test version.
        ...(process.env.PULSE_CHROMIUM_PATH ? { launchOptions: { executablePath: process.env.PULSE_CHROMIUM_PATH } } : {}),
      },
    },
  ],
  webServer: {
    command: "npm run build && npm run preview",
    url: "http://127.0.0.1:4173",
    reuseExistingServer: !process.env.CI,
    timeout: 180_000,
  },
});
