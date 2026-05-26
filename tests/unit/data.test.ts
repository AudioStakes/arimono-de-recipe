import { describe, expect, test } from "vitest";
import { getComboOptionValues } from "../../src/combo-field";
import {
  comboOptionSets,
  combos,
  conditionChipOrder,
  cookTimeOptions,
  servingGroups,
} from "../../src/data";

describe("data", () => {
  test("調理時間候補は期待した順で並ぶ", () => {
    expect(cookTimeOptions).toEqual([
      "",
      "3分以内",
      "5分以内",
      "10分以内",
      "15分以内",
      "20分以内",
      "30分以内",
      "45分以内",
      "60分以内",
    ]);
  });

  test("人数グループは表示順とラベルが揃っている", () => {
    expect(servingGroups.map(({ label }) => label)).toEqual([
      "大人",
      "シニア(60歳以上)",
      "子供(12歳以下)",
      "幼児(5歳以下)",
    ]);
  });

  test("候補データに必要な値が含まれている", () => {
    expect(comboOptionSets.materials).toEqual(
      expect.arrayContaining(["卵", "豆腐", "もやし", "しめじ", "しろ菜"]),
    );
    expect(comboOptionSets.dishTypes).toEqual(expect.arrayContaining(["主菜", "副菜", "汁物"]));
    expect(comboOptionSets.cookingTools).toEqual(
      expect.arrayContaining(["電子レンジ", "フライパン", "鍋", "ホットクック"]),
    );
    expect(comboOptionSets.pairingTargets).toEqual(
      expect.arrayContaining(["カレー", "餃子", "焼き魚", "肉じゃが"]),
    );
    expect(comboOptionSets.difficulty).toEqual(
      expect.arrayContaining(["時短", "節約", "洗い物少なめ", "ボリューム重視"]),
    );
    expect(comboOptionSets.ngSeasonings).toEqual(
      expect.arrayContaining(["にんにく", "唐辛子", "砂糖", "しょうゆ"]),
    );
  });

  test("チップ順序は基本項目から詳細項目の順に並ぶ", () => {
    expect(conditionChipOrder).toEqual([
      "materials",
      "dishTypes",
      "cookingTools",
      "pairingTargets",
      "difficulty",
      "health",
      "flavors",
      "genres",
      "scenes",
      "ngMaterials",
      "ngSeasonings",
    ]);
  });

  test("フォーム定義は先頭と末尾の想定どおりになっている", () => {
    expect(combos[0]?.id).toBe("materials");
    expect(combos[0]?.basic).toBe(true);
    expect(combos.at(-1)?.id).toBe("ngSeasonings");
  });

  test("材料候補は表示用に五十音順で並ぶ", () => {
    const values = getComboOptionValues("materials");
    const sorted = [...values].sort((a, b) => a.localeCompare(b, "ja"));

    expect(values).toEqual(sorted);
  });

  test("食材以外の候補は設定配列の順番を維持する", () => {
    expect(getComboOptionValues("difficulty")).toEqual(comboOptionSets.difficulty);
    expect(getComboOptionValues("cookingTools")).toEqual(comboOptionSets.cookingTools);
    expect(getComboOptionValues("ngSeasonings")).toEqual(comboOptionSets.ngSeasonings);
  });
});
