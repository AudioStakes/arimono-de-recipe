import type { PromptData } from "./types";

const NEWLINE = "\n";

type PresentComboSection = {
  title: string;
  items: string[];
};

const INPUT_SECTION_ORDER: PresentComboSection["title"][] = [
  "家にある食材",
  "料理区分・作りたいもの",
  "使いたい調理器具・調理方法",
  "合わせたい料理・一緒に出す料理",
  "食べる人数",
  "調理時間",
  "作りやすさ・手軽さ",
  "味や雰囲気",
  "NG食材・調味料",
  "その他の要望",
];

const COMBO_SECTION_DEFINITIONS = [
  { key: "materials", title: "家にある食材" },
  { key: "dishTypes", title: "料理区分・作りたいもの" },
  { key: "cookingTools", title: "使いたい調理器具・調理方法" },
  { key: "pairingTargets", title: "合わせたい料理・一緒に出す料理" },
  { key: "difficulty", title: "作りやすさ・手軽さ" },
  { key: "recipeDirections", title: "味や雰囲気" },
  { key: "ngFoodsAndSeasonings", title: "NG食材・調味料" },
] as const;

export function makeEmptyPromptData(overrides: Partial<PromptData> = {}): PromptData {
  return {
    materials: [],
    dishTypes: [],
    cookingTools: [],
    pairingTargets: [],
    difficulty: [],
    recipeDirections: [],
    ngFoodsAndSeasonings: [],
    servings: "",
    cookTime: "",
    supplementalNotes: "",
    ...overrides,
  };
}

function includesChildren(servings: string): boolean {
  return /子供|幼児/.test(servings);
}

