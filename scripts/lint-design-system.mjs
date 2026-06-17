#!/usr/bin/env node

import { readdir, readFile } from "node:fs/promises";
import path from "node:path";

const projectRoot = process.cwd();
const designPath = path.join(projectRoot, "DESIGN.md");
const stylesPath = path.join(projectRoot, "src/styles.css");
const expectedCssPath = "src/styles.css";
const sourceComment = "Source of truth: DESIGN.md";

const ignoredDirectories = new Set([
  ".git",
  "coverage",
  "dist",
  "node_modules",
  "playwright-report",
  "test-results",
]);

const oldTokens = [
  "--bg",
  "--bg-accent",
  "--bg-accent-2",
  "--card",
  "--text",
  "--accent",
  "--accent-dark",
  "--accent-deep",
  "--shadow",
  "--inner",
  "--radius",
];

const checkedTextExtensions = new Set([".html", ".js", ".jsx", ".mjs", ".ts", ".tsx"]);
const colorFunctionNames = [
  "rgb",
  "rgba",
  "hsl",
  "hsla",
  "hwb",
  "lab",
  "lch",
  "oklab",
  "oklch",
  "color",
  "color-mix",
];
const gradientFunctionNames = [
  "linear-gradient",
  "radial-gradient",
  "conic-gradient",
  "repeating-linear-gradient",
  "repeating-radial-gradient",
  "repeating-conic-gradient",
];
const cssWideKeywords = new Set([
  "inherit",
  "initial",
  "revert",
  "revert-layer",
  "unset",
]);
const styleTagPattern = new RegExp("<" + "style[\\s>]", "i");
const inlineStyleAttributePattern = new RegExp("\\s" + "style\\s*=");
const domStyleMutationPattern = new RegExp("\\." + "style\\b");
const styleSetAttributePattern = new RegExp("setAttribute\\s*\\(\\s*[\"']" + "style[\"']", "i");
const safeDesignKeywords = new Set([
  "auto",
  "currentcolor",
  "transparent",
  "solid",
  "dashed",
  "dotted",
  "double",
  "none",
  "normal",
  "ease",
  "ease-in",
  "ease-out",
  "ease-in-out",
  "linear",
  "forwards",
  "backwards",
  "both",
  "infinite",
  "alternate",
  "running",
  "paused",
]);
const cssNamedColors = new Set([
  "aliceblue",
  "antiquewhite",
  "aqua",
  "aquamarine",
  "azure",
  "beige",
  "bisque",
  "black",
  "blanchedalmond",
  "blue",
  "blueviolet",
  "brown",
  "burlywood",
  "cadetblue",
  "chartreuse",
  "chocolate",
  "coral",
  "cornflowerblue",
  "cornsilk",
  "crimson",
  "cyan",
  "darkblue",
  "darkcyan",
  "darkgoldenrod",
  "darkgray",
  "darkgreen",
  "darkgrey",
  "darkkhaki",
  "darkmagenta",
  "darkolivegreen",
  "darkorange",
  "darkorchid",
  "darkred",
  "darksalmon",
  "darkseagreen",
  "darkslateblue",
  "darkslategray",
  "darkslategrey",
  "darkturquoise",
  "darkviolet",
  "deeppink",
  "deepskyblue",
  "dimgray",
  "dimgrey",
  "dodgerblue",
  "firebrick",
  "floralwhite",
  "forestgreen",
  "fuchsia",
  "gainsboro",
  "ghostwhite",
  "gold",
  "goldenrod",
  "gray",
  "green",
  "greenyellow",
  "grey",
  "honeydew",
  "hotpink",
  "indianred",
  "indigo",
  "ivory",
  "khaki",
  "lavender",
  "lavenderblush",
  "lawngreen",
  "lemonchiffon",
  "lightblue",
  "lightcoral",
  "lightcyan",
  "lightgoldenrodyellow",
  "lightgray",
  "lightgreen",
  "lightgrey",
  "lightpink",
  "lightsalmon",
  "lightseagreen",
  "lightskyblue",
  "lightslategray",
  "lightslategrey",
  "lightsteelblue",
  "lightyellow",
  "lime",
  "limegreen",
  "linen",
  "magenta",
  "maroon",
  "mediumaquamarine",
  "mediumblue",
  "mediumorchid",
  "mediumpurple",
  "mediumseagreen",
  "mediumslateblue",
  "mediumspringgreen",
  "mediumturquoise",
  "mediumvioletred",
  "midnightblue",
  "mintcream",
  "mistyrose",
  "moccasin",
  "navajowhite",
  "navy",
  "oldlace",
  "olive",
  "olivedrab",
  "orange",
  "orangered",
  "orchid",
  "palegoldenrod",
  "palegreen",
  "paleturquoise",
  "palevioletred",
  "papayawhip",
  "peachpuff",
  "peru",
  "pink",
  "plum",
  "powderblue",
  "purple",
  "rebeccapurple",
  "red",
  "rosybrown",
  "royalblue",
  "saddlebrown",
  "salmon",
  "sandybrown",
  "seagreen",
  "seashell",
  "sienna",
  "silver",
  "skyblue",
  "slateblue",
  "slategray",
  "slategrey",
  "snow",
  "springgreen",
  "steelblue",
  "tan",
  "teal",
  "thistle",
  "tomato",
  "transparent",
  "turquoise",
  "violet",
  "wheat",
  "white",
  "whitesmoke",
  "yellow",
  "yellowgreen",
]);

