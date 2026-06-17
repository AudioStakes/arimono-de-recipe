import { combos, requestIntentOptions } from "./data";
import type { ComboId, PromptData } from "./types";

export type ConditionChipSpec =
  | {
      kind: "combo";
      id: ComboId;
      label: string;
      removable: true;
    }
  | {
      kind: "requestIntent" | "recipeCount" | "servings" | "cookTime" | "supplementalNotes";
      label: string;
      removable: boolean;
    };

const comboLookup = new Map(combos.map((combo) => [combo.id, combo] as const));

const comboChipLabel = (id: ComboId): string => {
  const combo = comboLookup.get(id);
  if (!combo) throw new Error(`Combo not found: ${id}`);
  return combo.chip ?? combo.label;
};

const recipeCountLabel = (data: PromptData): string => {
  if (data.recipeCount === "one") return "作りたい品数: 1品だけ";
  if (data.recipeCount === "multiple") return "作りたい品数: 複数品";
  return "作りたい品数: おまかせ";
};

const appendComboChip = (chips: ConditionChipSpec[], data: PromptData, id: ComboId): void => {
  const values = data[id];
  if (!values.length) return;

  chips.push({
    kind: "combo",
    id,
    label: `${comboChipLabel(id)}: ${values.join("、")}`,
    removable: true,
  });
};

function normalizeChipData(data: PromptData): PromptData {
  const requestedRecipeCount = data.requestIntent === "target-dish" ? "auto" : data.recipeCount;
  const recipeCount =
    data.requestIntent === "pairing" && requestedRecipeCount === "auto"
      ? "one"
      : requestedRecipeCount;

  return {
    ...data,
    targetDish: data.requestIntent === "target-dish" ? data.targetDish : [],
    pairingTargets: data.requestIntent === "pairing" ? data.pairingTargets : [],
    recipeCount,
    recipeRoles: recipeCount === "auto" ? [] : data.recipeRoles,
  };
}

export function buildConditionChipSpecs(data: PromptData): ConditionChipSpec[] {
  const chipData = normalizeChipData(data);
  const chips: ConditionChipSpec[] = [];
  const intentLabel = requestIntentOptions.find(
    (option) => option.value === chipData.requestIntent,
  )?.label;

  if (intentLabel) {
    chips.push({
      kind: "requestIntent",
      label: intentLabel,
      removable: false,
    });
  }

  appendComboChip(chips, chipData, "materials");
  appendComboChip(chips, chipData, "targetDish");
  appendComboChip(chips, chipData, "pairingTargets");

  if (chipData.servings) {
    chips.push({
      kind: "servings",
      label: chipData.servings,
      removable: false,
    });
  }

  if (chipData.recipeCount !== "auto" || chipData.requestIntent === "pairing") {
    chips.push({
      kind: "recipeCount",
      label: recipeCountLabel(chipData),
      removable: false,
    });
  }

  appendComboChip(chips, chipData, "recipeRoles");
  appendComboChip(chips, chipData, "cookingTools");

  if (chipData.cookTime) {
    chips.push({
      kind: "cookTime",
      label: `調理時間: ${chipData.cookTime}`,
      removable: true,
    });
  }

  appendComboChip(chips, chipData, "recipeDirections");
  appendComboChip(chips, chipData, "ngFoodsAndSeasonings");

  if (chipData.supplementalNotes) {
    chips.push({
      kind: "supplementalNotes",
      label: "その他の要望あり",
      removable: true,
    });
  }

  return chips;
}
