import { combos } from "./data";
import type { ComboId, PromptData } from "./types";

export type ConditionChipSpec =
  | {
      kind: "combo";
      id: ComboId;
      label: string;
      removable: true;
    }
  | {
      kind: "servings" | "cookTime" | "supplementalNotes";
      label: string;
      removable: boolean;
    };

const comboLookup = new Map(combos.map((combo) => [combo.id, combo] as const));

const comboChipLabel = (id: ComboId): string => {
  const combo = comboLookup.get(id);
  if (!combo) throw new Error(`Combo not found: ${id}`);
  return combo.chip ?? combo.label;
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

export function buildConditionChipSpecs(data: PromptData): ConditionChipSpec[] {
  const chips: ConditionChipSpec[] = [];

  appendComboChip(chips, data, "materials");

  if (data.servings) {
    chips.push({
      kind: "servings",
      label: data.servings,
      removable: false,
    });
  }

  for (const id of ["dishTypes", "cookingTools", "pairingTargets"] as ComboId[]) {
    appendComboChip(chips, data, id);
  }

  if (data.cookTime) {
    chips.push({
      kind: "cookTime",
      label: `調理時間: ${data.cookTime}`,
      removable: true,
    });
  }

  for (const id of ["difficulty", "recipeDirections", "ngFoodsAndSeasonings"] as ComboId[]) {
    appendComboChip(chips, data, id);
  }

  if (data.supplementalNotes) {
    chips.push({
      kind: "supplementalNotes",
      label: "その他の要望あり",
      removable: true,
    });
  }

  return chips;
}
