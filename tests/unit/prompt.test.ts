import { describe, expect, test } from "vitest";
import { buildPrompt, makeEmptyPromptData } from "../../src/prompt";

describe("buildPrompt", () => {
  test("ケース1: 基本入力ありの構造化プロンプトを出力する", () => {
    const prompt = buildPrompt(
      makeEmptyPromptData({
        materials: ["しろ菜", "しめじ", "豆腐"],
        dishTypes: ["副菜"],
        cookingTools: ["ヘルシオ ホットクック"],
        pairingTargets: ["餃子"],
        servings: "大人2人、子供1人、幼児1人",
        difficulty: ["時短"],
      }),
    );

    expect(prompt).toContain("## 役割");
    expect(prompt).toContain("## 入力条件");
    expect(prompt).toContain("### 家にある食材");
    expect(prompt).toContain("### 料理区分・作りたいもの");
    expect(prompt).toContain("### 使いたい調理器具・調理方法");
    expect(prompt).toContain("### 合わせたい料理・一緒に出す料理");
    expect(prompt).toContain("### 食べる人数");
    expect(prompt).not.toContain("### 調理時間");
    expect(prompt).toContain("### 一緒に出す料理との相性");
    expect(prompt).toContain("指定された調理方法・調理器具だけで作れる手順にしてください。");
    expect(prompt).not.toContain("★");
  });

  test("ケース2: 食材なしなら食材前提の項目を出さない", () => {
    const prompt = buildPrompt(
      makeEmptyPromptData({
        dishTypes: ["主菜"],
      }),
    );

    expect(prompt).not.toContain("### 家にある食材");
    expect(prompt).not.toContain("### 指定材料の扱い");
    expect(prompt).not.toContain("### 主材料の追加制限");
    expect(prompt).toContain(
      "買い足し前提の新しい主材料の追加はできるだけ避け、家庭で自然な材料構成を優先してください。",
    );
  });

  test("ケース3: NG食材ありならNGルールと内部確認を出す", () => {
    const prompt = buildPrompt(
      makeEmptyPromptData({
        ngFoodsAndSeasonings: ["にんにく", "唐辛子"],
      }),
    );

    expect(prompt).toContain("### NG食材・調味料");
    expect(prompt).toContain("### NG食材・調味料の扱い");
    expect(prompt).toContain("NG食材・調味料に含まれるものは使わないでください。");
    expect(prompt).toContain("- NG食材・調味料: NG食材・調味料を使っていないか");
  });

  test("ケース4: 子供・幼児ありなら配慮ルールを出す", () => {
    const prompt = buildPrompt(
      makeEmptyPromptData({
        servings: "大人2人、子供1人、幼児1人",
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
        cookTime: "15分以内",
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

    expect(prompt).toContain("### 家にある食材");
    expect(prompt).toContain("### その他の要望");
    expect(prompt).not.toContain("### 料理区分・作りたいもの");
    expect(prompt).not.toContain("### 調理時間");
    expect(prompt.trimStart().startsWith("## 役割")).toBe(true);
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
    expect(data.dishTypes).toEqual([]);
    expect(data.cookTime).toBe("");
    expect(data.supplementalNotes).toBe("");
    expect(data.recipeDirections).toEqual([]);
    expect(data.ngFoodsAndSeasonings).toEqual([]);
  });
});
