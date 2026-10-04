import { spawnSync } from "node:child_process";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { FileSystemConfigLoader, HtmlValidate } from "html-validate/node";
import { afterEach, describe, expect, it } from "vitest";
import { parseDocument } from "yaml";

const projectRoot = process.cwd();
const temporaryDirectories: string[] = [];
const biomeCli = path.join(projectRoot, "node_modules/@biomejs/biome/bin/biome");
const documentsCli = path.join(projectRoot, "scripts/check-documents.mjs");

function runNode(args: string[], cwd = projectRoot) {
  const result = spawnSync(process.execPath, args, { cwd, encoding: "utf8", timeout: 20_000 });
  if (result.error) throw result.error;
  return { status: result.status, output: result.stdout + result.stderr };
}

async function fixture(files: Record<string, string>): Promise<string> {
  const directory = await mkdtemp(path.join(tmpdir(), "arimono-quality-"));
  temporaryDirectories.push(directory);
  for (const [name, content] of Object.entries(files)) {
    const file = path.join(directory, name);
    await mkdir(path.dirname(file), { recursive: true });
    await writeFile(file, content);
  }
  return directory;
}

async function biomeFixture(files: Record<string, string>): Promise<string> {
  const config = JSON.parse(
    await readFile(process.env["QUALITY_BASELINE_CONFIG"] ?? "biome.json", "utf8"),
  ) as Record<string, unknown>;
  // Isolated files have no Git checkout; keep the project's actual scopes and rules.
  config["vcs"] = { enabled: false };
  return fixture({
    "biome.json": JSON.stringify(config),
    "tsconfig.json": await readFile("tsconfig.json", "utf8"),
    ...files,
  });
}

afterEach(async () => {
  await Promise.all(
    temporaryDirectories
      .splice(0)
      .map((directory) => rm(directory, { recursive: true, force: true })),
  );
});

