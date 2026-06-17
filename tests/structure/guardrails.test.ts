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
  "material-use-panel",
  "cook-time-range",
  "supplemental-notes",
  "condition-chips",
  "sticky-condition-chips",
  "prompt-output",
  "mobile-prompt-output",
  "copy-prompt",
  "copy-prompt-sticky",
  "copy-prompt-mobile-panel",
  "generate-recipe",
  "generate-recipe-mobile",
  "ai-recipe-panel",
  "ai-recipe-status",
  "ai-recipe-content",
  "ai-recipe-error",
  "ai-recipe-model",
  "mobile-ai-recipe-panel",
  "mobile-ai-recipe-status",
  "mobile-ai-recipe-content",
  "mobile-ai-recipe-error",
  "mobile-ai-recipe-model",
  "recipe-candidate-list",
  "recipe-candidate-${",
  "recipe-candidate-select-${",
  "recipe-candidate-detail",
  "recipe-candidate-back",
  'data-state", selected ? "selected" : "idle"',
  "mobile-prompt-panel",
  "recipe-item-${",
  "recipe-item-toggle-${",
  "recipe-item-panel-${",
  "combo-${",
  "combo-input-${",
  "combo-suggestions-${",
  "serving-stepper-${",
  "serving-label-${",
  "serving-minus-${",
  "serving-count-${",
  "serving-plus-${",
  "custom-servings-panel",
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

