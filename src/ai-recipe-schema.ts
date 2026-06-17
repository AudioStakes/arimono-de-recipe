import type {
  AiRecipeCandidate,
  AiRecipeCandidateBadge,
  AiRecipeCandidateRequest,
  AiRecipeCandidatesResponse,
  AiRecipeMaterialInput,
} from "./types";

export const aiRecipeCandidateLimits = {
  request: {
    maxMaterials: 12,
    maxDirections: 5,
    maxTools: 8,
    maxAvoid: 8,
    maxNotesLength: 180,
    maxItemLength: 80,
    maxServingsLength: 80,
    maxTimeLength: 40,
    maxCompactUserContentLength: 1800,
  },
  response: {
    targetItems: 3,
    maxTitleLength: 32,
    maxWhyLength: 80,
    maxIngredients: 6,
    maxSteps: 3,
    maxBadges: 4,
    maxUse: 12,
    maxMissing: 6,
    maxListItemLength: 48,
    maxStepLength: 60,
    minTime: 1,
    maxTime: 240,
  },
} as const;

const allowedBadges = [
  "no_shop",
  "miss_optional",
  "quick",
  "easy",
  "uses_up",
  "few_dishes",
  "kids",
] as const satisfies readonly AiRecipeCandidateBadge[];

export const aiRecipeAssumedPantryIngredients = [
  "油",
  "ごま油",
  "オリーブオイル",
  "塩",
  "こしょう",
  "胡椒",
  "砂糖",
  "しょうゆ",
  "醤油",
  "みそ",
  "味噌",
  "酢",
  "みりん",
  "酒",
  "料理酒",
  "だし",
  "だし汁",
  "水",
  "片栗粉",
  "小麦粉",
] as const;

const requestKeys = new Set([
  "mode",
  "materials",
  "allowShopping",
  "servings",
  "time",
  "directions",
  "tools",
  "avoid",
  "notes",
]);

const materialKeys = new Set(["name", "usage", "amount"]);
const materialUsages = new Set<AiRecipeMaterialInput["usage"]>(["auto", "required", "use_up"]);

type ParseResult<T> = { ok: true; value: T } | { ok: false; reason: string };

