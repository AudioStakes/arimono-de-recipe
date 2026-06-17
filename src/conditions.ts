import type { ComboRegistry } from "./combo-registry";
import type {
  ComboId,
  MaterialRequest,
  MaterialUseMode,
  PromptData,
  RecipeCount,
  RequestIntent,
  ServingsMode,
} from "./types";

type PromptDataReadServices = {
  getComboValues: (group: ComboId) => string[];
  getRequestIntent?: () => RequestIntent;
  getMaterialUseMode?: () => MaterialUseMode;
  getMaterialRequests?: () => MaterialRequest[];
  getServingsText: () => string;
  getServingsMode?: () => ServingsMode;
  getRecipeCount?: () => RecipeCount;
  getCookTimeText: () => string;
  getSupplementalNotes: () => string;
};

export type PromptDataReader = {
  read: () => PromptData;
};

export type PromptDataInputs = {
  comboRegistry: Pick<ComboRegistry, "getValues">;
  getRequestIntent?: () => RequestIntent;
  getMaterialUseMode?: () => MaterialUseMode;
  getMaterialRequests?: () => MaterialRequest[];
  getServingsText: () => string;
  getServingsMode?: () => ServingsMode;
  getRecipeCount?: () => RecipeCount;
  getCookTimeText: () => string;
  getSupplementalNotes: () => string;
};

const advancedConditionIds: ComboId[] = [
  "cookingTools",
  "recipeDirections",
  "ngFoodsAndSeasonings",
];
const promptComboIds = [
  "materials",
  "targetDish",
  "recipeRoles",
  "cookingTools",
  "pairingTargets",
  "recipeDirections",
  "ngFoodsAndSeasonings",
] as const satisfies readonly ComboId[];

function readComboValues(services: PromptDataReadServices): Record<ComboId, string[]> {
  const values = {} as Record<ComboId, string[]>;
  for (const id of promptComboIds) {
    values[id] = services.getComboValues(id);
  }
  return values;
}

export function createPromptDataReader(services: PromptDataReadServices): PromptDataReader {
  return {
    read: () => {
      const comboValues = readComboValues(services);
      const requestIntent = services.getRequestIntent?.() ?? "auto";
      const materialUseMode = services.getMaterialUseMode?.() ?? "auto";
      const defaultRecipeCount = requestIntent === "pairing" ? "one" : "auto";
      const requestedRecipeCount =
        requestIntent === "target-dish"
          ? "auto"
          : (services.getRecipeCount?.() ?? defaultRecipeCount);
      const recipeCount =
        requestIntent === "pairing" && requestedRecipeCount === "auto"
          ? "one"
          : requestedRecipeCount;

      return {
        ...comboValues,
        targetDish: requestIntent === "target-dish" ? comboValues.targetDish : [],
        pairingTargets: requestIntent === "pairing" ? comboValues.pairingTargets : [],
        recipeRoles: recipeCount === "auto" ? [] : comboValues.recipeRoles,
        requestIntent,
        materialUseMode,
        materialRequests:
          materialUseMode === "specified" ? (services.getMaterialRequests?.() ?? []) : [],
        servings: services.getServingsText(),
        servingsMode: services.getServingsMode?.() ?? "unspecified",
        recipeCount,
        cookTime: services.getCookTimeText(),
        supplementalNotes: services.getSupplementalNotes(),
      };
    },
  };
}

export function createPromptDataReaderFromInputs(inputs: PromptDataInputs): PromptDataReader {
  return createPromptDataReader({
    getComboValues: (group) => inputs.comboRegistry.getValues(group),
    getServingsText: inputs.getServingsText,
    getCookTimeText: inputs.getCookTimeText,
    getSupplementalNotes: inputs.getSupplementalNotes,
    ...(inputs.getRequestIntent ? { getRequestIntent: inputs.getRequestIntent } : {}),
    ...(inputs.getMaterialUseMode ? { getMaterialUseMode: inputs.getMaterialUseMode } : {}),
    ...(inputs.getMaterialRequests ? { getMaterialRequests: inputs.getMaterialRequests } : {}),
    ...(inputs.getServingsMode ? { getServingsMode: inputs.getServingsMode } : {}),
    ...(inputs.getRecipeCount ? { getRecipeCount: inputs.getRecipeCount } : {}),
  });
}

export function countAdvancedConditions(data: PromptData): number {
  return (
    advancedConditionIds.reduce((count, id) => count + data[id].length, 0) +
    (data.cookTime ? 1 : 0) +
    (data.supplementalNotes ? 1 : 0)
  );
}