function assertClientNetworkBoundary(files: readonly TextFile[]): void {
  const forbiddenPatterns = [
    { label: "server framework import", pattern: /\bfrom\s+["'](?:express|fastify|hono|next)["']/ },
    {
      label: "server side-effect import",
      pattern: /\bimport\s+["'](?:express|fastify|hono|next)["']/,
    },
    { label: "Hono import", pattern: /["']@hono\// },
    { label: "Node HTTP server import", pattern: /["']node:(?:http|https|http2|net)["']/ },
    { label: "XMLHttpRequest", pattern: /\bXMLHttpRequest\b/ },
    { label: "WebSocket", pattern: /\bWebSocket\b/ },
    { label: "sendBeacon", pattern: /\bnavigator\.sendBeacon\b/ },
    { label: "Cloudflare REST API", pattern: /api\.cloudflare\.com/i },
    { label: "authorization header", pattern: /\b(?:Authorization|Bearer)\b/ },
    {
      label: "API key",
      pattern:
        /\b(?:API_KEY|OPENAI_API_KEY|ANTHROPIC_API_KEY|GEMINI_API_KEY|CLOUDFLARE_API_TOKEN)\b/,
    },
    { label: "runtime env access", pattern: /\b(?:import\.meta|process)\.env\b/ },
  ] as const;

  const fetchFiles = files
    .filter((file) => /\bfetch\s*\(/.test(file.text))
    .map((file) => file.path);
  const disallowedFetchFiles = fetchFiles.filter((file) => file !== "src/ai-recipe-client.ts");
  const aiClient = files.find((file) => file.path === "src/ai-recipe-client.ts");
  const aiClientEndpoints = aiClient
    ? [...aiClient.text.matchAll(/\b(?:fetcher|fetch)\(\s*["']([^"']+)["']/g)].flatMap((match) =>
        match[1] ? [match[1]] : [],
      )
    : [];
  const aiClientDirectFetchEndpoints = aiClient
    ? [...aiClient.text.matchAll(/\bfetch\(\s*["']([^"']+)["']/g)].flatMap((match) =>
        match[1] ? [match[1]] : [],
      )
    : [];
  const disallowedAiClientEndpoints = aiClientEndpoints.filter(
    (endpoint) => endpoint !== "/api/recipe",
  );

  const violations = files.flatMap((file) =>
    forbiddenPatterns
      .filter(({ pattern }) => pattern.test(file.text))
      .map(({ label }) => `${file.path}: ${label}`),
  );

  if (disallowedFetchFiles.length > 0) {
    violations.push(
      ...disallowedFetchFiles.map((file) => `${file}: fetch call outside approved API client`),
    );
  }

  if (!aiClient?.text.includes('fetcher("/api/recipe"')) {
    violations.push("src/ai-recipe-client.ts: approved API client must call /api/recipe only");
  }

  if (disallowedAiClientEndpoints.length > 0) {
    violations.push(
      ...disallowedAiClientEndpoints.map(
        (endpoint) => `src/ai-recipe-client.ts: unapproved API endpoint ${endpoint}`,
      ),
    );
  }

  if (aiClientDirectFetchEndpoints.length > 0) {
    violations.push("src/ai-recipe-client.ts: direct fetch call is not allowed");
  }

  if (violations.length > 0) {
    throw new Error(`Client network boundary guard failed:\n${violations.join("\n")}`);
  }
}

function assertApprovedFunctionBoundary(files: readonly TextFile[]): void {
  const approvedFunctionFiles = new Set(["functions/api/recipe.ts"]);
  const unexpectedFunctionFiles = files
    .map((file) => file.path)
    .filter((file) => !approvedFunctionFiles.has(file));
  const forbiddenPatterns = [
    { label: "Cloudflare REST API", pattern: /api\.cloudflare\.com/i },
    { label: "authorization header", pattern: /\b(?:Authorization|Bearer)\b/ },
    { label: "Cloudflare token", pattern: /\b(?:CLOUDFLARE_API_TOKEN|CLOUDFLARE_ACCOUNT_ID)\b/ },
    {
      label: "provider SDK import",
      pattern: /["'](?:openai|@anthropic-ai\/sdk|@google\/generative-ai)["']/i,
    },
    { label: "server fetch call", pattern: /\bfetch\s*\(/ },
    { label: "console logging", pattern: /\bconsole\./ },
    { label: "persistent storage", pattern: /\b(?:localStorage|sessionStorage|indexedDB)\b/ },
    { label: "telemetry beacon", pattern: /\bsendBeacon\b/ },
  ] as const;

  const violations = files.flatMap((file) =>
    forbiddenPatterns
      .filter(({ pattern }) => pattern.test(file.text))
      .map(({ label }) => `${file.path}: ${label}`),
  );

  if (unexpectedFunctionFiles.length > 0) {
    violations.push(
      ...unexpectedFunctionFiles.map(
        (file) => `${file}: function file outside approved API surface`,
      ),
    );
  }

  if (!files.some((file) => file.path === "functions/api/recipe.ts")) {
    violations.push("functions/api/recipe.ts: approved recipe API function is missing");
  }

  const recipeFunction = files.find((file) => file.path === "functions/api/recipe.ts");
  if (!recipeFunction?.text.includes("context.env.AI.run(")) {
    violations.push("functions/api/recipe.ts: must use context.env.AI.run");
  }

  if (violations.length > 0) {
    throw new Error(`Function boundary guard failed:\n${violations.join("\n")}`);
  }
}

function assertPromptRulesStayOutOfUi(files: readonly TextFile[]): void {
  const allowedFiles = new Set(["src/prompt.ts", "src/data.ts"]);
  const promptRulePatterns = [
    /##\s+役割/,
    /###\s+(?:家にある食材・材料|食材・材料|使う材料|使い切りたい食材・材料|使えない・持っていない食材・調味料|調理時間|人数・分量)/,
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
  const forbiddenBehaviorSelectors = [
    ".combo",
    ".combo-input",
    ".combo-picker",
    ".suggestions",
    ".suggestion-option",
    ".pill",
    ".pill-label",
    ".pill-edit-input",
    ".pill-remove",
    "[data-combo=",
    "#output",
    "#conditionChips",
    ".serving-plus",
    ".serving-minus",
    ".serving-count",
    ".serving-stepper",
    ".serving-label",
    ".serving-adjust",
    ".custom-servings-panel",
    ".chips",
    ".ai-recipe-panel",
    ".mobile-ai-recipe-panel",
    ".ai-recipe-content",
    ".ai-recipe-error-message",
    ".action-button",
    "[data-serving-id=",
    "#customServingsPanel",
    "#generateRecipe",
    "#generateRecipeMobile",
    "#aiRecipePanel",
    "#aiRecipePanelMobile",
  ] as const;

  if (missingHooks.length > 0) {
    throw new Error(`Missing stable hook strings:\n${missingHooks.join("\n")}`);
  }

  if (!sourceText.includes("`mobile-${testId}`")) {
    throw new Error("Missing stable mobile recipe-candidate hook prefix generation.");
  }

  for (const hook of [
    "mobile-recipe-candidate-list",
    "mobile-recipe-candidate-select-b",
    "mobile-recipe-candidate-detail",
  ]) {
    if (!e2eText.includes(hook)) {
      throw new Error(`Missing mobile recipe-candidate E2E hook usage: ${hook}`);
    }
  }

  if (!e2eText.includes("getByTestId(") && !e2eText.includes("data-testid")) {
    throw new Error("E2E tests must use stable hooks for at least one behavior-critical flow.");
  }

  const selectorViolations = e2eFiles.flatMap((file) =>
    forbiddenBehaviorSelectors
      .filter((selector) => file.text.includes(selector))
      .map((selector) => `${file.path}: use stable hook or ARIA role instead of ${selector}`),
  );

  if (selectorViolations.length > 0) {
    throw new Error(
      `E2E behavior selectors must not depend on styling hooks:\n${selectorViolations.join("\n")}`,
    );
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
  it("keeps client network use limited to the approved recipe API", async () => {
    const sourceFiles = await collectFiles("src", (projectPath) => projectPath.endsWith(".ts"));
    assertClientNetworkBoundary(sourceFiles);
  });

  it("keeps Pages Functions limited to the approved Workers AI boundary", async () => {
    const hasFunctionsDirectory = await pathExists("functions");
    const functionFiles = hasFunctionsDirectory
      ? await collectFiles("functions", (projectPath) => projectPath.endsWith(".ts"))
      : [];
    assertApprovedFunctionBoundary(functionFiles);
  });

  it("keeps prompt output rules out of generic UI rendering modules", async () => {
    const sourceFiles = await collectFiles("src", (projectPath) => projectPath.endsWith(".ts"));
    const hasFunctionsDirectory = await pathExists("functions");
    const functionFiles = hasFunctionsDirectory
      ? await collectFiles("functions", (projectPath) => projectPath.endsWith(".ts"))
      : [];
    assertPromptRulesStayOutOfUi([...sourceFiles, ...functionFiles]);
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
  it("rejects unapproved client network/server additions", () => {
    expect(() =>
      assertClientNetworkBoundary([
        { path: "src/main.ts", text: 'import express from "express";\nfetch("/api/recipe");' },
      ]),
    ).toThrow(/Client network boundary guard failed/);
  });

  it("rejects unapproved function files", () => {
    expect(() =>
      assertApprovedFunctionBoundary([
        { path: "functions/api/other.ts", text: "export const onRequest = () => new Response();" },
      ]),
    ).toThrow(/Function boundary guard failed/);
  });

  it("rejects unapproved API endpoints in the client", () => {
    expect(() =>
      assertClientNetworkBoundary([
        { path: "src/ai-recipe-client.ts", text: 'fetcher("/api/recipe"); fetcher("/api/other");' },
      ]),
    ).toThrow(/unapproved API endpoint/);
  });

  it("rejects direct fetch to unapproved API endpoints in the approved client", () => {
    expect(() =>
      assertClientNetworkBoundary([
        { path: "src/ai-recipe-client.ts", text: 'fetcher("/api/recipe"); fetch("/api/other");' },
      ]),
    ).toThrow(/unapproved API endpoint/);
  });

  it("rejects direct fetch to the approved API endpoint in the approved client", () => {
    expect(() =>
      assertClientNetworkBoundary([
        {
          path: "src/ai-recipe-client.ts",
          text: 'fetcher("/api/recipe"); fetch("/api/recipe");',
        },
      ]),
    ).toThrow(/direct fetch call/);
  });

  it("rejects server-side fetch in the approved function", () => {
    expect(() =>
      assertApprovedFunctionBoundary([
        {
          path: "functions/api/recipe.ts",
          text: 'export const onRequest = () => fetch("https://example.test");',
        },
      ]),
    ).toThrow(/server fetch call/);
  });

  it("rejects prompt rules in UI rendering", () => {
    expect(() =>
      assertPromptRulesStayOutOfUi([
        { path: "src/ui.ts", text: 'const heading = "### 家にある食材・材料";' },
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
