import type { Dirent } from "node:fs";
import { readdir, readFile, stat } from "node:fs/promises";
import path from "node:path";
import { describe, expect, it } from "vitest";

type TextFile = {
  path: string;
  text: string;
};

type PackageJson = {
  exports?: unknown;
};

const projectRoot = process.cwd();

const requiredStableHooks = [
  "app-shell",
  "recipe-form",
  "basic-fields",
  "advanced-fields",
  "cook-time-range",
  "supplemental-notes",
  "condition-chips",
  "sticky-condition-chips",
  "prompt-output",
  "mobile-prompt-output",
  "copy-prompt",
  "copy-prompt-sticky",
  "mobile-prompt-panel",
  "recipe-item-${",
  "recipe-item-toggle-${",
  "recipe-item-panel-${",
  "combo-${",
  "combo-input-${",
  "combo-suggestions-${",
  "serving-stepper-${",
] as const;

const requiredDocs = [
  "docs/testing/ux-test-matrix.md",
  "docs/codex/subagent-selection.md",
  "docs/codex/review-checklist.md",
] as const;

const toProjectPath = (absolutePath: string): string =>
  path.relative(projectRoot, absolutePath).split(path.sep).join("/");

async function pathExists(projectPath: string): Promise<boolean> {
  try {
    await stat(path.join(projectRoot, projectPath));
    return true;
  } catch {
    return false;
  }
}

async function readProjectFile(projectPath: string): Promise<string> {
  return readFile(path.join(projectRoot, projectPath), "utf8");
}

async function collectFiles(
  directory: string,
  shouldInclude: (projectPath: string) => boolean,
): Promise<TextFile[]> {
  const absoluteDirectory = path.join(projectRoot, directory);
  const entries = await readdir(absoluteDirectory, { withFileTypes: true });
  const files = await Promise.all(
    entries.map((entry: Dirent) => collectEntry(absoluteDirectory, entry, shouldInclude)),
  );
  return files.flat();
}

async function collectEntry(
  parentDirectory: string,
  entry: Dirent,
  shouldInclude: (projectPath: string) => boolean,
): Promise<TextFile[]> {
  const absolutePath = path.join(parentDirectory, entry.name);
  const projectPath = toProjectPath(absolutePath);

  if (entry.isDirectory()) {
    return collectFiles(projectPath, shouldInclude);
  }

  if (!entry.isFile() || !shouldInclude(projectPath)) {
    return [];
  }

  return [{ path: projectPath, text: await readFile(absolutePath, "utf8") }];
}

