import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    allowOnly: false,
    reporters: ["./tests/reporters/vitest-error-only-reporter.ts"],
    silent: "passed-only",
  },
});
