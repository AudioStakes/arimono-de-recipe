import { buildAiRecipeCandidateRequest } from "../ai-recipe-request";
import type { PromptData } from "../types";
import { getRecipeMaterialInputs } from "./materials";
import type { RecipeDecisionCandidateRequest } from "./types";

export function buildRecipeDecisionCandidateRequest(
  data: PromptData,
): RecipeDecisionCandidateRequest {
  const aiRequest = buildAiRecipeCandidateRequest(data);
  const request: RecipeDecisionCandidateRequest = {
    materials: getRecipeMaterialInputs(data, aiRequest.materials),
    directions: aiRequest.directions ?? [],
    tools: aiRequest.tools ?? [],
    avoid: aiRequest.avoid ?? [],
  };

  if (aiRequest.servings) {
    request.servings = aiRequest.servings;
  }

  if (aiRequest.time) {
    request.time = aiRequest.time;
  }

  if (aiRequest.notes) {
    request.notes = aiRequest.notes;
  }

  return request;
}