function invalid(reason: string): ParseResult<never> {
  return { ok: false, reason };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function normalizeText(value: string, limit: number): string {
  return value.replace(/\s+/g, " ").trim().slice(0, limit);
}

function parseString(value: unknown, limit: number): string | null {
  if (typeof value !== "string") {
    return null;
  }

  const text = normalizeText(value, limit);
  return text || null;
}

function parseRequiredString(value: unknown, limit: number): string | null {
  return parseString(value, limit);
}

function parseStringList(value: unknown, maxItems: number, maxItemLength: number): string[] | null {
  if (!Array.isArray(value) || value.length > maxItems) {
    return null;
  }

  const seen = new Set<string>();
  const items: string[] = [];

  for (const item of value) {
    if (typeof item !== "string") {
      return null;
    }
    const text = normalizeText(item, maxItemLength);
    if (!text || seen.has(text)) {
      continue;
    }
    seen.add(text);
    items.push(text);
  }

  return items;
}

function parseMaterialInput(value: unknown): AiRecipeMaterialInput | null {
  if (!isRecord(value)) {
    return null;
  }
  for (const key of Object.keys(value)) {
    if (!materialKeys.has(key)) {
      return null;
    }
  }

  const name = parseRequiredString(value["name"], aiRecipeCandidateLimits.request.maxItemLength);
  if (!name || !materialUsages.has(value["usage"] as AiRecipeMaterialInput["usage"])) {
    return null;
  }

  const material: AiRecipeMaterialInput = {
    name,
    usage: value["usage"] as AiRecipeMaterialInput["usage"],
  };

  if (value["amount"] !== undefined) {
    const amount = parseString(value["amount"], aiRecipeCandidateLimits.request.maxItemLength);
    if (!amount) {
      return null;
    }
    material.amount = amount;
  }

  if (material.usage === "use_up" && !material.amount) {
    return null;
  }

  return material;
}

function parseMaterialInputs(value: unknown): AiRecipeMaterialInput[] | null {
  if (!Array.isArray(value) || value.length > aiRecipeCandidateLimits.request.maxMaterials) {
    return null;
  }

  const seen = new Set<string>();
  const materials: AiRecipeMaterialInput[] = [];

  for (const item of value) {
    const material = parseMaterialInput(item);
    if (!material) {
      return null;
    }
    if (seen.has(material.name)) {
      continue;
    }
    seen.add(material.name);
    materials.push(material);
  }

  return materials;
}

function appendOptionalString(
  request: AiRecipeCandidateRequest,
  key: "servings" | "time" | "notes",
  value: unknown,
  limit: number,
): boolean {
  if (value === undefined) {
    return true;
  }
  const text = parseString(value, limit);
  if (!text) {
    return false;
  }
  request[key] = text;
  return true;
}

function appendOptionalList(
  request: AiRecipeCandidateRequest,
  key: "directions" | "tools" | "avoid",
  value: unknown,
  maxItems: number,
): boolean {
  if (value === undefined) {
    return true;
  }
  const items = parseStringList(value, maxItems, aiRecipeCandidateLimits.request.maxItemLength);
  if (!items) {
    return false;
  }
  if (items.length > 0) {
    request[key] = items;
  }
  return true;
}

function appendOptionalBoolean(
  request: AiRecipeCandidateRequest,
  key: "allowShopping",
  value: unknown,
): boolean {
  if (value === undefined) {
    return true;
  }
  if (typeof value !== "boolean") {
    return false;
  }
  request[key] = value;
  return true;
}

export function isAiRecipeCandidateRequest(value: unknown): value is AiRecipeCandidateRequest {
  return isRecord(value) && value["mode"] === "candidates";
}

export function parseAiRecipeCandidateRequest(
  value: unknown,
): ParseResult<AiRecipeCandidateRequest> {
  if (!isRecord(value)) {
    return invalid("request must be an object");
  }
  for (const key of Object.keys(value)) {
    if (!requestKeys.has(key)) {
      return invalid("unknown request field");
    }
  }
  if (value["mode"] !== "candidates") {
    return invalid("mode must be candidates");
  }

  const materials = parseMaterialInputs(value["materials"]);
  if (!materials || materials.length === 0) {
    return invalid("materials are required");
  }

  const request: AiRecipeCandidateRequest = { mode: "candidates", materials };
  if (
    !appendOptionalBoolean(request, "allowShopping", value["allowShopping"]) ||
    !appendOptionalString(
      request,
      "servings",
      value["servings"],
      aiRecipeCandidateLimits.request.maxServingsLength,
    ) ||
    !appendOptionalString(
      request,
      "time",
      value["time"],
      aiRecipeCandidateLimits.request.maxTimeLength,
    ) ||
    !appendOptionalString(
      request,
      "notes",
      value["notes"],
      aiRecipeCandidateLimits.request.maxNotesLength,
    ) ||
    !appendOptionalList(
      request,
      "directions",
      value["directions"],
      aiRecipeCandidateLimits.request.maxDirections,
    ) ||
    !appendOptionalList(
      request,
      "tools",
      value["tools"],
      aiRecipeCandidateLimits.request.maxTools,
    ) ||
    !appendOptionalList(request, "avoid", value["avoid"], aiRecipeCandidateLimits.request.maxAvoid)
  ) {
    return invalid("invalid request field");
  }

  if (
    buildCompactRecipeCandidateInput(request).length >
    aiRecipeCandidateLimits.request.maxCompactUserContentLength
  ) {
    return invalid("compact request too long");
  }

  return { ok: true, value: request };
}

export function buildCompactRecipeCandidateInput(request: AiRecipeCandidateRequest): string {
  const compact: Record<string, unknown> = {
    m: request.materials.map((material) => {
      const compactMaterial = [material.name, material.usage];
      if (material.amount) {
        compactMaterial.push(material.amount);
      }
      return compactMaterial;
    }),
  };
  const requiredMaterials = getConstrainedMaterialNames(request);
  if (request.servings) compact["sv"] = request.servings;
  if (request.time) compact["t"] = request.time;
  if (request.directions?.length) compact["d"] = request.directions;
  if (request.tools?.length) compact["tl"] = request.tools;
  if (request.avoid?.length) compact["ng"] = request.avoid;
  if (requiredMaterials.length) compact["rq"] = requiredMaterials;
  if (request.allowShopping) compact["shop"] = 1;
  if (request.notes) compact["n"] = request.notes;
  return JSON.stringify(compact);
}

function parseBadges(value: unknown): AiRecipeCandidateBadge[] | null {
  const badges = parseStringList(
    value,
    aiRecipeCandidateLimits.response.maxBadges,
    aiRecipeCandidateLimits.response.maxListItemLength,
  );
  if (!badges) {
    return null;
  }

  const badgeSet = new Set<string>(allowedBadges);
  if (badges.some((badge) => !badgeSet.has(badge))) {
    return null;
  }

  return badges as AiRecipeCandidateBadge[];
}

function parseTime(value: unknown): number | null {
  if (typeof value !== "number" || !Number.isInteger(value)) {
    return null;
  }
  if (
    value < aiRecipeCandidateLimits.response.minTime ||
    value > aiRecipeCandidateLimits.response.maxTime
  ) {
    return null;
  }
  return value;
}

function parseCandidate(value: unknown): AiRecipeCandidate | null {
  if (!isRecord(value)) {
    return null;
  }

  const id = parseRequiredString(value["id"], 16);
  const title = parseRequiredString(
    value["title"],
    aiRecipeCandidateLimits.response.maxTitleLength,
  );
  const time = parseTime(value["time"]);
  const badges = parseBadges(value["badges"]);
  const use = parseStringList(
    value["use"],
    aiRecipeCandidateLimits.response.maxUse,
    aiRecipeCandidateLimits.response.maxListItemLength,
  );
  const miss = parseStringList(
    value["miss"],
    aiRecipeCandidateLimits.response.maxMissing,
    aiRecipeCandidateLimits.response.maxListItemLength,
  );
  const why = parseRequiredString(value["why"], aiRecipeCandidateLimits.response.maxWhyLength);
  const ing = parseStringList(
    value["ing"],
    aiRecipeCandidateLimits.response.maxIngredients,
    aiRecipeCandidateLimits.response.maxListItemLength,
  );
  const steps = parseStringList(
    value["steps"],
    aiRecipeCandidateLimits.response.maxSteps,
    aiRecipeCandidateLimits.response.maxStepLength,
  );

  if (
    !id ||
    !/^[a-z0-9_-]+$/i.test(id) ||
    !title ||
    time === null ||
    !badges ||
    !use ||
    !miss ||
    !why ||
    !ing ||
    !steps
  ) {
    return null;
  }

  if (ing.length === 0 || steps.length === 0) {
    return null;
  }

  return {
    id,
    title,
    time,
    badges,
    use,
    miss,
    why,
    ing,
    steps,
  };
}

export function parseAiRecipeCandidatesResponse(
  value: unknown,
): ParseResult<AiRecipeCandidatesResponse> {
  if (!isRecord(value) || !Array.isArray(value["items"])) {
    return invalid("items array is required");
  }

  if (value["items"].length < aiRecipeCandidateLimits.response.targetItems) {
    return invalid("three candidates are required");
  }

  const items: AiRecipeCandidate[] = [];
  for (const rawItem of value["items"]) {
    const item = parseCandidate(rawItem);
    if (!item) {
      return invalid("invalid candidate");
    }
    const id = ["a", "b", "c", "d", "e"][items.length] ?? item.id;
    items.push({ ...item, id });
  }

  return {
    ok: true,
    value: {
      items: items.slice(0, aiRecipeCandidateLimits.response.targetItems),
    },
  };
}

export function parseAiRecipeCandidatesJson(text: string): ParseResult<AiRecipeCandidatesResponse> {
  const jsonText = extractJsonObjectText(text);
  if (!jsonText) {
    return invalid("invalid JSON");
  }

  let payload: unknown;
  try {
    payload = JSON.parse(jsonText);
  } catch {
    return invalid("invalid JSON");
  }

  return parseAiRecipeCandidatesResponse(payload);
}

export function parseAiRecipeCandidatesModelOutput(
  value: unknown,
): ParseResult<AiRecipeCandidatesResponse> {
  if (typeof value === "string") {
    return parseAiRecipeCandidatesJson(value);
  }

  return parseAiRecipeCandidatesResponse(value);
}

function extractJsonObjectText(text: string): string | null {
  const trimmed = text.trim();
  const fenced = trimmed.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/i);
  const candidate = fenced?.[1]?.trim() ?? trimmed;

  if (candidate.startsWith("{") && candidate.endsWith("}")) {
    return candidate;
  }

  const start = candidate.indexOf("{");
  const end = candidate.lastIndexOf("}");
  if (start === -1 || end === -1 || end <= start) {
    return null;
  }

  return candidate.slice(start, end + 1);
}