describe("quality gate negative controls", () => {
  it("keeps warnings fatal in the actual npm gates", async () => {
    const directory = await mkdtemp(path.join(projectRoot, ".quality-warning-"));
    temporaryDirectories.push(directory);
    await writeFile(
      path.join(directory, "probe.ts"),
      "export const read = (value?: { name: string }) => value && value.name;\n",
    );
    for (const script of ["lint", "format:check"]) {
      const result = spawnSync("npm", ["run", script], {
        cwd: projectRoot,
        encoding: "utf8",
        timeout: 30_000,
      });
      if (result.error) throw result.error;
      expect(result.status, result.stdout + result.stderr).toBe(1);
      expect(result.stdout + result.stderr).toContain("useOptionalChain");
      expect(result.stdout + result.stderr).toContain(`${path.basename(directory)}/probe.ts`);
    }
  });

  it("checks maintenance JavaScript through the actual npm typecheck gate", async () => {
    const directory = await mkdtemp(path.join(projectRoot, "scripts/quality-type-"));
    temporaryDirectories.push(directory);
    await writeFile(path.join(directory, "probe.mjs"), "export const read = (value) => value;\n");
    const result = spawnSync("npm", ["run", "typecheck"], {
      cwd: projectRoot,
      encoding: "utf8",
      timeout: 30_000,
    });
    if (result.error) throw result.error;
    expect(result.status, result.stdout + result.stderr).toBe(1);
    expect(result.stdout + result.stderr).toContain("TS7006");
    expect(result.stdout + result.stderr).toContain("probe.mjs");
  });

  it.each([
    {
      name: "missing side-effect modules",
      code: "TS2882",
      filename: "probe.ts",
      source: 'import "./missing.js";\nexport {};\n',
    },
    {
      name: "type imports requiring import type",
      code: "TS1484",
      filename: "probe.ts",
      source: 'import { Value } from "./value";\nexport const value: Value = { name: "a" };\n',
    },
    {
      name: "unreachable code",
      code: "TS7027",
      filename: "probe.ts",
      source: "export function run(): number { return 1; return 2; }\n",
    },
    {
      name: "unused labels",
      code: "TS7028",
      filename: "probe.ts",
      source: "export function run(): number { unused: { return 1; } }\n",
    },
    {
      name: "untyped JavaScript",
      code: "TS7006",
      filename: "probe.js",
      source: "export const read = (value) => value;\n",
    },
    {
      name: "invalid declaration files",
      code: "TS2304",
      filename: "probe.ts",
      source: 'import type { Broken } from "./broken";\nexport type Value = Broken;\n',
    },
  ])("rejects $name through the real TypeScript CLI", async ({ code, filename, source }) => {
    const directory = await fixture({
      "tsconfig.json": JSON.stringify({
        extends: process.env["QUALITY_BASELINE_TSC"] ?? path.join(projectRoot, "tsconfig.json"),
        compilerOptions: { types: [] },
        include: [filename],
      }),
      [filename]: source,
      "value.ts": "export interface Value { name: string; }\n",
      "broken.d.ts": "export type Broken = MissingType;\n",
    });
    const result = runNode([
      path.join(projectRoot, "node_modules/typescript/bin/tsc"),
      "--noEmit",
      "-p",
      directory,
    ]);
    expect(result.status, result.output).toBe(1);
    expect(result.output).toContain(code);
  });

  it.each([
    {
      name: "floating promises",
      rule: "noFloatingPromises",
      source:
        "async function load(): Promise<void> { await Promise.resolve(); }\nload();\nexport {};\n",
    },
    {
      name: "async void callbacks",
      rule: "noMisusedPromises",
      source:
        "function call(fn: () => void): void { fn(); }\ncall(async () => { await Promise.resolve(); });\nexport {};\n",
    },
    {
      name: "awaiting non-thenables",
      rule: "useAwaitThenable",
      source: "export async function load(): Promise<void> { await 123; }\n",
    },
    {
      name: "skipped tests",
      rule: "noSkippedTests",
      source: 'import { test } from "@playwright/test";\ntest.skip("hidden", () => {});\n',
    },
    {
      name: "focused tests",
      rule: "noFocusedTests",
      source: 'import { test } from "@playwright/test";\ntest.only("hidden", () => {});\n',
    },
    {
      name: "Node imports in browsers",
      rule: "noNodejsModules",
      source: 'import fs from "node:fs";\nexport { fs };\n',
    },
    {
      name: "Node globals in browsers",
      rule: "noRestrictedGlobals",
      source: "export const runtime = process.version;\n",
    },
    {
      name: "CSS typos",
      rule: "noUnknownProperty",
      filename: "src/probe.css",
      source: ".probe { colr: red; }\n",
    },
    {
      name: "developer JavaScript",
      rule: "noUnusedVariables",
      filename: "scripts/probe.mjs",
      source: "const unused = 1;\n",
    },
    {
      name: "recommended warnings",
      rule: "useOptionalChain",
      source: "export const read = (value?: { name: string }) => value && value.name;\n",
    },
  ])("rejects $name through the real Biome CLI", async ({ rule, source, filename }) => {
    const file = filename ?? "src/probe.ts";
    const directory = await biomeFixture({ [file]: source });
    const result = runNode(
      [biomeCli, "lint", "--error-on-warnings", "--diagnostic-level=warn", file],
      directory,
    );
    expect(result.status, result.output).toBe(1);
    expect(result.output).toContain(rule);
    expect(result.output).toContain("Checked 1 file");
  });

  it("accepts handled promises and valid thenables, including imported async functions", async () => {
    const directory = await biomeFixture({
      "src/load.ts": "export async function load(): Promise<void> { await Promise.resolve(); }\n",
      "src/probe.ts":
        'import { load } from "./load";\ndeclare const thenable: PromiseLike<number>;\nexport async function run(): Promise<void> { await thenable; await load(); }\n',
    });
    const result = runNode(
      [biomeCli, "lint", "--error-on-warnings", "--diagnostic-level=warn", "src"],
      directory,
    );
    expect(result.status, result.output).toBe(0);
    expect(result.output).toContain("Checked 2 files");
  });

  it.each([
    ['<button type="button"><a href="/">link</a></button>', "element-permitted-content"],
    ['<input type="text">', "input-missing-label"],
    ['<button type="button" aria-controls="missing">open</button>', "no-missing-references"],
    ['<div aria-label="group">content</div>', "aria-label-misuse"],
    ['<button type="button" onclick="alert(1)">run</button>', "project/no-inline-script"],
    ['<svg onload="alert(1)"></svg>', "project/no-inline-script"],
    ['<a href="javascript:alert(1)">run</a>', "project/no-inline-script"],
    ['<a href="java&#115;cript:alert(1)">run</a>', "project/no-inline-script"],
    ['<a href="javascript&#58;alert(1)">run</a>', "project/no-inline-script"],
    ['<a href="java\tscript:alert(1)">run</a>', "project/no-inline-script"],
    ["<script>alert(1)</script>", "element-required-attributes"],
    [`<${"style"}>.probe { color: red; }</${"style"}>`, "no-style-tag"],
  ])("rejects invalid or inline executable HTML: %s", async (source, rule) => {
    const validator = new HtmlValidate(new FileSystemConfigLoader());
    const report = await validator.validateString(source, path.join(projectRoot, "index.html"));
    expect(report.valid).toBe(false);
    expect(
      report.results.flatMap((result) => result.messages.map((message) => message.ruleId)),
    ).toContain(rule);
  });

  it("accepts labelled native and ARIA controls", async () => {
    const validator = new HtmlValidate(new FileSystemConfigLoader());
    const report = await validator.validateString(
      '<div role="group" aria-label="人数"><label>大人<input type="number"></label><input type="text" aria-label="材料"></div>',
      path.join(projectRoot, "index.html"),
    );
    expect(report.valid, JSON.stringify(report.results)).toBe(true);
  });

  it("loads the same HTML policy through the file-based CLI", async () => {
    const directory = await fixture({
      "bad.html": '<button type="button" onclick="alert(1)">run</button>',
      "good.html": '<input type="text" aria-label="材料">',
    });
    const cli = path.join(projectRoot, "node_modules/html-validate/bin/html-validate.mjs");
    const args = [
      cli,
      "--config",
      path.join(projectRoot, ".htmlvalidate.json"),
      "--max-warnings",
      "0",
    ];
    const bad = runNode([...args, path.join(directory, "bad.html")]);
    expect(bad.status, bad.output).toBe(1);
    expect(bad.output).toContain("project/no-inline-script");
    const good = runNode([...args, path.join(directory, "good.html")]);
    expect(good.status, good.output).toBe(0);
  });

  it("rejects malformed Markdown even when inline disable comments are present", async () => {
    const directory = await fixture({
      "bad.md": "<!-- markdownlint-disable -->\n#Missing space\n",
    });
    const result = runNode([documentsCli, "markdown", path.join(directory, "bad.md")]);
    expect(result.status).toBe(1);
    expect(result.output).toContain("MD018");
  });

  it.each([
    ["on: [\n", "BAD_INDENT"],
    ["jobs:\n  check: {}\n  check: {}\n", "DUPLICATE_KEY"],
    ["value: *missing\n", "Unresolved alias"],
  ])("rejects invalid YAML without writing it (%s)", async (source, diagnostic) => {
    const directory = await fixture({ "bad.yml": source });
    const file = path.join(directory, "bad.yml");
    const result = runNode([documentsCli, "yaml", "--write", file]);
    expect(result.status, result.output).toBe(1);
    expect(result.output).toContain(diagnostic);
    expect(result.output).toContain(file);
    expect(await readFile(file, "utf8")).toBe(source);
  });

  it("formats disjoint file types without fix loops or YAML value changes", async () => {
    const directory = await biomeFixture({
      "src/probe.ts": 'export const value={name:"材料"}\n',
      "settings/config.json": '{"name":"材料","count":2}\n',
      "tests/fixture.html":
        '<!DOCTYPE html><html lang="ja"><head><title>材料</title></head><body><input type="text" aria-label="材料"></body></html>\n',
      "docs/probe.md": "# Title\ntext\n- value\n\n|A|B|\n|---|---|\n|1|2|\n",
      "workflow.yml":
        // biome-ignore lint/suspicious/noTemplateCurlyInString: preserve a literal Actions expression through YAML formatting.
        '# Workflow\non: [push, pull_request]\njobs:\n  check:\n    steps:\n    - run: |\n        echo "${{ github.ref }}"\n',
    });
    const formattedFiles = [
      "src/probe.ts",
      "settings/config.json",
      "tests/fixture.html",
      "docs/probe.md",
      "workflow.yml",
    ];
    const yamlFile = path.join(directory, "workflow.yml");
    const originalYaml = parseDocument(await readFile(yamlFile, "utf8")).toJS();
    const format = () => {
      const biome = runNode(
        [biomeCli, "check", "--write", "--error-on-warnings", ...formattedFiles.slice(0, 3)],
        directory,
      );
      expect(biome.status, biome.output).toBe(0);
      for (const [kind, file] of [
        ["markdown", "docs/probe.md"],
        ["yaml", "workflow.yml"],
      ]) {
        const result = runNode([
          documentsCli,
          kind ?? "",
          "--write",
          path.join(directory, file ?? ""),
        ]);
        expect(result.status, result.output).toBe(0);
      }
    };
    format();
    const first = await Promise.all(
      formattedFiles.map((file) => readFile(path.join(directory, file), "utf8")),
    );
    format();
    expect(
      await Promise.all(formattedFiles.map((file) => readFile(path.join(directory, file), "utf8"))),
    ).toEqual(first);
    expect(parseDocument(await readFile(yamlFile, "utf8")).toJS()).toEqual(originalYaml);
    expect(await readFile(yamlFile, "utf8")).toContain("# Workflow");
    const checked = runNode(
      [biomeCli, "ci", "--error-on-warnings", ...formattedFiles.slice(0, 3)],
      directory,
    );
    expect(checked.status, checked.output).toBe(0);
    const validator = new HtmlValidate(new FileSystemConfigLoader());
    const html = await validator.validateString(
      await readFile(path.join(directory, "tests/fixture.html"), "utf8"),
      path.join(projectRoot, "index.html"),
    );
    expect(html.valid, JSON.stringify(html.results.flatMap((result) => result.messages))).toBe(
      true,
    );
    for (const [kind, file] of [
      ["markdown", "docs/probe.md"],
      ["yaml", "workflow.yml"],
    ]) {
      const result = runNode([documentsCli, kind ?? "", path.join(directory, file ?? "")]);
      expect(result.status, result.output).toBe(0);
    }
  });
});