async function main() {
  const [designText, stylesText, projectFiles] = await Promise.all([
    readFile(designPath, "utf8").catch(() => {
      throw new Error("DESIGN.md is missing from the repository root.");
    }),
    readFile(stylesPath, "utf8"),
    collectProjectFiles(projectRoot),
  ]);

  const cssFiles = projectFiles.filter((file) => file.endsWith(".css"));
  const unexpectedCssFiles = cssFiles.filter((file) => file !== expectedCssPath);
  if (unexpectedCssFiles.length > 0) {
    throw new Error(`Only ${expectedCssPath} may define CSS:\n${unexpectedCssFiles.join("\n")}`);
  }

  await assertNoInlineStyles(projectFiles);
  assertSourceComment(stylesText);
  assertNoOldTokens(stylesText);
  assertKnownCustomProperties(stylesText, designText);
  assertKnownCustomPropertyValues(stylesText, designText);
  assertKnownRawColors(stylesText, designText);
  assertKnownGradients(stylesText, designText);
  assertKnownFontFamilies(stylesText, designText);
  assertKnownDesignValues(stylesText, designText);
  assertGeneratedPromptIsNotMonospace(stylesText);
}

async function collectProjectFiles(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const files = await Promise.all(
    entries.flatMap((entry) => {
      if (ignoredDirectories.has(entry.name)) return [];

      const absolutePath = path.join(directory, entry.name);
      if (entry.isDirectory()) return collectProjectFiles(absolutePath);
      if (!entry.isFile()) return [];

      return [path.relative(projectRoot, absolutePath).split(path.sep).join("/")];
    }),
  );

  return files.flat();
}

async function assertNoInlineStyles(projectFiles) {
  const violations = [];
  const filesToCheck = projectFiles.filter((file) => checkedTextExtensions.has(path.extname(file)));

  for (const file of filesToCheck) {
    const text = await readFile(path.join(projectRoot, file), "utf8");
    if (styleTagPattern.test(text)) {
      violations.push(`${file}: <${"style"}> tag`);
    }
    if (inlineStyleAttributePattern.test(text)) {
      violations.push(`${file}: inline style attribute`);
    }
    if (domStyleMutationPattern.test(text)) {
      violations.push(`${file}: DOM style mutation`);
    }
    if (styleSetAttributePattern.test(text)) {
      violations.push(`${file}: style attribute mutation`);
    }
  }

  if (violations.length > 0) {
    throw new Error(`Inline CSS is not allowed:\n${violations.join("\n")}`);
  }
}

