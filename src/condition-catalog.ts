import { combos } from "./data";
import type { ComboId, PromptData } from "./types";

export type PromptSection = {
  title: string;
  value: string;
};

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

const bulletList = (items: string[]): string => items.map((item) => `- ${item}`).join(NEWLINE);
const inlineList = (items: string[]): string => items.join("、");

export const NEWLINE = String.fromCharCode(10);

const promptRules: Array<[(data: PromptData) => boolean, string]> = [
  [(data) => data.materials.length > 0, "指定された食材・材料を中心に使ってください。"],
  [
    (data) => data.dishTypes.length > 0,
    "指定された「料理区分・作りたいもの」だけを提案してください。",
  ],
  [
    (data) => data.cookingTools.length > 0,
    "指定された使いたい調理器具・調理方法だけで作れる手順にしてください。",
  ],
  [(data) => Boolean(data.cookTime), "指定された調理時間に収まる現実的な手順にしてください。"],
  [
    (data) => data.pairingTargets.length > 0,
    "「合わせたい料理・一緒に出す料理」に合う味・食感・量のレシピにしてください。",
  ],
  [(data) => data.difficulty.length > 0, "指定された「作りやすさ・手軽さ」を反映してください。"],
  [(data) => data.recipeDirections.length > 0, "指定された「味や雰囲気」を反映してください。"],
  [
    (data) => data.ngFoodsAndSeasonings.length > 0,
    "「NG食材・調味料」に指定されたものは使わないでください。",
  ],
  [(data) => Boolean(data.supplementalNotes), "指定された「その他の要望」を反映してください。"],
];

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

export function buildPromptSections(data: PromptData): PromptSection[] {
  const sections: PromptSection[] = [];

  for (const combo of combos) {
    const values = data[combo.id];
    if (!values.length) continue;
    sections.push({
      title: combo.prompt,
      value: combo.bullets ? bulletList(values) : inlineList(values),
    });
  }

  if (data.servings) {
    sections.push({ title: "人数", value: data.servings });
  }

  if (data.cookTime) {
    sections.push({ title: "調理時間", value: data.cookTime });
  }

  if (data.supplementalNotes) {
    sections.push({ title: "その他の要望", value: data.supplementalNotes });
  }

  return sections;
}

export function buildPromptRules(data: PromptData): string[] {
  return promptRules.filter(([predicate]) => predicate(data)).map(([, text]) => text);
}

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
