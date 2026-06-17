import { describe, expect, test } from "vitest";
import { buildPrompt, makeEmptyPromptData } from "../../src/prompt";

describe("buildPrompt", () => {
  test("ケース1: 基本入力ありの構造化プロンプトを出力する", () => {
    const prompt = buildPrompt(
      makeEmptyPromptData({
        requestIntent: "pairing",
        materials: ["しろ菜", "しめじ", "豆腐150g"],
        materialUseMode: "specified",
        materialRequests: [
          {
            id: "material-1",
            name: "しろ菜",
            usage: "required",
            useUpAmountMode: "as-written",
            useUpAmount: "",
          },
          {
            id: "material-2",
            name: "豆腐150g",
            usage: "use-up",
            useUpAmountMode: "as-written",
            useUpAmount: "",
          },
        ],
        recipeCount: "one",
        recipeRoles: ["副菜・一品"],
        cookingTools: ["ヘルシオ ホットクック"],
        pairingTargets: ["餃子"],
        servings: "大人2人、子供1人、幼児1人",
        servingsMode: "custom",
        recipeDirections: ["あっさり"],
      }),
    );

    expect(prompt).toContain("## 役割");
    expect(prompt).toContain("## 入力条件");
    expect(prompt).toContain("### 今回やりたいこと\n\n一緒に出す料理に合わせたい");
    expect(prompt).toContain("### 家にある食材・材料");
    expect(prompt).toContain(
      "### 必ず使う食材・材料\n\n- しろ菜（家にある食材・材料に書いた量を使う）",
    );
    expect(prompt).toContain(
      "### 使い切りたい食材・材料\n\n- 豆腐150g（家にある食材・材料に書いた量を使う）",
    );
    expect(prompt).toContain("### 作りたい品数\n\n1品だけ");
    expect(prompt).toContain("### 料理の役割・量感\n\n- 副菜・一品");
    expect(prompt).toContain("### 調理方法・調理器具");
    expect(prompt).toContain("### 一緒に出す料理");
    expect(prompt).toContain("### 人数・分量");
    expect(prompt).not.toContain("### 調理時間");
    expect(prompt).toContain("### 一緒に出す料理との相性");
    expect(prompt).toContain("指定された調理方法・調理器具だけで作れる手順にしてください。");
    expect(prompt).not.toContain("★");
  });

  test("ケース2: 食材なしなら食材固有の項目を出さない", () => {
    const prompt = buildPrompt(
      makeEmptyPromptData({
        requestIntent: "target-dish",
        targetDish: ["カレー"],
      }),
    );

    expect(prompt).toContain("### 今回やりたいこと\n\n作りたい料理がある");
    expect(prompt).toContain("### 作りたい料理\n\n- カレー");
    expect(prompt).not.toContain("### 家にある食材・材料");
    expect(prompt).not.toContain("### 指定材料の扱い");
    expect(prompt).not.toContain("### 必ず使う食材・材料");
    expect(prompt).not.toContain("### 使い切りたい食材・材料");
    expect(prompt).toContain("家にない主材料を追加しないでください。");
  });

  test("ケース3: 使えない食材ありなら専用ルールと内部確認を出す", () => {
    const prompt = buildPrompt(
      makeEmptyPromptData({
        ngFoodsAndSeasonings: ["にんにく", "唐辛子"],
      }),
    );

    expect(prompt).toContain("### 使えない・持っていない食材・調味料");
    expect(prompt).toContain("### 使えない・持っていない食材・調味料の扱い");
    expect(prompt).toContain(
      "使えない・持っていない食材・調味料に含まれるものは使わないでください。",
    );
    expect(prompt).toContain(
      "- 使えない・持っていない食材・調味料: 指定されたものを使っていないか",
    );
  });

  test("ケース4: 子供・幼児ありなら配慮ルールを出す", () => {
    const prompt = buildPrompt(
      makeEmptyPromptData({
        servings: "大人2人、子供1人、幼児1人",
        servingsMode: "custom",
      }),
    );

    expect(prompt).toContain(
      "子どもや幼児が含まれる場合は、薄味を基本にし、辛すぎる味、硬すぎる食感、大きすぎる切り方を避けてください。",
    );
    expect(prompt).toContain(
      "- 子ども・幼児: 辛すぎる味、濃すぎる味、硬すぎる食感、大きすぎる切り方を避ける",
    );
    expect(prompt).toContain("- 子ども・幼児がいる場合は、刺激の強い調整にしない");
  });

  test("ケース5: 調理時間ありなら時間解釈を出す", () => {
    const prompt = buildPrompt(
      makeEmptyPromptData({
        cookTime: "20分以内",
      }),
    );

    expect(prompt).toContain("### 調理時間");
    expect(prompt).toContain("下ごしらえ、加熱、仕上げを含めて指定時間に収める");
    expect(prompt).toContain("- 調理時間: 指定時間内で作れる内容か");
  });

  test("ケース6: 条件衝突時の出力形式を含む", () => {
    const prompt = buildPrompt(makeEmptyPromptData());

    expect(prompt).toContain("## 条件を満たせない場合");
    expect(prompt).toContain("### 難しい理由");
    expect(prompt).toContain("### 衝突している条件");
  });

  test("入力が空の項目は入力条件セクションに出さない", () => {
    const prompt = buildPrompt(
      makeEmptyPromptData({
        materials: ["豆腐"],
        supplementalNotes: "味は濃くしすぎない。",
      }),
    );

    expect(prompt).toContain("### 家にある食材・材料");
    expect(prompt).toContain("### その他の要望");
    expect(prompt).not.toContain("### 作りたい料理");
    expect(prompt).not.toContain("### 調理時間");
    expect(prompt.trimStart().startsWith("## 役割")).toBe(true);
  });

  test("完全に未指定なら任意項目の見出しとルールを出さない", () => {
    const prompt = buildPrompt(makeEmptyPromptData());

    expect(prompt).not.toContain("## 入力条件");
    expect(prompt).not.toContain("### 今回やりたいこと");
    expect(prompt).not.toContain("- 今回やりたいこと:");
    expect(prompt).not.toContain("### 家にある食材・材料");
    expect(prompt).not.toContain("### 指定材料の扱い");
    expect(prompt).not.toContain("### 一緒に出す料理との相性");
    expect(prompt).not.toContain("### 調理器具の補足");
    expect(prompt).not.toContain("### 条件に合わせた調理のポイント");
  });

  test("食材ありなら家にない主材料を追加しないルールを出す", () => {
    const prompt = buildPrompt(
      makeEmptyPromptData({
        materials: ["卵2個", "豆腐150g"],
      }),
    );

    expect(prompt).toContain("### 家にある食材・材料");
    expect(prompt).toContain("- 卵2個");
    expect(prompt).toContain("- 豆腐150g");
    expect(prompt).toContain(
      "家にない肉、魚、卵、豆腐、野菜、きのこ、海藻、乳製品などの新しい主材料は追加しないでください。",
    );
    expect(prompt).toContain("- 買い足し提案");
  });

  test("合わせたい料理だけ指定した場合は相性項目だけを入力依存で出す", () => {
    const prompt = buildPrompt(
      makeEmptyPromptData({
        requestIntent: "pairing",
        pairingTargets: ["餃子", "焼き魚"],
        recipeCount: "one",
      }),
    );

    expect(prompt).toContain("### 一緒に出す料理");
    expect(prompt).toContain("- 餃子");
    expect(prompt).toContain("- 焼き魚");
    expect(prompt).toContain("### 一緒に出す料理との相性");
    expect(prompt).toContain("- 一緒に出す料理: 味・食感・量が重なりすぎないようにする");
    expect(prompt).not.toContain("### 家にある食材・材料");
    expect(prompt).not.toContain("### 調理器具の補足");
    expect(prompt).not.toContain("指定された調理方法・調理器具だけで作れる手順にしてください。");
  });

  test("対象外 intent の値はプロンプトに出さない", () => {
    const prompt = buildPrompt(
      makeEmptyPromptData({
        requestIntent: "target-dish",
        targetDish: ["カレー"],
        pairingTargets: ["餃子"],
        recipeCount: "multiple",
        recipeRoles: ["副菜・一品"],
      }),
    );

    expect(prompt).toContain("### 作りたい料理\n\n- カレー");
    expect(prompt).not.toContain("### 一緒に出す料理");
    expect(prompt).not.toContain("### 一緒に出す料理との相性");
    expect(prompt).not.toContain("### 作りたい品数");
    expect(prompt).not.toContain("### 料理の役割・量感");
  });

  test("使い切りたい量を別指定する場合は量をそのまま出す", () => {
    const prompt = buildPrompt(
      makeEmptyPromptData({
        materials: ["キャベツ"],
        materialUseMode: "specified",
        materialRequests: [
          {
            id: "material-1",
            name: "キャベツ",
            usage: "use-up",
            useUpAmountMode: "custom",
            useUpAmount: "1/4玉",
          },
        ],
      }),
    );

    expect(prompt).toContain("### 使い切りたい食材・材料\n\n- キャベツ（使い切りたい量: 1/4玉）");
    expect(prompt).not.toContain("キャベツ1/4玉");
  });

  test("材料の使い方がおまかせなら古い材料リクエストは出さない", () => {
    const prompt = buildPrompt(
      makeEmptyPromptData({
        materials: ["キャベツ"],
        materialUseMode: "auto",
        materialRequests: [
          {
            id: "material-1",
            name: "キャベツ",
            usage: "use-up",
            useUpAmountMode: "custom",
            useUpAmount: "1/4玉",
          },
        ],
      }),
    );

    expect(prompt).toContain("### 家にある食材・材料\n\n- キャベツ");
    expect(prompt).not.toContain("### 使い切りたい食材・材料");
    expect(prompt).not.toContain("1/4玉");
  });

  test("複数品指定では役割ごとに1品ずつ依頼する", () => {
    const prompt = buildPrompt(
      makeEmptyPromptData({
        requestIntent: "pairing",
        pairingTargets: ["生姜焼き"],
        recipeCount: "multiple",
        recipeRoles: ["副菜・一品", "汁物"],
      }),
    );

    expect(prompt).toContain("### 作りたい品数\n\n複数品を指定");
    expect(prompt).toContain("### 料理の役割・量感\n\n- 副菜・一品\n- 汁物");
    expect(prompt).toContain("指定された料理の役割・量感ごとに、1品ずつ作り方を書いてください。");
  });
});

describe("makeEmptyPromptData", () => {
  test("空の初期値を返し、上書きだけを反映する", () => {
    const data = makeEmptyPromptData({
      materials: ["豆腐"],
      servings: "大人2人",
    });

    expect(data.materials).toEqual(["豆腐"]);
    expect(data.servings).toBe("大人2人");
    expect(data.requestIntent).toBe("auto");
    expect(data.materialUseMode).toBe("auto");
    expect(data.materialRequests).toEqual([]);
    expect(data.targetDish).toEqual([]);
    expect(data.recipeRoles).toEqual([]);
    expect(data.cookTime).toBe("");
    expect(data.supplementalNotes).toBe("");
    expect(data.recipeDirections).toEqual([]);
    expect(data.ngFoodsAndSeasonings).toEqual([]);
  });
});
