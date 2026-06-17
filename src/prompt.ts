import type { MaterialRequest, PromptData } from "./types";

const NEWLINE = "\n";

type PresentInputSection = {
  title: string;
  body: string;
};

const REQUEST_INTENT_LABELS = {
  auto: "ありものでおまかせ",
  "target-dish": "作りたい料理がある",
  pairing: "一緒に出す料理に合わせたい",
} as const satisfies Record<PromptData["requestIntent"], string>;

const RECIPE_COUNT_LABELS = {
  auto: "おまかせ",
  one: "1品だけ",
  multiple: "複数品を指定",
} as const satisfies Record<PromptData["recipeCount"], string>;

const MATERIALS_SECTION_TITLE = "家にある食材・材料";
const PAIRING_TARGETS_SECTION_TITLE = "一緒に出す料理";
const AS_WRITTEN_AMOUNT_LABEL = "家にある食材・材料に書いた量を使う";

const INPUT_SECTION_ORDER = [
  "今回やりたいこと",
  MATERIALS_SECTION_TITLE,
  "必ず使う食材・材料",
  "使い切りたい食材・材料",
  "作りたい料理",
  PAIRING_TARGETS_SECTION_TITLE,
  "人数・分量",
  "作りたい品数",
  "料理の役割・量感",
  "調理方法・調理器具",
  "調理時間",
  "レシピの方向性",
  "使えない・持っていない食材・調味料",
  "その他の要望",
] as const;

const COMBO_SECTION_DEFINITIONS = [
  { key: "materials", title: MATERIALS_SECTION_TITLE },
  { key: "targetDish", title: "作りたい料理" },
  { key: "pairingTargets", title: PAIRING_TARGETS_SECTION_TITLE },
  { key: "recipeRoles", title: "料理の役割・量感" },
  { key: "cookingTools", title: "調理方法・調理器具" },
  { key: "recipeDirections", title: "レシピの方向性" },
  { key: "ngFoodsAndSeasonings", title: "使えない・持っていない食材・調味料" },
] as const;

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
    materialRequests: data.materialUseMode === "specified" ? data.materialRequests : [],
  };
}

function shouldIncludeRequestIntent(data: PromptData): boolean {
  return data.requestIntent !== "auto";
}

function includesChildren(servings: string): boolean {
  return /子供|幼児/.test(servings);
}

function hasAnyInput(data: PromptData): boolean {
  return Boolean(
    shouldIncludeRequestIntent(data) ||
      data.servings ||
      data.cookTime ||
      data.supplementalNotes ||
      data.recipeCount !== "auto" ||
      data.materialRequests.some((request) => request.usage !== "auto") ||
      COMBO_SECTION_DEFINITIONS.some(({ key }) => data[key].length > 0),
  );
}

function bulletList(items: string[]): string {
  return items.map((item) => `- ${item}`).join(NEWLINE);
}

function buildSection(title: string, body: string): string {
  return [title, "", body].join(NEWLINE);
}

function buildRoleSection(): string {
  return buildSection(
    "## 役割",
    [
      "あなたは、家庭料理を専門とする料理研究家です。",
      "",
      "ありものの材料を活かし、今日の食卓に自然になじむ、食べやすく無理なく作れる家庭料理を提案してください。",
    ].join(NEWLINE),
  );
}

function buildPurposeSection(data: PromptData): string {
  const purpose =
    data.recipeCount === "multiple"
      ? "以下の入力条件をもとに、条件を満たすレシピを指定された品数で提案してください。"
      : "以下の入力条件をもとに、条件を満たすレシピを1つ提案してください。";

  return buildSection("## 目的", purpose);
}

function getRelevantMaterialRequests(data: PromptData): MaterialRequest[] {
  if (data.materialUseMode !== "specified") {
    return [];
  }
  const knownMaterials = new Set(data.materials);
  return data.materialRequests.filter(
    (request) => knownMaterials.has(request.name) && request.usage !== "auto",
  );
}

function getRequiredMaterialRequests(data: PromptData): MaterialRequest[] {
  return getRelevantMaterialRequests(data).filter((request) => request.usage === "required");
}

function getUseUpMaterialRequests(data: PromptData): MaterialRequest[] {
  return getRelevantMaterialRequests(data).filter((request) => request.usage === "use-up");
}

