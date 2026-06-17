import { describe, expect, test } from "vitest";
import {
  getMissingIngredientLabels,
  getTasteAdjustmentLabels,
  getUsedMaterialLabels,
  getVisibleCandidateBadgeLabels,
} from "../../src/recipe-candidate-list";
import type { AiRecipeCandidate } from "../../src/types";

function candidate(overrides: Partial<AiRecipeCandidate> = {}): AiRecipeCandidate {
  return {
    id: "a",
    title: "豆腐炒め",
    time: 12,
    badges: [],
    use: ["豆腐"],
    miss: [],
    why: "短時間で作れます。",
    ing: ["豆腐", "しょうゆ"],
    steps: ["切る", "炒める"],
    ...overrides,
  };
}

describe("recipe candidate list labels", () => {
  test("通常候補では買い足しなしbadgeを表示しない", () => {
    expect(
      getVisibleCandidateBadgeLabels(
        candidate({
          badges: ["no_shop", "quick"],
        }),
      ),
    ).toEqual(["時短"]);
  });

  test("不足材料がある候補では買い足しありbadgeと追加材料labelを表示する", () => {
    const shoppingCandidate = candidate({
      badges: ["miss_optional", "easy"],
      miss: ["卵"],
    });

    expect(getVisibleCandidateBadgeLabels(shoppingCandidate)).toEqual(["買い足しあり", "かんたん"]);
    expect(getMissingIngredientLabels(shoppingCandidate)).toEqual(["追加: 卵"]);
  });

  test("使う材料には分量と使い方の文脈を表示する", () => {
    expect(
      getUsedMaterialLabels(candidate({ use: ["豆腐", "キャベツ", "卵"] }), [
        { name: "豆腐", usage: "use_up", amount: "150g" },
        { name: "キャベツ", usage: "required" },
      ]),
    ).toEqual(["豆腐（150g・使い切り）", "キャベツ（必ず使う）", "卵"]);
  });

  test("候補詳細用の味の調整を返す", () => {
    expect(getTasteAdjustmentLabels()).toEqual([
      "塩・しょうゆは少量ずつ足す",
      "濃ければ水かだしでのばす",
    ]);
  });
});
