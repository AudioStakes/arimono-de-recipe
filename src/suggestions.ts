import {
  buildCandidateSearchSynonyms,
  cookingMethodAndToolCandidates,
  dishTypeCandidates,
  easeCandidates,
  foodMaterialCandidates,
  ngFoodAndSeasoningCandidates,
  pairingTargetCandidates,
  recipeDirectionCandidates,
} from "./candidate-values";

export const searchSynonyms: Record<string, string> = {
  ...buildCandidateSearchSynonyms(foodMaterialCandidates),
  ...buildCandidateSearchSynonyms(dishTypeCandidates),
  ...buildCandidateSearchSynonyms(cookingMethodAndToolCandidates),
  ...buildCandidateSearchSynonyms(pairingTargetCandidates),
  ...buildCandidateSearchSynonyms(easeCandidates),
  ...buildCandidateSearchSynonyms(recipeDirectionCandidates),
  ...buildCandidateSearchSynonyms(ngFoodAndSeasoningCandidates),
};

export function normalizeSearchText(text: string): string {
  return text
    .normalize("NFKC")
    .toLowerCase()
    .replace(/[ぁ-ゖ]/g, (char) => String.fromCharCode(char.charCodeAt(0) + 96));
}

const normalizeSearchKey = (text: string): string => normalizeSearchText(text).replace(/\s+/g, "");

export function getOptionSearchText(value: string): string {
  return normalizeSearchKey(`${value} ${searchSynonyms[value] ?? ""}`);
}

export function filterAvailableComboOptions(
  options: readonly string[],
  query: string,
  selected: Iterable<string> = [],
  limit = 40,
): string[] {
  const normalizedQuery = normalizeSearchKey(query).trim();
  const excluded = new Set(selected);

  return options
    .filter((value) => !excluded.has(value))
    .filter((value) => !normalizedQuery || getOptionSearchText(value).includes(normalizedQuery))
    .slice(0, limit);
}
