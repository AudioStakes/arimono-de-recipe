import { selectCurrentRequest } from "./conditions";
import type { MaterialRequest, PromptData } from "./types";

const RECIPE_OUTPUT_TEMPLATE = `### レシピ名
〈料理名〉

### 使う材料
- 〈材料・調味料〉：〈分量〉

### 作り方
1. 〈安全に調理する3〜6手順。各1〜2文。加熱は時間・火力と完了の目安を明記。肉・魚は中心まで、卵は固まるまで加熱し、半生・半熟は勧めない〉

### 調理のポイント
- 〈材料の持ち味を活かし、無理なくおいしく作るコツを1〜3点〉

### 味の調整
- 濃い場合：〈完成後に水・湯で薄める。できない料理は「調整できない」。食材追加は禁止〉
- 薄い場合：〈完成後、調味料で補う微調整〉`;

export function makeEmptyPromptData(overrides: Partial<PromptData> = {}): PromptData {
  return {
    requestIntent: "auto",
    materialUseMode: "auto",
    materialRequests: [],
    materials: [],
    targetDish: [],
    recipeRoles: [],
    cookingTools: [],
    pairingTargets: [],
    recipeDirections: [],
    ngFoodsAndSeasonings: [],
    servings: "",
    servingsMode: "unspecified",
    recipeCount: "auto",
    cookTime: "",
    supplementalNotes: "",
    ...overrides,
  };
}

function normalizePromptData(data: PromptData): PromptData {
  return {
    ...selectCurrentRequest(data),
    materialRequests: data.materialUseMode === "specified" ? data.materialRequests : [],
  };
}

function buildOutputTemplate(data: PromptData): string {
  const template = data.servings
    ? RECIPE_OUTPUT_TEMPLATE.replace("〈分量〉", "〈入力の人数・分量に合う量〉")
    : RECIPE_OUTPUT_TEMPLATE;
  return [
    "## 出力テンプレート",
    "家庭で無理なく作れる料理を日本語で。〈〉を具体的な内容に置き換え、次の形式だけで回答してください。",
    data.supplementalNotes
      ? "品数の希望に従い、希望がなければ1品。複数品は料理ごとに同じ形式にし、求められた追加説明だけ末尾へ付けてください。"
      : "1品分だけを出力してください。",
    "",
    template,
    "",
    "## 条件を満たせない場合",
    "入力条件を両立できないときはレシピを作らず、次の形式だけで回答してください。",
    "### 難しい理由",
    "〈理由を1〜3文〉",
    "### 衝突している条件",
    "- 〈両立できない入力条件〉",
  ].join("\n");
}

function materialLine(name: string, request: MaterialRequest | undefined): string {
  if (!request) return `- ${name}`;
  const amount = request.useUpAmount.trim();
  const hasCustomAmount = request.useUpAmountMode === "custom" && amount;
  if (request.usage === "required")
    return `- ${name}（必ず使う・${hasCustomAmount ? `使う量: ${amount}` : "記載量を使う"}）`;
  if (request.usage === "use-up")
    return `- ${name}（${hasCustomAmount ? `使い切る量: ${amount}` : "使い切る・記載量を使う"}）`;
  return `- ${name}${hasCustomAmount ? `（量: ${amount}）` : ""}`;
}

function buildInputConditions(data: PromptData): string {
  const sections: string[] = [];
  if (data.materials.length)
    sections.push(
      "### 家にある食材・材料\n\n" +
        data.materials
          .map((name) =>
            materialLine(
              name,
              data.materialRequests.find((item) => item.name === name),
            ),
          )
          .join("\n"),
    );
  if (data.servings) sections.push(`### 人数・分量\n\n${data.servings}`);
  if (data.cookingTools.length)
    sections.push(
      `### 調理方法・調理器具\n\n${data.cookingTools.map((item) => `- ${item}`).join("\n")}`,
    );
  if (data.supplementalNotes) sections.push(`### その他の要望\n\n${data.supplementalNotes}`);
  return sections.length ? `## 入力条件\n\n${sections.join("\n\n")}` : "";
}

function buildConstraints(data: PromptData): string {
  const rules = [
    "- 材料欄・手順・味の調整のすべてで、入力にない食材（米・麺・肉・野菜・乳製品等）は使用禁止。追加できるのは一般的な調味料だけ。買い足しは提案しない。",
  ];
  if (
    data.materials.some((name) => {
      const request = data.materialRequests.find((item) => item.name === name);
      return !request || request.usage === "auto";
    })
  )
    rules.push("- 使用指定のない食材は、全部・全量を使う必要はない。");
  if (data.materials.length) rules.push("- 食材の記載量は全品合計の上限。");
  if (
    data.materials.some((name) =>
      data.materialRequests.some((item) => item.name === name && item.usage === "use-up"),
    )
  )
    rules.push("- 使い切る量は各品へ重複計上せず、合計で使い切る。");
  if (data.supplementalNotes)
    rules.push("- その他の要望を守る。調味料の追加可よりも、禁止指定を優先する。");
  if (data.cookingTools.length)
    rules.push(
      "- 加熱は指定した調理方法・調理器具だけ。包丁・まな板・ボウル等の下ごしらえ道具は使ってよい。",
    );
  if (/子供|子ども|幼児/.test(data.servings))
    rules.push("- 子供・幼児には薄味で辛くせず、柔らかく小さく切る。");
  return `## 守る条件\n\n${rules.join("\n")}`;
}

export function buildPrompt(data: PromptData): string {
  const current = normalizePromptData(data);
  return [buildOutputTemplate(current), buildInputConditions(current), buildConstraints(current)]
    .filter(Boolean)
    .join("\n\n");
}