function formatMaterialRequestAmount(request: MaterialRequest, customAmountLabel: string): string {
  if (request.useUpAmountMode === "custom" && request.useUpAmount.trim()) {
    return `${request.name}（${customAmountLabel}: ${request.useUpAmount.trim()}）`;
  }
  return `${request.name}（${AS_WRITTEN_AMOUNT_LABEL}）`;
}

function getRequiredMaterials(data: PromptData): string[] {
  return getRequiredMaterialRequests(data).map((request) =>
    formatMaterialRequestAmount(request, "使う量"),
  );
}

function formatUseUpMaterialRequest(request: MaterialRequest): string {
  return formatMaterialRequestAmount(request, "使い切りたい量");
}

function shouldIncludeRecipeCount(data: PromptData): boolean {
  return data.recipeCount !== "auto" || data.requestIntent === "pairing";
}

function getPresentInputSections(data: PromptData): PresentInputSection[] {
  const sections: PresentInputSection[] = [];

  if (shouldIncludeRequestIntent(data)) {
    sections.push({
      title: "今回やりたいこと",
      body: REQUEST_INTENT_LABELS[data.requestIntent],
    });
  }

  const requiredMaterials = getRequiredMaterials(data);
  const useUpMaterials = getUseUpMaterialRequests(data);

  for (const { key, title } of COMBO_SECTION_DEFINITIONS) {
    const items = data[key];
    if (!items.length) continue;
    sections.push({
      title,
      body: bulletList(items),
    });
  }

  if (requiredMaterials.length > 0) {
    sections.push({
      title: "必ず使う食材・材料",
      body: bulletList(requiredMaterials),
    });
  }

  if (useUpMaterials.length > 0) {
    sections.push({
      title: "使い切りたい食材・材料",
      body: bulletList(useUpMaterials.map(formatUseUpMaterialRequest)),
    });
  }

  if (data.servings) {
    sections.push({ title: "人数・分量", body: data.servings });
  }

  if (shouldIncludeRecipeCount(data)) {
    sections.push({ title: "作りたい品数", body: RECIPE_COUNT_LABELS[data.recipeCount] });
  }

  if (data.cookTime) {
    sections.push({ title: "調理時間", body: data.cookTime });
  }

  if (data.supplementalNotes) {
    sections.push({ title: "その他の要望", body: data.supplementalNotes });
  }

  return sections.sort(
    (left, right) =>
      INPUT_SECTION_ORDER.indexOf(left.title as (typeof INPUT_SECTION_ORDER)[number]) -
      INPUT_SECTION_ORDER.indexOf(right.title as (typeof INPUT_SECTION_ORDER)[number]),
  );
}

function buildInputConditionsSection(data: PromptData): string {
  const sections = getPresentInputSections(data);
  if (sections.length === 0) {
    return "";
  }

  const body = sections
    .map(({ title, body: sectionBody }) => [`### ${title}`, "", sectionBody].join(NEWLINE))
    .join(`${NEWLINE}${NEWLINE}`);

  return buildSection("## 入力条件", body);
}

function buildPriorityRulesSection(): string {
  return buildSection(
    "## 最優先ルール",
    [
      "1. 安全性と使えない・持っていない食材・調味料を最優先してください。",
      "2. 買い足しを前提にせず、家にない主材料を追加しないでください。",
      "3. 自然な家庭料理として成立する範囲で、指定された食材・材料と要望を守ってください。",
      "4. 家庭で無理なく作れることを優先してください。",
      "5. 意外性は、上記を満たす範囲で歓迎します。",
    ].join(NEWLINE),
  );
}

