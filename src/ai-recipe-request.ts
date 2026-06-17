import { aiRecipeCandidateLimits } from "./ai-recipe-schema";
import type {
  AiRecipeCandidateRequest,
  AiRecipeMaterialInput,
  MaterialRequest,
  PromptData,
} from "./types";

const aiRecipeRequestLimits = aiRecipeCandidateLimits.request;

function normalizeText(value: string): string {
  return value.replace(/\s+/g, " ").trim();
}

function compactList(values: readonly string[], limit: number): string[] {
  const seen = new Set<string>();
  const result: string[] = [];

  for (const value of values) {
    const item = normalizeText(value);
    if (!item || seen.has(item)) {
      continue;
    }
    seen.add(item);
    result.push(item);
    if (result.length >= limit) {
      break;
    }
  }

  return result;
}

function truncateText(value: string, limit: number): string {
  return normalizeText(value).slice(0, limit);
}

function getPrioritizedMaterialNames(data: PromptData): string[] {
  const specifiedMaterials =
    data.materialUseMode === "specified"
      ? data.materialRequests
          .filter(
            (request) =>
              request.usage !== "auto" ||
              (request.useUpAmountMode === "custom" && normalizeText(request.useUpAmount)),
          )
          .map((request) => request.name)
      : [];

  return compactList(
    [...specifiedMaterials, ...data.materials],
    aiRecipeRequestLimits.maxMaterials,
  );
}

function toAiMaterialUsage(request: MaterialRequest): AiRecipeMaterialInput["usage"] {
  return request.usage === "use-up" ? "use_up" : request.usage;
}

function getMaterialAmount(request: MaterialRequest): string {
  if (request.useUpAmountMode !== "custom") {
    return "";
  }

  return normalizeText(request.useUpAmount);
}

function getMaterialRequestByName(data: PromptData): Map<string, MaterialRequest> {
  const requests = new Map<string, MaterialRequest>();
  if (data.materialUseMode !== "specified") {
    return requests;
  }

  for (const request of data.materialRequests) {
    const name = normalizeText(request.name);
    if (name && !requests.has(name)) {
      requests.set(name, request);
    }
  }

  return requests;
}

function buildMaterialInput(name: string, request?: MaterialRequest): AiRecipeMaterialInput {
  const material: AiRecipeMaterialInput = {
    name,
    usage: request ? toAiMaterialUsage(request) : "auto",
  };
  const amount = request ? getMaterialAmount(request) : "";
  if (amount) {
    material.amount = amount;
  }
  return material;
}

function buildMaterialInputs(data: PromptData): AiRecipeMaterialInput[] {
  const requestByName = getMaterialRequestByName(data);
  return getPrioritizedMaterialNames(data).map((name) =>
    buildMaterialInput(name, requestByName.get(name)),
  );
}

function buildNotes(data: PromptData): string {
  return normalizeText(data.supplementalNotes);
}

export function buildAiRecipeCandidateRequest(data: PromptData): AiRecipeCandidateRequest {
  const request: AiRecipeCandidateRequest = {
    mode: "candidates",
    materials: buildMaterialInputs(data),
  };

  const servings = normalizeText(data.servings);
  if (servings) {
    request.servings = servings;
  }

  const time = normalizeText(data.cookTime);
  if (time) {
    request.time = time;
  }

  const directions = compactList(
    [...data.recipeDirections, ...data.recipeRoles, ...data.targetDish, ...data.pairingTargets],
    aiRecipeRequestLimits.maxDirections,
  );
  if (directions.length > 0) {
    request.directions = directions;
  }

  const tools = compactList(data.cookingTools, aiRecipeRequestLimits.maxTools);
  if (tools.length > 0) {
    request.tools = tools;
  }

  const avoid = compactList(data.ngFoodsAndSeasonings, aiRecipeRequestLimits.maxAvoid);
  if (avoid.length > 0) {
    request.avoid = avoid;
  }

  const notes = truncateText(buildNotes(data), aiRecipeRequestLimits.maxNotesLength);
  if (notes) {
    request.notes = notes;
  }

  return request;
}