function hasAnyInput(data: PromptData): boolean {
  return Boolean(
    data.servings ||
      data.cookTime ||
      data.supplementalNotes ||
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

function buildPurposeSection(): string {
  return buildSection(
    "## 目的",
    "以下の入力条件をもとに、条件を満たすレシピを1つだけ提案してください。",
  );
}

function getPresentInputSections(data: PromptData): Array<{ title: string; body: string }> {
  const sections: Array<{ title: string; body: string }> = [];

  for (const { key, title } of COMBO_SECTION_DEFINITIONS) {
    const items = data[key];
    if (!items.length) continue;
    sections.push({
      title,
      body: bulletList(items),
    });
  }

  if (data.servings) {
    sections.push({ title: "食べる人数", body: data.servings });
  }

  if (data.cookTime) {
    sections.push({ title: "調理時間", body: data.cookTime });
  }

  if (data.supplementalNotes) {
    sections.push({ title: "その他の要望", body: data.supplementalNotes });
  }

  return sections.sort(
    (left, right) =>
      INPUT_SECTION_ORDER.indexOf(left.title) - INPUT_SECTION_ORDER.indexOf(right.title),
  );
}

function buildInputConditionsSection(data: PromptData): string {
  const sections = getPresentInputSections(data);
  if (!sections.length) {
    return buildSection("## 入力条件", "入力条件はありません。");
  }

  const body = sections
    .map(({ title, body: sectionBody }) => [`### ${title}`, "", sectionBody].join(NEWLINE))
    .join(`${NEWLINE}${NEWLINE}`);

  return buildSection("## 入力条件", body);
}

function buildPriorityRulesSection(data: PromptData): string {
  const mainIngredientRule =
    data.materials.length > 0
      ? "2. 家にない肉、魚、卵、豆腐、野菜、きのこ、海藻、乳製品などの新しい主材料を追加しないでください。"
      : "2. 家にある材料が不明な場合でも、買い足し前提の新しい主材料の追加はできるだけ避け、家庭で自然な材料構成を優先してください。";

  return buildSection(
    "## 最優先ルール",
    [
      "1. 安全性とNG食材・調味料を最優先してください。",
      mainIngredientRule,
      "3. 指定された料理区分・調理器具・調理方法を守ってください。",
      "4. 家庭で無理なく作れることを優先してください。",
      "5. 意外性は、上記を満たす範囲で歓迎します。",
    ].join(NEWLINE),
  );
}

function buildIngredientRulesSection(data: PromptData): string {
  const lines = ["調味料は、家庭料理として自然な範囲で使ってかまいません。"];

  if (data.materials.length > 0) {
    lines.push(
      "",
      "### 指定材料の扱い",
      "",
      "指定された食材・材料は、可能な範囲で活用してください。",
      "",
      "ただし、味や調理上不自然になる場合は、無理にすべてを使い切るよりも、自然でおいしく食べられる仕上がりを優先してください。",
      "",
      "### 主材料の追加制限",
      "",
      "家にない肉、魚、卵、豆腐、野菜、きのこ、海藻、乳製品などの新しい主材料は追加しないでください。",
    );
  }

  if (data.ngFoodsAndSeasonings.length > 0) {
    lines.push(
      "",
      "### NG食材・調味料の扱い",
      "",
      "NG食材・調味料に含まれるものは使わないでください。",
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

  if (data.materials.length > 0) {
    lines.push("- 家にある食材: 指定された食材・材料を中心に使う");
  }
  if (data.dishTypes.length > 0) {
    lines.push("- 料理区分・作りたいもの: 指定された料理区分だけを提案する");
  }
  if (data.cookingTools.length > 0) {
    lines.push("- 使いたい調理器具・調理方法: 指定された調理方法・調理器具だけで作れる手順にする");
  }
  if (data.pairingTargets.length > 0) {
    lines.push("- 合わせたい料理・一緒に出す料理: 味・食感・量が重なりすぎないようにする");
  }
  if (data.servings) {
    lines.push("- 食べる人数: 指定人数に対して現実的な量にする");
  }
  if (data.cookTime) {
    lines.push("- 調理時間: 下ごしらえ、加熱、仕上げを含めて指定時間に収める");
  }
  if (data.difficulty.length > 0) {
    lines.push("- 作りやすさ・手軽さ: 手順数、包丁作業、洗い物、加熱管理の少なさに反映する");
  }
  if (data.recipeDirections.length > 0) {
    lines.push("- 味や雰囲気: 味付け、食感、油分、温度感に反映する");
  }
  if (data.ngFoodsAndSeasonings.length > 0) {
    lines.push("- NG食材・調味料: 指定された食材・調味料を使わない");
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
    "- 余計な提案を含めていないか",
  ];

  if (data.materials.length > 0) {
    lines.push("- 家にある食材: 指定された食材・材料を中心に使っているか");
  }
  if (data.dishTypes.length > 0) {
    lines.push("- 料理区分・作りたいもの: 指定された料理区分以外を提案していないか");
  }
  if (data.cookingTools.length > 0) {
    lines.push(
      "- 使いたい調理器具・調理方法: 指定された調理方法・調理器具以外の加熱工程を含めていないか",
    );
  }
  if (data.pairingTargets.length > 0) {
    lines.push(
      "- 合わせたい料理・一緒に出す料理: 一緒に出す料理と味・食感・量のバランスが取れているか",
    );
  }
  if (data.servings) {
    lines.push("- 食べる人数: 指定人数に対して分量が現実的か");
  }
  if (data.cookTime) {
    lines.push("- 調理時間: 指定時間内で作れる内容か");
  }
  if (data.difficulty.length > 0) {
    lines.push("- 作りやすさ・手軽さ: 指定された作りやすさを反映しているか");
  }
  if (data.recipeDirections.length > 0) {
    lines.push("- 味や雰囲気: 指定された方向性を反映しているか");
  }
  if (data.ngFoodsAndSeasonings.length > 0) {
    lines.push("- NG食材・調味料: NG食材・調味料を使っていないか");
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
      "- 複数のレシピ案",
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
    "料理名を1つ書いてください。",
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
      "### 食べる人数に合わせた使う材料",
      "",
      "指定人数に合う分量で、材料と調味料を箇条書きにしてください。",
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
  return [
    buildRoleSection(),
    buildPurposeSection(),
    buildInputConditionsSection(data),
    buildPriorityRulesSection(data),
    buildIngredientRulesSection(data),
    buildHomeCookingQualitySection(data),
    buildConditionInterpretationSection(data),
    buildInternalCheckSection(data),
    buildExcludedOutputsSection(),
    buildImpossibleCaseSection(),
    buildOutputFormatSection(data),
  ]
    .join(`${NEWLINE}${NEWLINE}`)
    .trim();
}
