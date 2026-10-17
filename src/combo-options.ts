import { comboOptionSets, combos, featuredComboOptions } from "./data";
import type { ComboId } from "./types";

export function getComboOptionValues(group: ComboId): string[] {
  const combo = combos.find((item) => item.id === group);
  if (!combo) {
    throw new Error(`Combo not found: ${group}`);
  }
  const values = comboOptionSets[combo.optionSet] ?? [];
  if (combo.optionSet !== "materials") {
    return values;
  }
  const featured = featuredComboOptions.materials ?? [];
  const featuredValues = new Set(featured);
  return [
    ...featured,
    ...values
      .filter((value) => !featuredValues.has(value))
      .sort((a, b) => a.localeCompare(b, "ja")),
  ];
}

export function getInitialComboOptionValues(group: ComboId): string[] {
  const combo = combos.find((item) => item.id === group);
  if (!combo) {
    throw new Error(`Combo not found: ${group}`);
  }
  return [...(featuredComboOptions[combo.optionSet] ?? getComboOptionValues(group))];
}