function buildIngredientRulesSection(data: PromptData): string {
  const lines = [
    "調味料は、家庭料理として自然な範囲で使ってかまいません。",
    "ただし、使えない・持っていない食材・調味料に含まれるものは使わないでください。",
    "",
    "家にない肉、魚、卵、豆腐、野菜、きのこ、海藻、乳製品などの新しい主材料は追加しないでください。",
  ];

  if (data.materials.length > 0) {
    lines.push(
      "",
      "### 指定材料の扱い",
      "",
      "指定された食材・材料は、可能な範囲で活用してください。",
      "",
      "ただし、材料の使い方で指定されたもの以外は、無理にすべてを使い切るよりも、自然でおいしく食べられる仕上がりを優先してください。",
    );
  }

  const requiredMaterials = getRequiredMaterialRequests(data);
  if (requiredMaterials.length > 0) {
    lines.push(
      "",
      "### 必ず使う食材・材料の扱い",
      "",
      "必ず使う食材・材料は、指定された量の扱いに従い、提案するレシピに自然な形で含めてください。",
      `「${AS_WRITTEN_AMOUNT_LABEL}」とある場合は、量を自動解析せず、その記載量を使う前提として扱ってください。`,
    );
  }

  const useUpMaterials = getUseUpMaterialRequests(data);
  if (useUpMaterials.length > 0) {
    lines.push(
      "",
      "### 使い切りたい食材・材料の扱い",
      "",
      "使い切りたい食材・材料は、指定された量の扱いに従って使ってください。",
      `「${AS_WRITTEN_AMOUNT_LABEL}」とある場合は、量を自動解析せず、その記載量を使い切る前提として扱ってください。`,
    );
  }

  if (data.ngFoodsAndSeasonings.length > 0) {
    lines.push(
      "",
      "### 使えない・持っていない食材・調味料の扱い",
      "",
      "使えない・持っていない食材・調味料に含まれるものは使わないでください。",
    );
  }

  return buildSection("## 材料・調味料の扱い", lines.join(NEWLINE));
}

function buildHomeCookingQualitySection(data: PromptData): string {
  const lines = [
    "レシピは、家庭で無理なく作れて、食卓になじむ内容にしてください。",
    "",
    "- 指定材料の持ち味を活かしてください。",
    "- 味付けは濃くしすぎず、最後に調整しやすい設計にしてください。",
    "- 塩味だけに頼らず、だし、酸味、香り、油分、食感で満足感を出してください。",
    "- 家庭で再現しやすい分量、手順、調理時間にしてください。",
    "- 肉、魚、卵を使う場合は、火通りが安全に分かる手順にしてください。",
    "- 洗い物や同時進行が増えすぎないようにしてください。",
    "- ありものを活かしつつ、家庭で再現できる範囲で少し意外性のある味付けや組み合わせも歓迎します。",
  ];

  if (data.pairingTargets.length > 0) {
    lines.push(
      "- 一緒に出す料理がある場合は、味、油分、食感、量が重なりすぎないようにしてください。",
    );
  }

  if (includesChildren(data.servings)) {
    lines.push(
      "- 子どもや幼児が含まれる場合は、薄味を基本にし、辛すぎる味、硬すぎる食感、大きすぎる切り方を避けてください。",
    );
  }

  return buildSection("## 家庭料理としての品質基準", lines.join(NEWLINE));
}

