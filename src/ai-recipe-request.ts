import { aiRecipeCandidateLimits } from "./ai-recipe-schema";
import type { AiRecipeCandidateRequest, PromptData } from "./types";

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

function getPrioritizedMaterials(data: PromptData): string[] {
  const specifiedMaterials =
    data.materialUseMode === "specified"
      ? data.materialRequests
          .filter((request) => request.usage !== "auto")
          .map((request) => request.name)
      : [];

  return compactList(
    [...specifiedMaterials, ...data.materials],
    aiRecipeRequestLimits.maxMaterials,
  );
}

function buildMaterialRequestNote(data: PromptData, retainedMaterials: readonly string[]): string {
  if (data.materialUseMode !== "specified") {
    return "";
  }

  const retained = new Set(retainedMaterials.map(normalizeText));
  const notes = data.materialRequests.flatMap((request) => {
    const name = normalizeText(request.name);
    if (!name || request.usage === "auto" || !retained.has(name)) {
      return [];
    }
    const amount =
      request.useUpAmountMode === "custom" && normalizeText(request.useUpAmount)
        ? `(${normalizeText(request.useUpAmount)})`
        : "";
    const prefix = request.usage === "required" ? "必須" : "使切";
    return [`${prefix}:${name}${amount}`];
  });

  return notes.join(" / ");
}

function buildNotes(data: PromptData, retainedMaterials: readonly string[]): string {
  return [buildMaterialRequestNote(data, retainedMaterials), normalizeText(data.supplementalNotes)]
    .filter(Boolean)
    .join("。");
}

export function buildAiRecipeCandidateRequest(data: PromptData): AiRecipeCandidateRequest {
  const request: AiRecipeCandidateRequest = {
    mode: "candidates",
    materials: getPrioritizedMaterials(data),
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

  const notes = truncateText(
    buildNotes(data, request.materials),
    aiRecipeRequestLimits.maxNotesLength,
  );
  if (notes) {
    request.notes = notes;
  }

  return request;
}
