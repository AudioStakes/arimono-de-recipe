import { describe, expect, test } from "vitest";
import { buildConditionChipSpecs } from "../../src/chips";
import { makeEmptyPromptData } from "../../src/prompt";

describe("buildConditionChipSpecs", () => {
  test("入力済み条件が表示順にチップ化される", () => {
    const chips = buildConditionChipSpecs(
      makeEmptyPromptData({
        materials: ["豆腐", "しめじ"],
        servings: "大人2人、子供(12歳以下)1人、幼児(5歳以下)1人",
        dishTypes: ["副菜", "汁物"],
        cookingTools: ["電子レンジ"],
        pairingTargets: ["餃子", "カレー"],
        cookTime: "20分以内",
        difficulty: ["時短"],
        recipeDirections: ["あっさり", "和風", "平日夕食"],
        ngFoodsAndSeasonings: ["にんじん", "にんにく"],
        supplementalNotes: "子ども用に辛くしない。",
      }),
    );

    expect(chips.map((chip) => chip.label)).toEqual([
      "食材・材料: 豆腐、しめじ",
      "大人2人、子供(12歳以下)1人、幼児(5歳以下)1人",
      "料理区分・作りたいもの: 副菜、汁物",
      "調理方法・調理器具: 電子レンジ",
      "一緒に出す: 餃子、カレー",
      "調理時間: 20分以内",
      "作りやすさ: 時短",
      "レシピの方向性: あっさり、和風、平日夕食",
      "NG食材・調味料: にんじん、にんにく",
      "その他の要望あり",
    ]);

    expect(chips.map((chip) => chip.removable)).toEqual([
      true,
      false,
      true,
      true,
      true,
      true,
      true,
      true,
      true,
      true,
    ]);
  });

  test("未指定の条件はチップ化されない", () => {
    const chips = buildConditionChipSpecs(makeEmptyPromptData());

    expect(chips).toEqual([]);
  });
});
