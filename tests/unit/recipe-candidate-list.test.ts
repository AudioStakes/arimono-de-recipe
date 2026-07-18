import { describe, expect, test } from "vitest";
import {
  getMissingIngredientLabels,
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
});