function buildConditionInterpretationSection(data: PromptData): string {
  const lines = ["入力条件は、以下のように反映してください。", ""];

  if (data.requestIntent === "target-dish") {
    lines.push("- 今回やりたいこと: 作りたい料理に近づける。家にない材料の買い足しは前提にしない");
  }
  if (data.requestIntent === "pairing") {
    lines.push(
      "- 今回やりたいこと: 一緒に出す料理と味、食感、油分、量が重なりすぎない料理を提案する",
    );
  }

  if (data.materials.length > 0) {
    lines.push("- 家にある食材・材料: 指定された食材・材料を中心に使う");
  }
  if (getRequiredMaterialRequests(data).length > 0) {
    lines.push("- 必ず使う食材・材料: 指定された食材・材料を必ず含める");
  }
  if (getUseUpMaterialRequests(data).length > 0) {
    lines.push("- 使い切りたい食材・材料: 指定された量の扱いに従って使い切る");
  }
  if (data.targetDish.length > 0) {
    lines.push("- 作りたい料理: 指定された料理を、ありものの食材・材料で自然に作れる形に寄せる");
  }
  if (data.pairingTargets.length > 0) {
    lines.push("- 一緒に出す料理: 味・食感・量が重なりすぎないようにする");
  }
  if (data.servings) {
    lines.push("- 人数・分量: 指定人数や分量に対して現実的な量にする");
  }
  if (shouldIncludeRecipeCount(data)) {
    if (data.recipeCount === "one") {
      lines.push("- 作りたい品数: 1品だけ提案する");
    } else if (data.recipeCount === "multiple") {
      lines.push("- 作りたい品数: 複数品を提案する");
    } else {
      lines.push("- 作りたい品数: 1品か複数品かは自然な範囲で判断する");
    }
  }
  if (data.recipeRoles.length > 0) {
    const roleRule =
      data.recipeCount === "multiple"
        ? "指定された役割ごとに1品ずつ提案する"
        : "指定された料理の役割・量感に合う料理を提案する";
    lines.push(`- 料理の役割・量感: ${roleRule}`);
  }
  if (data.cookingTools.length > 0) {
    lines.push("- 調理方法・調理器具: 指定された調理方法・調理器具だけで作れる手順にする");
  }
  if (data.cookTime) {
    lines.push("- 調理時間: 下ごしらえ、加熱、仕上げを含めて指定時間に収める");
  }
  if (data.recipeDirections.length > 0) {
    lines.push("- レシピの方向性: 味付け、食感、油分、温度感に反映する");
  }
  if (data.ngFoodsAndSeasonings.length > 0) {
    lines.push("- 使えない・持っていない食材・調味料: 指定された食材・調味料を使わない");
  }
  if (data.supplementalNotes) {
    lines.push("- その他の要望: 内容を自然に反映する");
  }
  if (includesChildren(data.servings)) {
    lines.push("- 子ども・幼児: 辛すぎる味、濃すぎる味、硬すぎる食感、大きすぎる切り方を避ける");
  }

  if (data.cookingTools.length > 0) {
    lines.push(
      "",
      "### 調理器具の補足",
      "",
      "指定された調理器具以外の加熱器具を使わないでください。",
      "",
      "包丁、まな板、ボウル、菜箸、計量スプーンなど、下ごしらえに必要な一般的な道具は使ってかまいません。",
    );
  }

  return buildSection("## 条件の解釈", lines.join(NEWLINE).trimEnd());
}

function buildInternalCheckSection(data: PromptData): string {
  const lines = [
    "レシピを出力する前に、内部で以下を確認してください。",
    "",
    "- 入力条件を自然に反映しているか",
    "- 家庭料理として無理なく作れるか",
    "- 今日の食卓に自然になじむか",
    "- 家族が食べやすい味・食感・分量になっているか",
    "- 作る人の負担が大きすぎないか",
    "- 味付けが濃くなりすぎていないか",
    "- 味の微調整がしやすい設計になっているか",
    "- 香り、食感、温度感、汁気、彩りのいずれかで満足感を補えているか",
    "- 分量・調理時間・手順が家庭で実行可能か",
    "- 買い足しや家にない主材料の追加を前提にしていないか",
  ];

  if (data.materials.length > 0) {
    lines.push("- 家にある食材・材料: 指定された食材・材料を中心に使っているか");
  }
  if (getRequiredMaterialRequests(data).length > 0) {
    lines.push("- 必ず使う食材・材料: 指定された食材・材料を含めているか");
  }
  if (getUseUpMaterialRequests(data).length > 0) {
    lines.push("- 使い切りたい食材・材料: 指定された量の扱いを守っているか");
  }
  if (data.targetDish.length > 0) {
    lines.push("- 作りたい料理: 指定された料理から不自然に外れていないか");
  }
  if (data.recipeRoles.length > 0) {
    lines.push("- 料理の役割・量感: 指定された役割や量感に合っているか");
  }
  if (data.cookingTools.length > 0) {
    lines.push("- 調理方法・調理器具: 指定された調理方法・調理器具以外の加熱工程を含めていないか");
  }
  if (data.pairingTargets.length > 0) {
    lines.push("- 一緒に出す料理: 味・食感・量のバランスが取れているか");
  }
  if (data.servings) {
    lines.push("- 人数・分量: 指定人数や分量に対して量が現実的か");
  }
  if (data.cookTime) {
    lines.push("- 調理時間: 指定時間内で作れる内容か");
  }
  if (data.recipeDirections.length > 0) {
    lines.push("- レシピの方向性: 指定された方向性を反映しているか");
  }
  if (data.ngFoodsAndSeasonings.length > 0) {
    lines.push("- 使えない・持っていない食材・調味料: 指定されたものを使っていないか");
  }
  if (data.supplementalNotes) {
    lines.push("- その他の要望: その他の要望を反映しているか");
  }

  lines.push("", "この確認過程は出力しないでください。");

  return buildSection("## 回答前の内部確認", lines.join(NEWLINE));
}