function assertSourceComment(stylesText) {
  if (!stylesText.slice(0, 240).includes(sourceComment)) {
    throw new Error(`src/styles.css must start with a ${JSON.stringify(sourceComment)} comment.`);
  }
}

function assertNoOldTokens(stylesText) {
  const violations = oldTokens.filter((token) =>
    new RegExp(`${escapeRegExp(token)}(?![a-z0-9-])`, "i").test(stylesText),
  );
  if (violations.length > 0) {
    throw new Error(`Old CSS tokens are not allowed:\n${violations.join("\n")}`);
  }
}

function assertKnownCustomProperties(stylesText, designText) {
  const allowed = new Set([...designText.matchAll(/--[a-z0-9-]+(?=\s*:)/gi)].map(([token]) => token));
  const used = new Set([...stylesText.matchAll(/--[a-z0-9-]+/gi)].map(([token]) => token));
  const unknown = [...used].filter((token) => !allowed.has(token));

  if (unknown.length > 0) {
    throw new Error(`CSS custom properties must be declared in DESIGN.md:\n${unknown.join("\n")}`);
  }
}

function assertKnownCustomPropertyValues(stylesText, designText) {
  const designTokens = extractCustomPropertyDeclarations(designText);
  const styleTokens = extractCustomPropertyDeclarations(stylesText);
  const violations = [];

  for (const [token, value] of styleTokens) {
    const allowedValue = designTokens.get(token);
    if (!allowedValue) continue;
    if (normalizeDeclarationValue(value) !== normalizeDeclarationValue(allowedValue)) {
      violations.push(`${token}: ${value} (expected ${allowedValue})`);
    }
  }

  if (violations.length > 0) {
    throw new Error(`CSS token values must match DESIGN.md exactly:\n${violations.join("\n")}`);
  }
}

function assertKnownRawColors(stylesText, designText) {
  const allowed = new Set(extractColors(designText).map(normalizeCompact));
  const unknown = extractColors(stylesText).filter((color) => !allowed.has(normalizeCompact(color)));

  if (unknown.length > 0) {
    throw new Error(`Raw colors must come from DESIGN.md:\n${[...new Set(unknown)].join("\n")}`);
  }
}

function assertKnownGradients(stylesText, designText) {
  const allowed = new Set(extractGradientCalls(designText).map(normalizeSnippet));
  const unknown = extractGradientCalls(stylesText).filter(
    (gradient) => !allowed.has(normalizeSnippet(gradient)),
  );

  if (unknown.length > 0) {
    throw new Error(`Gradients must be copied from DESIGN.md examples:\n${unknown.join("\n")}`);
  }
}

function assertKnownFontFamilies(stylesText, designText) {
  const allowedFonts = new Set(
    [...designText.matchAll(/--font-[a-z-]+:\s*([^;]+);/g)].map((match) =>
      normalizeSnippet(match[1] ?? ""),
    ),
  );
  const unknown = [];

  for (const declaration of extractCssDeclarations(stylesText, { includeCustomProperties: true })) {
    if (declaration.property === "font-family" || declaration.property.startsWith("--font-")) {
      const value = normalizeSnippet(declaration.value);
      if (value.startsWith("var(")) continue;
      if (!allowedFonts.has(value)) {
        unknown.push(`${declaration.property}: ${value}`);
      }
    }

    if (declaration.property === "font") {
      const rawFonts = extractFontFamilyCandidates(declaration.value);
      for (const font of rawFonts) {
        const value = normalizeSnippet(font);
        if (cssWideKeywords.has(value.toLowerCase())) continue;
        if (value.startsWith("var(")) continue;
        if (!isAllowedFontToken(value, allowedFonts)) {
          unknown.push(`${declaration.property}: ${value}`);
        }
      }
    }
  }

  if (unknown.length > 0) {
    throw new Error(`Font families must come from DESIGN.md:\n${[...new Set(unknown)].join("\n")}`);
  }
}

