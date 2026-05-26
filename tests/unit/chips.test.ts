import { describe, expect, test } from "vitest";
import { buildConditionChipSpecs } from "../../src/chips";
import { makeEmptyPromptData } from "../../src/prompt";

describe("buildConditionChipSpecs", () => {
  test("表示順を保ったままチップ定義を返す", () => {
    const chips = buildConditionChipSpecs(
      makeEmptyPromptData({
        materials: ["豆腐"],
        servings: "大人2人、子供(12歳以下)1人",
        dishTypes: ["副菜"],
        cookingTools: ["電子レンジ"],
        pairingTargets: ["餃子"],
        cookTime: "20分以内",
        difficulty: ["時短"],
        health: ["野菜多め"],
        supplementalNotes: "子ども用に辛くしない。",
      }),
    );

    expect(chips.map((chip) => chip.label)).toEqual([
      "材料: 豆腐",
      "大人2人、子供(12歳以下)1人",
      "作りたいもの: 副菜",
      "調理方法・器具: 電子レンジ",
      "一緒に出す: 餃子",
      "調理時間: 20分以内",
      "作りやすさ: 時短",
      "栄養・健康: 野菜多め",
      "補足あり",
    ]);
  });
});
