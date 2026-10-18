import { defineConfig, devices } from "@playwright/test";

const compatibilityTests = [
  "**/form-layout.spec.ts",
  "**/ai-model-selection.spec.ts",
  "**/app.spec.ts",
  "**/input.spec.ts",
  "**/assets.spec.ts",
  "**/direct-ai-flow.spec.ts",
  "**/browser-interaction-regressions.spec.ts",
];

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
  reporter: [
    ["./tests/reporters/playwright-error-only-reporter.ts"],
    ["html", { open: "never" }],
    ["json", { outputFile: "playwright-report/results.json" }],
  ],
  quiet: true,
  preserveOutput: "failures-only",
  reportSlowTests: null,
  use: {
    baseURL: "http://127.0.0.1:4173",
    trace: "retain-on-failure",
  },
  webServer: [
    {
      command:
        "npm run build && npm exec vite preview -- --host 127.0.0.1 --port 4173 --strictPort --logLevel error --clearScreen false",
      url: "http://127.0.0.1:4173",
      reuseExistingServer: false,
    },
    {
      command:
        "npm exec vite -- --host 127.0.0.1 --port 4174 --strictPort --logLevel error --clearScreen false",
      url: "http://127.0.0.1:4174/tests/fixtures/combo-harness.html",
      reuseExistingServer: false,
    },
  ],
  projects: [
    { name: "chromium", use: { ...devices["Desktop Chrome"] } },
    { name: "mobile-chrome", use: { ...devices["Pixel 7"] } },
    { name: "firefox", testMatch: compatibilityTests, use: { ...devices["Desktop Firefox"] } },
    { name: "webkit", testMatch: compatibilityTests, use: { ...devices["Desktop Safari"] } },
    { name: "mobile-safari", testMatch: compatibilityTests, use: { ...devices["iPhone 13"] } },
    { name: "tablet-safari", testMatch: compatibilityTests, use: { ...devices["iPad Pro 11"] } },
  ],
});
