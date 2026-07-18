import type { AiRecipeCandidate, AiRecipeCandidateBadge } from "../types";
import type { RecipeCandidate, RecipeCandidateBadge, RecipeDetail } from "./types";

const recipeCandidateBadgeMap = {
  no_shop: "no_shop",
  miss_optional: "miss_optional",
  quick: "quick",
  easy: "easy",
  uses_up: "uses_up",
  few_dishes: "few_dishes",
  kids: "kids",
} as const satisfies Record<AiRecipeCandidateBadge, RecipeCandidateBadge>;

export function toRecipeCandidate(candidate: AiRecipeCandidate): RecipeCandidate {
  const detail: RecipeDetail = {
    candidateId: candidate.id,
    title: candidate.title,
    ingredients: candidate.ing,
    instructions: candidate.steps,
    tasteAdjustments: [],
  };

  return {
    id: candidate.id,
    title: candidate.title,
    timeMinutes: candidate.time,
    badges: candidate.badges.map((badge) => recipeCandidateBadgeMap[badge]),
    usedMaterials: candidate.use,
    missingIngredients: candidate.miss,
    reason: candidate.why,
    detail,
  };
}

export function toRecipeCandidates(candidates: readonly AiRecipeCandidate[]): RecipeCandidate[] {
  return candidates.map((candidate) => toRecipeCandidate(candidate));
}
