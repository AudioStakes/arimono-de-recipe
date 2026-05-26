import { chipOrder, combos } from "./data";
import type { ComboId, PromptData } from "./types";

type ComboChipSpec = {
  kind: "combo";
  id: ComboId;
  label: string;
  removable: true;
};

type FixedChipSpec = {
  kind: "servings" | "cookTime" | "supplementalNotes";
  label: string;
  removable: boolean;
};

export type PromptChipSpec = ComboChipSpec | FixedChipSpec;

const comboLookup = new Map(combos.map((combo) => [combo.id, combo] as const));

const comboLabel = (id: ComboId): string => {
  const combo = comboLookup.get(id);
  if (!combo) throw new Error(`Combo not found: ${id}`);
  return combo.chip ?? combo.label;
};

const appendComboChip = (chips: PromptChipSpec[], data: PromptData, id: ComboId): void => {
  const values = data[id];
  if (!values.length) return;
  chips.push({
    kind: "combo",
    id,
    label: `${comboLabel(id)}: ${values.join("、")}`,
    removable: true,
  });
};

export function buildConditionChipSpecs(data: PromptData): PromptChipSpec[] {
  const chips: PromptChipSpec[] = [];

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

  for (const id of chipOrder.slice(4) as ComboId[]) {
    appendComboChip(chips, data, id);
  }

  if (data.supplementalNotes) {
    chips.push({
      kind: "supplementalNotes",
      label: "補足あり",
      removable: true,
    });
  }

  return chips;
}
