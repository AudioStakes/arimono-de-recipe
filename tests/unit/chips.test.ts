import { describe, expect, test } from "vitest";
import { buildConditionChipSpecs } from "../../src/chips";
import { makeEmptyPromptData } from "../../src/prompt";

describe("buildConditionChipSpecs", () => {
  test("入力済み条件が表示順にチップ化される", () => {
    const chips = buildConditionChipSpecs(
      makeEmptyPromptData({
        requestIntent: "pairing",
        materials: ["豆腐", "しめじ"],
        servings: "大人2人、子供1人、幼児1人",
        targetDish: ["カレー"],
        recipeCount: "multiple",
        recipeRoles: ["副菜・一品", "汁物"],
        cookingTools: ["電子レンジ"],
        pairingTargets: ["餃子", "カレー"],
        cookTime: "20分以内",
        recipeDirections: ["あっさり", "和風", "平日夕食"],
        ngFoodsAndSeasonings: ["にんじん", "にんにく"],
        supplementalNotes: "子ども用に辛くしない。",
      }),
    );

    expect(chips.map((chip) => chip.label)).toEqual([
      "一緒に出す料理に合わせたい",
      "家にある食材・材料: 豆腐、しめじ",
      "一緒に出す料理: 餃子、カレー",
      "大人2人、子供1人、幼児1人",
      "作りたい品数: 複数品",
      "料理の役割・量感: 副菜・一品、汁物",
      "調理方法・調理器具: 電子レンジ",
      "調理時間: 20分以内",
      "レシピの方向性: あっさり、和風、平日夕食",
      "使えない・持っていない: にんじん、にんにく",
      "その他の要望あり",
    ]);

    expect(chips.map((chip) => chip.removable)).toEqual([
      false,
      true,
      true,
      false,
      false,
      true,
      true,
      true,
      true,
      true,
      true,
    ]);
  });

  test("未指定の任意条件はチップ化されない", () => {
    const chips = buildConditionChipSpecs(makeEmptyPromptData());

    expect(chips.map((chip) => chip.label)).toEqual(["ありものでおまかせ"]);
  });
});
