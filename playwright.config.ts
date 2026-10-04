import { defineConfig, devices } from "@playwright/test";

declare const process: {
  env: {
    CI?: string;
  };
};

export default defineConfig({
  testDir: "./tests/e2e",
  fullyParallel: true,
  forbidOnly: true,
  ...(process.env.CI ? { workers: 2 } : {}),
  reporter: [["./tests/reporters/playwright-error-only-reporter.ts"], ["html", { open: "never" }]],
  quiet: true,
  preserveOutput: "failures-only",
  reportSlowTests: null,
  use: {
    baseURL: "http://127.0.0.1:4173",
    trace: "retain-on-failure",
  },
  webServer: {
    command: "npm exec vite -- --host 127.0.0.1 --port 4173 --logLevel error --clearScreen false",
    url: "http://127.0.0.1:4173",
    reuseExistingServer: !process.env.CI,
  },
  projects: [
    { name: "chromium", use: { ...devices["Desktop Chrome"] } },
    { name: "mobile-chrome", use: { ...devices["Pixel 7"] } },
  ],
});