function assertKnownDesignValues(stylesText, designText) {
  const allowed = new Set([...extractScalarValues(designText), "0", "none"]);
  const violations = [];

  for (const declaration of extractCssDeclarations(stylesText)) {
    if (!shouldCheckDesignValue(declaration.property)) continue;
    const values = extractScalarValues(declaration.value);
    const unknown = values.filter((value) => !allowed.has(value));
    if (unknown.length > 0) {
      violations.push(`${declaration.property}: ${declaration.value} -> ${unknown.join(", ")}`);
    }
  }

  if (violations.length > 0) {
    throw new Error(
      `Spacing, radius, shadow, type, and motion values must come from DESIGN.md:\n${violations.join(
        "\n",
      )}`,
    );
  }
}

function assertGeneratedPromptIsNotMonospace(stylesText) {
  const violations = [];
  let outputUsesSans = false;

  for (const rule of extractCssRules(stylesText)) {
    const targetsPrompt = targetsGeneratedPromptSurface(rule.selector);
    const targetsPromptAncestor = targetsGeneratedPromptAncestor(rule.selector);
    if (!targetsPrompt && !targetsPromptAncestor) continue;
    for (const declaration of rule.declarations) {
      if (!["font", "font-family"].includes(declaration.property)) continue;
      if (/(?:var\(--font-mono\)|monospace|ui-monospace|sfmono|jetbrains mono|cascadia code)/i.test(declaration.value)) {
        violations.push(`${rule.selector}: ${declaration.property}`);
      }
      if (
        targetsPrompt &&
        declaration.property === "font-family" &&
        normalizeDeclarationValue(declaration.value) === "var(--font-sans)"
      ) {
        outputUsesSans = true;
      }
    }
  }

  if (violations.length > 0) {
    throw new Error("Generated prompt output must use the DESIGN.md sans-serif reading surface.");
  }
  if (!outputUsesSans) {
    throw new Error("Generated prompt output must explicitly declare font-family: var(--font-sans).");
  }
}

