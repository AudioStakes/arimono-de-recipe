import { describe, expect, test } from "vitest";
import { buildPrompt, makeEmptyPromptData } from "../../src/prompt";

describe("buildPrompt", () => {
  test("未指定項目をプロンプトに出力しない", () => {
    const prompt = buildPrompt(makeEmptyPromptData());

    for (const text of [
      "【食材・材料】",
      "【人数・分量】",
      "【料理区分・作りたいもの】",
      "【調理方法・調理器具】",
      "【合わせたい料理・一緒に出す料理】",
      "【調理時間】",
      "【作りやすさ】",
      "【レシピの方向性】",
      "【NG食材・調味料】",
      "【その他の要望】",
      "【必ず使いたい材料】",
      "【あれば使いたい材料】",
      "【優先条件】",
      "【NG条件】",
      "使わない調味料",
    ]) {
      expect(prompt).not.toContain(text);
    }
  });

  test("指定済み項目と条件付き形式を出力する", () => {
    const prompt = buildPrompt(
      makeEmptyPromptData({
        materials: ["豆腐", "しめじ"],
        dishTypes: ["副菜"],
        cookingTools: ["電子レンジ"],
        pairingTargets: ["餃子"],
        difficulty: ["時短"],
        recipeDirections: ["あっさり", "和風", "野菜たっぷり", "平日夕食"],
        ngFoodsAndSeasonings: ["にんじん", "にんにく"],
        servings: "大人2人、子供(12歳以下)1人",
        cookTime: "20分以内",
        supplementalNotes: "子ども用に辛くしない。",
      }),
    );

    expect(prompt).toContain("【食材・材料】\n- 豆腐\n- しめじ");
    expect(prompt).toContain("【人数・分量】\n大人2人、子供(12歳以下)1人");
    expect(prompt).toContain("【料理区分・作りたいもの】\n副菜");
    expect(prompt).toContain("【調理方法・調理器具】\n電子レンジ");
    expect(prompt).toContain("【合わせたい料理・一緒に出す料理】\n餃子");
    expect(prompt).toContain("【調理時間】\n20分以内");
    expect(prompt).toContain("【作りやすさ】\n時短");
    expect(prompt).toContain("【レシピの方向性】\nあっさり、和風、野菜たっぷり、平日夕食");
    expect(prompt).toContain("【NG食材・調味料】\nにんじん、にんにく");
    expect(prompt).toContain("【その他の要望】\n子ども用に辛くしない。");
    expect(prompt).toContain("指定された食材・材料を中心に使ってください。");
    expect(prompt).toContain("指定された「料理区分・作りたいもの」だけを提案してください。");
    expect(prompt).toContain("指定された調理方法・調理器具だけで作れる手順にしてください。");
    expect(prompt).toContain("指定された調理時間に収まる現実的な手順にしてください。");
    expect(prompt).toContain("指定された「作りやすさ」を反映してください。");
    expect(prompt).toContain("指定された「レシピの方向性」を反映してください。");
    expect(prompt).toContain("「NG食材・調味料」に指定されたものは使わないでください。");
    expect(prompt).toContain("指定された「その他の要望」を反映してください。");
    expect(prompt).toContain(
      "「合わせたい料理・一緒に出す料理」に合う味・食感・量のレシピにしてください。",
    );
    expect(prompt).toContain("2. 一緒に出す料理との相性");
    expect(prompt).toContain(
      "1. レシピ名\n2. 一緒に出す料理との相性\n3. 使う材料\n4. 作り方\n5. 調理のポイント",
    );
  });

  test("一緒に出す料理が未指定なら標準の出力形式になる", () => {
    const prompt = buildPrompt(
      makeEmptyPromptData({
        materials: ["卵"],
      }),
    );

    expect(prompt).toContain("1. レシピ名\n2. 使う材料\n3. 作り方\n4. 調理のポイント");
    expect(prompt).not.toContain("一緒に出す料理との相性");
  });

  test("詳細条件未指定ならこだわり条件のルールは出力しない", () => {
    const prompt = buildPrompt(
      makeEmptyPromptData({
        materials: ["卵"],
      }),
    );

    expect(prompt).not.toContain("指定された「作りやすさ」を反映してください。");
    expect(prompt).not.toContain("指定された「レシピの方向性」を反映してください。");
    expect(prompt).not.toContain("「NG食材・調味料」に指定されたものは使わないでください。");
    expect(prompt).not.toContain("指定された「その他の要望」を反映してください。");
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