function buildExcludedOutputsSection(): string {
  return buildSection(
    "## 出力しないもの",
    [
      "以下は出力しないでください。",
      "",
      "- 買い足し提案",
      "- 代用案",
      "- 保存方法",
      "- 栄養解説",
      "- 献立全体の追加提案",
      "- 指定品数を超える追加レシピ案",
      "- 前置き",
      "- 挨拶",
      "- 確認コメント",
      "- 内部確認の結果",
      "- プロンプトの解説",
    ].join(NEWLINE),
  );
}

function buildImpossibleCaseSection(): string {
  return buildSection(
    "## 条件を満たせない場合",
    [
      "指定条件を満たすレシピが作れない場合は、レシピを作らず、以下の形式で短く出力してください。",
      "",
      "### 難しい理由",
      "",
      "1〜3文で説明してください。",
      "",
      "### 衝突している条件",
      "",
      "箇条書きで示してください。",
    ].join(NEWLINE),
  );
}

function buildOutputFormatSection(data: PromptData): string {
  const lines = [
    "条件を満たせる場合は、必ず以下の形式で出力してください。",
    "",
    "### レシピ名",
    "",
    data.recipeCount === "multiple"
      ? "指定された品数に合わせて、料理名をそれぞれ書いてください。"
      : "料理名を1つ書いてください。",
  ];

  if (data.pairingTargets.length > 0) {
    lines.push(
      "",
      "### 一緒に出す料理との相性",
      "",
      "味、食感、量のバランスがどう合うかを1〜3文で説明してください。",
    );
  }

  if (data.servings) {
    lines.push(
      "",
      "### 人数・分量に合わせた使う材料",
      "",
      "指定人数や分量に合う量で、材料と調味料を箇条書きにしてください。",
    );
  } else {
    lines.push("", "### 使う材料", "", "材料と調味料を箇条書きにしてください。");
  }

  lines.push(
    "",
    "分量は、家庭で作りやすい単位を優先してください。",
    "",
    "例:",
    "- 1束",
    "- 1/2袋",
    "- 1パック",
    "- 大さじ1",
    "- 小さじ1",
    "- 少々",
    "",
    "### 作り方",
    "",
    "3〜6手順で書いてください。",
    "",
    "各手順は1〜2文にしてください。",
    "",
    "家庭でそのまま実行できる具体的な手順にしてください。",
  );

  if (data.recipeCount === "multiple" && data.recipeRoles.length > 0) {
    lines.push("", "指定された料理の役割・量感ごとに、1品ずつ作り方を書いてください。");
  }

  if (data.cookingTools.length > 0) {
    lines.push("", "指定された調理方法・調理器具だけで作れる手順にしてください。");
  }

  lines.push(
    "",
    "### 調理のポイント",
    "",
    "おいしく作るためのポイントを1〜3個、箇条書きで書いてください。",
    "",
    "### 味の調整",
    "",
    "味が濃い場合と薄い場合の調整方法を、それぞれ1つずつ短く書いてください。",
    "",
    "- 買い足しを前提にしない",
    "- 大きなアレンジにしない",
    "- 家庭でその場でできる微調整にする",
  );

  if (includesChildren(data.servings)) {
    lines.push("- 子ども・幼児がいる場合は、刺激の強い調整にしない");
  }

  if (hasAnyInput(data)) {
    lines.push(
      "",
      "### 条件に合わせた調理のポイント",
      "",
      "指定条件を守るための注意点があれば、ここに短く含めてください。",
    );
  }

  return buildSection("## 出力形式", lines.join(NEWLINE));
}

export function buildPrompt(data: PromptData): string {
  const promptData = normalizePromptData(data);

  return [
    buildRoleSection(),
    buildPurposeSection(promptData),
    buildInputConditionsSection(promptData),
    buildPriorityRulesSection(),
    buildIngredientRulesSection(promptData),
    buildHomeCookingQualitySection(promptData),
    buildConditionInterpretationSection(promptData),
    buildInternalCheckSection(promptData),
    buildExcludedOutputsSection(),
    buildImpossibleCaseSection(),
    buildOutputFormatSection(promptData),
  ]
    .filter((section) => section.length > 0)
    .join(`${NEWLINE}${NEWLINE}`)
    .trim();
}