function extractColors(text) {
  return [
    ...text.matchAll(/#(?:[0-9a-fA-F]{3,8})\b/g),
    ...extractFunctionCalls(text, colorFunctionNames).map((color) => [color]),
    ...extractNamedColors(text).map((color) => [color]),
  ].map(([color]) => color);
}

function extractGradientCalls(text) {
  return extractFunctionCalls(text, gradientFunctionNames);
}

function extractScalarValues(text) {
  return [
    ...text.matchAll(/-?\d*\.?\d+(?:px|rem|em|vw|vh|dvh|dvb|%|ms|s)\b/g),
  ].map(([value]) => value);
}

function extractCssDeclarations(stylesText, options = {}) {
  return extractCssRules(stylesText).flatMap((rule) =>
    rule.declarations.filter(
      (declaration) => options.includeCustomProperties || !declaration.property.startsWith("--"),
    ),
  );
}

function extractCssRules(stylesText) {
  const rules = [];
  const rulePattern = /([^{}]+)\{([^{}]*)\}/g;
  for (const match of stylesText.matchAll(rulePattern)) {
    const selector = normalizeSnippet(match[1] ?? "");
    const body = match[2] ?? "";
    if (!selector || selector.startsWith("@")) continue;
    const declarations = [];
    for (const declaration of body.split(";")) {
      const separator = declaration.indexOf(":");
      if (separator === -1) continue;
      const property = declaration.slice(0, separator).trim().toLowerCase();
      const value = declaration.slice(separator + 1).trim();
      if (!property || !value) continue;
      declarations.push({ property, value });
    }
    rules.push({ selector, declarations });
  }
  return rules;
}

function extractCustomPropertyDeclarations(text) {
  const declarations = new Map();
  for (const match of text.matchAll(/(--[a-z0-9-]+)\s*:\s*([^;]+);/gi)) {
    declarations.set(match[1] ?? "", (match[2] ?? "").trim());
  }
  return declarations;
}

function shouldCheckDesignValue(property) {
  return /(?:margin|padding|gap|inset|top|right|bottom|left|width|height|size|radius|shadow|border|outline|font-size|line-height|letter-spacing|transition|animation|translate|transform|block|inline)/.test(
    property,
  );
}

function extractFunctionCalls(text, functionNames) {
  const calls = [];
  const namePattern = functionNames.map(escapeRegExp).join("|");
  const functionStart = new RegExp(`\\b(?:${namePattern})\\(`, "gi");

  for (const match of text.matchAll(functionStart)) {
    const start = match.index ?? 0;
    const call = readBalancedFunctionCall(text, start);
    if (call) calls.push(call);
  }

  return calls;
}

function readBalancedFunctionCall(text, start) {
  let depth = 0;
  for (let index = start; index < text.length; index += 1) {
    const character = text[index];
    if (character === "(") depth += 1;
    if (character === ")") depth -= 1;
    if (depth === 0) {
      return text.slice(start, index + 1);
    }
  }
  return "";
}

function extractNamedColors(text) {
  const colors = [];
  for (const declaration of extractCssDeclarations(text, { includeCustomProperties: true })) {
    for (const word of declaration.value.matchAll(/\b[a-z][a-z-]*\b/gi)) {
      const value = word[0].toLowerCase();
      if (cssNamedColors.has(value)) colors.push(value);
    }
  }
  return colors;
}

function extractFontFamilyCandidates(value) {
  return splitFontFamilyList(extractFontShorthandFamilyList(value));
}

function extractFontShorthandFamilyList(value) {
  const shorthand = normalizeSnippet(value);
  const sizePattern =
    "(?:xx-small|x-small|small|medium|large|x-large|xx-large|larger|smaller|-?\\d*\\.?\\d+(?:px|rem|em|vw|vh|dvh|dvb|%)|var\\([^)]*\\)|clamp\\([^)]*\\))";
  const match = shorthand.match(new RegExp(`${sizePattern}(?:\\s*/\\s*\\S+)?\\s+(.+)$`, "i"));
  return match?.[1]?.trim() ?? shorthand;
}

function splitFontFamilyList(value) {
  const fonts = [];
  let current = "";
  let quote = "";

  for (const character of value) {
    if ((character === '"' || character === "'") && !quote) {
      quote = character;
      current += character;
      continue;
    }
    if (character === quote) {
      quote = "";
      current += character;
      continue;
    }
    if (character === "," && !quote) {
      if (current.trim()) fonts.push(current.trim());
      current = "";
      continue;
    }
    current += character;
  }
  if (current.trim()) fonts.push(current.trim());

  const generic = [...value.matchAll(/\b(?:system-ui|-apple-system|BlinkMacSystemFont|serif|sans-serif|ui-monospace|monospace)\b/g)].map(
    ([font]) => font,
  );
  return [...new Set([...fonts, ...generic])];
}

function isAllowedFontToken(value, allowedFonts) {
  return [...allowedFonts].some((fontList) =>
    fontList
      .split(",")
      .map((font) => normalizeSnippet(font))
      .includes(value),
  );
}

function targetsGeneratedPromptSurface(selector) {
  return /(?:^|[\s>+~#,.:])(?:\.output|#output|#mobileOutput|\.prompt-section|\.output-shell|textarea)(?:$|[\s>+~#,.:[])/.test(
    selector,
  );
}

function targetsGeneratedPromptAncestor(selector) {
  return /(?:^|[\s>+~#,.:])(?::root|html|body|#app|\*)(?:$|[\s>+~#,.:[])/.test(selector);
}

function normalizeDeclarationValue(value) {
  return normalizeCompact(
    normalizeSnippet(value)
      .replace(/\s*,\s*/g, ", ")
      .replace(/\s*\/\s*/g, " / ")
      .replace(/\s+!important$/i, ""),
  );
}

function normalizeSnippet(value) {
  return value.replace(/\s+/g, " ").trim();
}

function normalizeCompact(value) {
  return value
    .replace(/\s+/g, "")
    .toLowerCase()
    .replace(/(\d+\.\d*?[1-9])0+(?=[,)])/g, "$1")
    .replace(/(\d+)\.0+(?=[,)])/g, "$1");
}

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
