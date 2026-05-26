import type { ComboRegistry } from "./combo-registry";
import type { ComboId, PromptData } from "./types";

type PromptDataReadServices = {
  getComboValues: (group: ComboId) => string[];
  getServingsText: () => string;
  getCookTimeText: () => string;
  getSupplementalNotes: () => string;
};

export type PromptDataReader = {
  read: () => PromptData;
};

export type PromptDataInputs = {
  comboRegistry: Pick<ComboRegistry, "getValues">;
  getServingsText: () => string;
  getCookTimeText: () => string;
  getSupplementalNotes: () => string;
};

const advancedConditionIds: ComboId[] = [
  "difficulty",
  "health",
  "flavors",
  "genres",
  "scenes",
  "ngMaterials",
  "ngSeasonings",
];

export function createPromptDataReader(services: PromptDataReadServices): PromptDataReader {
  return {
    read: () => ({
      materials: services.getComboValues("materials"),
      dishTypes: services.getComboValues("dishTypes"),
      cookingTools: services.getComboValues("cookingTools"),
      pairingTargets: services.getComboValues("pairingTargets"),
      difficulty: services.getComboValues("difficulty"),
      health: services.getComboValues("health"),
      flavors: services.getComboValues("flavors"),
      genres: services.getComboValues("genres"),
      scenes: services.getComboValues("scenes"),
      ngMaterials: services.getComboValues("ngMaterials"),
      ngSeasonings: services.getComboValues("ngSeasonings"),
      servings: services.getServingsText(),
      cookTime: services.getCookTimeText(),
      supplementalNotes: services.getSupplementalNotes(),
    }),
  };
}

export function createPromptDataReaderFromInputs(inputs: PromptDataInputs): PromptDataReader {
  return createPromptDataReader({
    getComboValues: (group) => inputs.comboRegistry.getValues(group),
    getServingsText: inputs.getServingsText,
    getCookTimeText: inputs.getCookTimeText,
    getSupplementalNotes: inputs.getSupplementalNotes,
  });
}

export function countAdvancedConditions(data: PromptData): number {
  return (
    advancedConditionIds.reduce((count, id) => count + data[id].length, 0) +
    (data.cookTime ? 1 : 0) +
    (data.supplementalNotes ? 1 : 0)
  );
}
