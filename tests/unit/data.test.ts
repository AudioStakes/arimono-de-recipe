import { describe, expect, test } from "vitest";
import { chipOrder, combos, cookTimeOptions, optionSets, servingGroups } from "../../src/data";

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
    expect(optionSets.materials).toContain("豆腐");
    expect(optionSets.materials).toContain("高野豆腐");
    expect(optionSets.materials).toContain("しろ菜");
    expect(optionSets.pairingTargets).toContain("餃子");
  });

  test("チップ順序は基本項目から詳細項目の順に並ぶ", () => {
    expect(chipOrder).toEqual([
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
});