function assertNoStaticOnlyViolations(files: readonly TextFile[]): void {
  const forbiddenPatterns = [
    { label: "server framework import", pattern: /\bfrom\s+["'](?:express|fastify|hono|next)["']/ },
    {
      label: "server side-effect import",
      pattern: /\bimport\s+["'](?:express|fastify|hono|next)["']/,
    },
    { label: "Hono import", pattern: /["']@hono\// },
    { label: "Node HTTP server import", pattern: /["']node:(?:http|https|http2|net)["']/ },
    { label: "fetch call", pattern: /\bfetch\s*\(/ },
    { label: "XMLHttpRequest", pattern: /\bXMLHttpRequest\b/ },
    { label: "WebSocket", pattern: /\bWebSocket\b/ },
    { label: "sendBeacon", pattern: /\bnavigator\.sendBeacon\b/ },
    { label: "LLM provider name", pattern: /\b(?:OpenAI|Anthropic|Gemini|GoogleGenerativeAI)\b/i },
    {
      label: "API key",
      pattern: /\b(?:API_KEY|OPENAI_API_KEY|ANTHROPIC_API_KEY|GEMINI_API_KEY)\b/,
    },
    { label: "runtime env access", pattern: /\b(?:import\.meta|process)\.env\b/ },
  ] as const;

  const violations = files.flatMap((file) =>
    forbiddenPatterns
      .filter(({ pattern }) => pattern.test(file.text))
      .map(({ label }) => `${file.path}: ${label}`),
  );

  if (violations.length > 0) {
    throw new Error(`Static-only guard failed:\n${violations.join("\n")}`);
  }
}

function assertPromptRulesStayOutOfUi(files: readonly TextFile[]): void {
  const allowedFiles = new Set(["src/prompt.ts", "src/data.ts"]);
  const promptRulePatterns = [
    /##\s+役割/,
    /###\s+(?:家にある食材|使う材料|主材料の追加制限|NG食材・調味料|調理時間|食べる人数)/,
    /買い足し前提/,
  ] as const;

  const violations = files
    .filter((file) => !allowedFiles.has(file.path))
    .flatMap((file) =>
      promptRulePatterns
        .filter((pattern) => pattern.test(file.text))
        .map(() => `${file.path}: prompt output rule text outside prompt/data module`),
    );

  if (violations.length > 0) {
    throw new Error(`Prompt source-of-truth guard failed:\n${violations.join("\n")}`);
  }
}

function assertStableHooks(sourceFiles: readonly TextFile[], e2eFiles: readonly TextFile[]): void {
  const sourceText = sourceFiles.map((file) => file.text).join("\n");
  const e2eText = e2eFiles.map((file) => file.text).join("\n");
  const missingHooks = requiredStableHooks.filter((hook) => !sourceText.includes(hook));

  if (missingHooks.length > 0) {
    throw new Error(`Missing stable hook strings:\n${missingHooks.join("\n")}`);
  }

  if (!e2eText.includes("getByTestId(") && !e2eText.includes("data-testid")) {
    throw new Error("E2E tests must use stable hooks for at least one behavior-critical flow.");
  }
}

function assertPackageBoundary(rootPackage: PackageJson, packageFiles: readonly TextFile[]): void {
  if (rootPackage.exports !== undefined) {
    const exportsText = JSON.stringify(rootPackage.exports);
    if (exportsText?.includes('"./*"') || exportsText?.includes("./src/*")) {
      throw new Error("Root package exports must not expose broad internals.");
    }
  }

  const missingExports = packageFiles
    .map((file) => ({ file, json: JSON.parse(file.text) as PackageJson }))
    .filter(({ json }) => json.exports === undefined)
    .map(({ file }) => file.path);

  if (missingExports.length > 0) {
    throw new Error(`Future packages must declare explicit exports:\n${missingExports.join("\n")}`);
  }
}

function extractRequiredReadingPaths(agentsText: string): string[] {
  const section = agentsText.match(/## Required Reading\n([\s\S]*?)(?=\n## )/)?.[1] ?? "";
  return [...section.matchAll(/`([^`]+)`/g)].flatMap((match) => {
    const projectPath = match[1];
    return projectPath ? [projectPath] : [];
  });
}

function extractAdrLinks(text: string): string[] {
  return [...text.matchAll(/docs\/adr\/[0-9]{4}[-a-z0-9]+\.md/g)].flatMap((match) => {
    const projectPath = match[0];
    return projectPath ? [projectPath] : [];
  });
}

describe("current repository guardrails", () => {
  it("keeps runtime source static-only", async () => {
    const sourceFiles = await collectFiles("src", (projectPath) => projectPath.endsWith(".ts"));
    assertNoStaticOnlyViolations(sourceFiles);
  });

  it("keeps prompt output rules out of generic UI rendering modules", async () => {
    const sourceFiles = await collectFiles("src", (projectPath) => projectPath.endsWith(".ts"));
    assertPromptRulesStayOutOfUi(sourceFiles);
  });

  it("keeps stable hooks documented and used by E2E", async () => {
    const sourceFiles = await collectFiles("src", (projectPath) => projectPath.endsWith(".ts"));
    const e2eFiles = await collectFiles("tests/e2e", (projectPath) => projectPath.endsWith(".ts"));

    assertStableHooks(sourceFiles, e2eFiles);
  });

  it("keeps package boundaries explicit without fake root exports", async () => {
    const rootPackage = JSON.parse(await readProjectFile("package.json")) as PackageJson;
    const hasPackagesDirectory = await pathExists("packages");
    const packageFiles = hasPackagesDirectory
      ? await collectFiles("packages", (projectPath) => projectPath.endsWith("package.json"))
      : [];

    assertPackageBoundary(rootPackage, packageFiles);
  });

  it("keeps documentation links and required guardrail docs consistent", async () => {
    const agentsText = await readProjectFile("AGENTS.md");
    const codexDocs = await collectFiles("docs/codex", (projectPath) =>
      projectPath.endsWith(".md"),
    );
    const requiredReadingPaths = extractRequiredReadingPaths(agentsText);
    const adrLinks = [
      ...extractAdrLinks(agentsText),
      ...codexDocs.flatMap((file) => extractAdrLinks(file.text)),
    ];
    const checkedPaths = [...requiredReadingPaths, ...requiredDocs, ...adrLinks];
    const missingPaths: string[] = [];

    for (const projectPath of checkedPaths) {
      if (!(await pathExists(projectPath))) {
        missingPaths.push(projectPath);
      }
    }

    expect(missingPaths).toEqual([]);
  });
});

describe("guardrail violation samples", () => {
  it("rejects runtime API/server additions", () => {
    expect(() =>
      assertNoStaticOnlyViolations([
        { path: "src/main.ts", text: 'import express from "express";\nfetch("/api/recipe");' },
      ]),
    ).toThrow(/Static-only guard failed/);
  });

  it("rejects prompt rules in UI rendering", () => {
    expect(() =>
      assertPromptRulesStayOutOfUi([
        { path: "src/ui.ts", text: 'const heading = "### 家にある食材";' },
      ]),
    ).toThrow(/Prompt source-of-truth guard failed/);
  });

  it("rejects missing stable hook coverage", () => {
    expect(() =>
      assertStableHooks(
        [{ path: "src/ui.ts", text: 'data-testid="app-shell"' }],
        [{ path: "tests/e2e/app.spec.ts", text: 'page.locator(".field-toggle")' }],
      ),
    ).toThrow(/Missing stable hook strings/);
  });

  it("rejects future packages without explicit exports", () => {
    expect(() =>
      assertPackageBoundary({}, [{ path: "packages/example/package.json", text: '{"name":"x"}' }]),
    ).toThrow(/explicit exports/);
  });
});
