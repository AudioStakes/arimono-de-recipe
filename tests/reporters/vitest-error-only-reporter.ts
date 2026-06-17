import type { Reporter } from "vitest/reporters";

type TestCase = Parameters<NonNullable<Reporter["onTestCaseResult"]>>[0];
type TestModule = Parameters<NonNullable<Reporter["onTestRunEnd"]>>[0][number];
type SerializedError = Parameters<NonNullable<Reporter["onTestRunEnd"]>>[1][number];

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

function formatError(error: SerializedError): string {
  if (error.stack) {
    return withTrailingNewline(stripAnsi(error.stack));
  }

  return withTrailingNewline(stripAnsi(error.message || String(error)));
}

function formatTestLocation(testCase: TestCase): string {
  const file = testCase.module.relativeModuleId || testCase.module.moduleId;
  if (!testCase.location) {
    return file;
  }

  return `${file}:${testCase.location.line}:${testCase.location.column}`;
}

function formatModuleLocation(testModule: TestModule): string {
  return testModule.relativeModuleId || testModule.moduleId;
}

export default class ErrorOnlyReporter implements Reporter {
  onTestCaseResult(testCase: TestCase): void {
    const result = testCase.result();
    if (result.state !== "failed") {
      return;
    }

    process.stderr.write(`${formatTestLocation(testCase)} › ${testCase.fullName}\n`);
    for (const error of result.errors) {
      process.stderr.write(formatError(error));
    }
  }

  onTestRunEnd(
    testModules: readonly TestModule[],
    unhandledErrors: readonly SerializedError[],
  ): void {
    for (const testModule of testModules) {
      for (const error of testModule.errors()) {
        process.stderr.write(`${formatModuleLocation(testModule)}\n`);
        process.stderr.write(formatError(error));
      }
    }

    for (const error of unhandledErrors) {
      process.stderr.write(formatError(error));
    }
  }
}