function normalizeForComparison(value: string): string {
  return value.replace(/\s+/g, "").toLowerCase();
}

function matchesRequestMaterial(value: string, materials: readonly string[]): boolean {
  const normalizedValue = normalizeForComparison(value);
  return materials.some((material) => normalizedValue === normalizeForComparison(material));
}

const assumedPantryIngredients = new Set(
  aiRecipeAssumedPantryIngredients.map(normalizeForComparison),
);

function matchesList(value: string, items: readonly string[]): boolean {
  const normalizedValue = normalizeForComparison(value);
  return items.some((item) => normalizedValue === normalizeForComparison(item));
}

function mentionsListItem(value: string, items: readonly string[]): boolean {
  const normalizedValue = normalizeForComparison(value);
  return items.some((item) => {
    const normalizedItem = normalizeForComparison(item);
    return normalizedValue === normalizedItem || normalizedValue.includes(normalizedItem);
  });
}

function mentionsAssumedPantryIngredient(value: string): boolean {
  const normalizedValue = normalizeForComparison(value);
  return [...assumedPantryIngredients].some(
    (ingredient) => normalizedValue === ingredient || normalizedValue.includes(ingredient),
  );
}

function findMentionedRequestMaterial(
  value: string,
  materials: readonly string[],
): string | undefined {
  return materials.find((material) => mentionsListItem(value, [material]));
}

