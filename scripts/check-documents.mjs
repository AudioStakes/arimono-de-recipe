import { readdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { isDeepStrictEqual } from "node:util";
import { applyFixes } from "markdownlint";
import { lint, readConfig } from "markdownlint/promise";
import { parseDocument } from "yaml";

const ignoredDirectories = new Set([
  ".git",
  "node_modules",
  "dist",
  "coverage",
  "playwright-report",
  "test-results",
  ".wrangler",
  ".serena",
]);

/**
 * @param {string} directory
 * @param {RegExp} extension
 * @returns {Promise<string[]>}
 */
async function collectFiles(directory, extension) {
  const entries = await readdir(directory, { withFileTypes: true });
  const files = await Promise.all(
    entries.map(async (entry) => {
      const file = path.join(directory, entry.name);
      if (entry.isDirectory()) {
        return ignoredDirectories.has(entry.name) ? [] : collectFiles(file, extension);
      }
      return entry.isFile() && extension.test(entry.name) ? [file] : [];
    }),
  );
  return files.flat().sort();
}

/**
 * @param {string} source
 * @param {string} file
 */
function parseYaml(source, file) {
  const document = parseDocument(source, { strict: true, uniqueKeys: true });
  const diagnostics = [...document.errors, ...document.warnings];
  if (diagnostics.length > 0) {
    throw new Error(
      `${file}: ${diagnostics.map((diagnostic) => `${diagnostic.code}: ${diagnostic.message}`).join("\n")}`,
    );
  }
  // Resolve aliases as well, with the library's bounded alias expansion.
  try {
    document.toJS();
  } catch (error) {
    throw new Error(`${file}: ${error instanceof Error ? error.message : String(error)}`);
  }
  return document;
}

/**
 * @param {string} file
 * @param {import("markdownlint").LintError[]} errors
 */
function markdownDiagnostics(file, errors) {
  return errors
    .map(
      (error) =>
        `${file}:${error.lineNumber} ${error.ruleNames[0]} ${error.ruleDescription}${error.errorDetail ? ` (${error.errorDetail})` : ""}`,
    )
    .join("\n");
}

async function main() {
  const [kind, ...args] = process.argv.slice(2);
  if (kind !== "markdown" && kind !== "yaml") {
    throw new Error("Usage: check-documents.mjs <markdown|yaml> [--write] [files...]");
  }
  const write = args[0] === "--write";
  const paths = write ? args.slice(1) : args;
  const files =
    paths.length > 0
      ? paths
      : await collectFiles(process.cwd(), kind === "yaml" ? /\.ya?ml$/i : /\.md$/i);
  if (files.length === 0) throw new Error(`No ${kind} files found.`);
  const config = kind === "markdown" ? await readConfig(".markdownlint.json") : undefined;
  for (const file of files) {
    const source = await readFile(file, "utf8");
    let formatted = source;
    if (kind === "yaml") {
      const document = parseYaml(source, file);
      formatted = document.toString({ indent: 2, lineWidth: 100 });
      if (!isDeepStrictEqual(document.toJS(), parseYaml(formatted, file).toJS())) {
        throw new Error(`${file}: YAML formatting changed the parsed value.`);
      }
    } else {
      const results = await lint({ strings: { [file]: source }, config, noInlineConfig: true });
      const errors = results[file] ?? [];
      if (write) formatted = applyFixes(source, errors);
      else if (errors.length > 0) throw new Error(markdownDiagnostics(file, errors));
    }
    if (source !== formatted) {
      if (write) await writeFile(file, formatted);
      else throw new Error(`${file}: formatting differs. Run npm run format:${kind}.`);
    }
    if (kind === "markdown" && write) {
      const results = await lint({ strings: { [file]: formatted }, config, noInlineConfig: true });
      if ((results[file] ?? []).length > 0)
        throw new Error(markdownDiagnostics(file, results[file] ?? []));
    }
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
