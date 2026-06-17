import type { Reporter, TestCase, TestError, TestResult } from "@playwright/test/reporter";

const failureStatuses = new Set<TestResult["status"]>(["failed", "timedOut", "interrupted"]);

function stripAnsi(value: string): string {
  let output = "";
  for (let index = 0; index < value.length; index += 1) {
    if (value.charCodeAt(index) === 27 && value.charAt(index + 1) === "[") {
      index += 2;
      while (index < value.length && value.charAt(index) !== "m") {
        index += 1;
      }
      continue;
    }

    output += value.charAt(index);
  }

  return output;
}

function withTrailingNewline(value: string): string {
  return value.endsWith("\n") ? value : `${value}\n`;
}

function formatError(error: TestError): string {
  if (error.stack) {
    return withTrailingNewline(stripAnsi(error.stack));
  }

  return withTrailingNewline(stripAnsi(error.message || String(error)));
}

export default class ErrorOnlyReporter implements Reporter {
  onTestEnd(test: TestCase, result: TestResult): void {
    if (!failureStatuses.has(result.status)) {
      return;
    }

    const title = test.titlePath().join(" › ");
    const location = `${test.location.file}:${test.location.line}:${test.location.column}`;
    process.stderr.write(`${location} › ${title}\n`);

    const errors = result.errors.length > 0 ? result.errors : result.error ? [result.error] : [];
    for (const error of errors) {
      process.stderr.write(formatError(error));
    }
  }

  onError(error: TestError): void {
    process.stderr.write(formatError(error));
  }
}