function appendUniqueMaterial(materials: string[], material: string): void {
  if (!matchesList(material, materials)) {
    materials.push(material);
  }
}

function conflictsWithAvoid(value: string, avoid: readonly string[]): boolean {
  const normalizedValue = normalizeForComparison(value);
  return avoid.some((item) => {
    const normalizedAvoid = normalizeForComparison(item);
    return (
      normalizedValue === normalizedAvoid ||
      normalizedValue.includes(normalizedAvoid) ||
      normalizedAvoid.includes(normalizedValue)
    );
  });
}

function getRequestMaterialNames(request: AiRecipeCandidateRequest): string[] {
  return request.materials.map((material) => material.name);
}

function getConstrainedMaterialNames(request: AiRecipeCandidateRequest): string[] {
  return request.materials
    .filter((material) => material.usage === "required" || material.usage === "use_up")
    .map((material) => material.name);
}

function isShoppingBadge(badge: AiRecipeCandidateBadge): boolean {
  return badge === "no_shop" || badge === "miss_optional";
}

function normalizeCandidateForRequest(
  item: AiRecipeCandidate,
  request: AiRecipeCandidateRequest,
): AiRecipeCandidate {
  const requestMaterialNames = getRequestMaterialNames(request);
  const use: string[] = [];
  for (const used of item.use) {
    const material = findMentionedRequestMaterial(used, requestMaterialNames);
    if (material) {
      appendUniqueMaterial(use, material);
    }
  }

  for (const ingredient of item.ing) {
    const material = findMentionedRequestMaterial(ingredient, requestMaterialNames);
    if (material) {
      appendUniqueMaterial(use, material);
    }
  }

  const miss = item.miss.filter(
    (missing) =>
      !matchesRequestMaterial(missing, requestMaterialNames) &&
      !(request.avoid?.some((avoid) => conflictsWithAvoid(missing, [avoid])) ?? false),
  );
  const badges = item.badges.filter(
    (badge) => badge !== "no_shop" && !(badge === "miss_optional" && miss.length === 0),
  );

  return {
    ...item,
    badges,
    miss,
    use,
  };
}

export function validateAiRecipeCandidatesForRequest(
  response: AiRecipeCandidatesResponse,
  request: AiRecipeCandidateRequest,
): ParseResult<AiRecipeCandidatesResponse> {
  const allowShopping = request.allowShopping === true;
  const requestMaterialNames = getRequestMaterialNames(request);
  const constrainedMaterials = getConstrainedMaterialNames(request);

  for (const item of response.items) {
    if (!allowShopping && item.miss.length > 0) {
      return invalid("candidate missing ingredients require shopping permission");
    }

    if (!allowShopping && item.badges.some((badge) => isShoppingBadge(badge))) {
      return invalid("candidate shopping badges require shopping permission");
    }
  }

  const normalizedItems = response.items.map((item) => normalizeCandidateForRequest(item, request));

  for (const item of normalizedItems) {
    if (item.use.length === 0) {
      return invalid("candidate use is required");
    }

    if (item.use.some((used) => !matchesRequestMaterial(used, requestMaterialNames))) {
      return invalid("candidate use must come from request materials");
    }

    if (constrainedMaterials.some((material) => !matchesList(material, item.use))) {
      return invalid("candidate must use constrained materials");
    }

    const unaccountedIngredients = item.ing.filter(
      (ingredient) =>
        !mentionsListItem(ingredient, requestMaterialNames) &&
        !mentionsListItem(ingredient, item.miss) &&
        !mentionsAssumedPantryIngredient(ingredient),
    );
    if (unaccountedIngredients.length > 0) {
      return invalid(
        "candidate ingredients must be request materials, missing items, or pantry items",
      );
    }

    if (request.avoid?.length) {
      const checkedValues = [...item.use, ...item.miss, ...item.ing];
      if (checkedValues.some((value) => conflictsWithAvoid(value, request.avoid ?? []))) {
        return invalid("candidate conflicts with avoid list");
      }
    }
  }

  return { ok: true, value: { items: normalizedItems } };
}
