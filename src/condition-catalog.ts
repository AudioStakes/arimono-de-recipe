import { selectCurrentRequest } from "./conditions";
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
      kind: "servings" | "supplementalNotes";
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
  const chipData = selectCurrentRequest(data);
  const chips: ConditionChipSpec[] = [];
  appendComboChip(chips, chipData, "materials");

  if (chipData.servings) {
    chips.push({
      kind: "servings",
      label: chipData.servings,
      removable: false,
    });
  }

  appendComboChip(chips, chipData, "cookingTools");

  if (chipData.supplementalNotes) {
    chips.push({
      kind: "supplementalNotes",
      label: "その他の要望あり",
      removable: true,
    });
  }

  return chips;
}
