import { combos } from "./data";
import type { PromptData } from "./types";

export const NL = String.fromCharCode(10);

const hasItems = (items: string[]): boolean => items.length > 0;
const inlineList = (items: string[]): string => items.join("、");
const bulletList = (items: string[]): string => items.map((item) => `- ${item}`).join(NL);
const section = (title: string, value: string): string =>
  value ? [`【${title}】`, value, ""].join(NL) + NL : "";

const ruleDefs: Array<[(data: PromptData) => boolean | string, string]> = [
  [(data) => data.materials.length > 0, "指定された材料を中心に使ってください。"],
  [(data) => data.dishTypes.length > 0, "指定された「作りたいもの」だけを提案してください。"],
  [
    (data) => data.cookingTools.length > 0,
    "指定された調理方法・器具だけで作れる手順にしてください。",
  ],
  [(data) => data.cookTime, "指定された調理時間に収まる現実的な手順にしてください。"],
  [(data) => data.ngMaterials.length > 0, "「NG材料」に指定されたものは使わないでください。"],
  [(data) => data.ngSeasonings.length > 0, "「NG調味料」に指定されたものは使わないでください。"],
  [
    (data) => data.pairingTargets.length > 0,
    "「一緒に出す料理、合わせたい料理」に合う味・食感・量のレシピにしてください。",
  ],
  [
    (data) =>
      ["scenes", "flavors", "genres", "health", "difficulty"].some(
        (key) => data[key as keyof PromptData].length > 0,
      ) || data.supplementalNotes,
    "指定されたこだわり条件を反映してください。",
  ],
];

export function makeEmptyPromptData(overrides: Partial<PromptData> = {}): PromptData {
  return {
    materials: [],
    dishTypes: [],
    cookingTools: [],
    pairingTargets: [],
    difficulty: [],
    health: [],
    flavors: [],
    genres: [],
    scenes: [],
    ngMaterials: [],
    ngSeasonings: [],
    servings: "",
    cookTime: "",
    supplementalNotes: "",
    ...overrides,
  };
}

export function buildPrompt(data: PromptData): string {
  let prompt = ["冷蔵庫にある材料を使って、今日の食事に合うレシピを考えてください。", ""].join(NL);
  prompt += NL;

  for (const combo of combos) {
    const values = data[combo.id];
    const sectionValue = hasItems(values)
      ? combo.bullets
        ? bulletList(values)
        : inlineList(values)
      : "";
    prompt += section(combo.prompt, sectionValue);
  }

  prompt += section("人数・分量", data.servings);
  prompt += section("調理時間", data.cookTime);
  prompt += section("補足", data.supplementalNotes);

  const ruleText = [
    "- 家にない材料を主材料として追加しないでください。",
    ...ruleDefs.filter(([predicate]) => predicate(data)).map(([, text]) => `- ${text}`),
    "- 指定条件で無理にレシピ化できない場合は、無理な提案をせず、難しい理由を短く説明してください。",
    "- 足りない材料、代用案、保存方法の提案は不要です。",
  ].join(NL);

  const format = hasItems(data.pairingTargets)
    ? ["1. レシピ名", "2. 一緒に出す料理との相性", "3. 使う材料", "4. 作り方", "5. 調理のポイント"]
    : ["1. レシピ名", "2. 使う材料", "3. 作り方", "4. 調理のポイント"];

  return (
    prompt +
    [
      "以下の条件を必ず守ってください。",
      "",
      ruleText,
      "",
      "出力は以下の形式にしてください。",
      "",
    ].join(NL) +
    format.join(NL)
  ).trim();
}
