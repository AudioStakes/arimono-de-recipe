import { foodMaterialCandidates } from "./food-materials";
import { seasoningCandidates } from "./seasonings";
import { mergeCandidateValues } from "./types";

export const ngFoodAndSeasoningCandidates = mergeCandidateValues(
  foodMaterialCandidates,
  seasoningCandidates,
);
