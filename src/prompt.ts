import { buildPromptRules, buildPromptSections, NEWLINE } from "./condition-catalog";
import type { PromptData } from "./types";

const hasPairingTargets = (items: string[]): boolean => items.length > 0;
const formatPromptSection = (title: string, value: string): string =>
  value ? [`【${title}】`, value, ""].join(NEWLINE) + NEWLINE : "";

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
  let prompt = ["冷蔵庫にある材料を使って、今日の食事に合うレシピを考えてください。", ""].join(
    NEWLINE,
  );
  prompt += NEWLINE;

  for (const { title, value } of buildPromptSections(data)) {
    prompt += formatPromptSection(title, value);
  }

  const ruleText = [
    "- 家にない材料を主材料として追加しないでください。",
    ...buildPromptRules(data).map((text) => `- ${text}`),
    "- 指定条件で無理にレシピ化できない場合は、無理な提案をせず、難しい理由を短く説明してください。",
    "- 足りない材料、代用案、保存方法の提案は不要です。",
  ].join(NEWLINE);

  const format = hasPairingTargets(data.pairingTargets)
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
    ].join(NEWLINE) +
    format.join(NEWLINE)
  ).trim();
}
