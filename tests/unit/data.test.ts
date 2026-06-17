import { describe, expect, test } from "vitest";
import { getComboOptionValues } from "../../src/combo-field";
import {
  comboOptionSets,
  combos,
  conditionChipOrder,
  cookTimeOptions,
  featuredComboOptions,
  materialUsageOptions,
  materialUseModeOptions,
  recipeCountOptions,
  recipeRoleOptions,
  requestIntentOptions,
  servingGroups,
  servingsModeOptions,
  useUpAmountModeOptions,
} from "../../src/data";

describe("data", () => {
  test("今回やりたいことは3択だけで並ぶ", () => {
    expect(requestIntentOptions.map((option) => option.label)).toEqual([
      "ありものでおまかせ",
      "作りたい料理がある",
      "一緒に出す料理に合わせたい",
    ]);
  });

  test("材料の使い方と材料ごとの使い方は期待した順で並ぶ", () => {
    expect(materialUseModeOptions.map((option) => option.label)).toEqual([
      "おまかせ",
      "必ず使う・使い切りたい食材・材料がある",
    ]);
    expect(materialUsageOptions.map((option) => option.label)).toEqual([
      "おまかせ",
      "必ず使う",
      "使い切る",
    ]);
    expect(useUpAmountModeOptions.map((option) => option.label)).toEqual([
      "家にある食材・材料に書いた量を使う",
      "量を別で指定する",
    ]);
  });

  test("作りたい品数と人数・分量の候補は期待した順で並ぶ", () => {
    expect(recipeCountOptions.map((option) => option.label)).toEqual([
      "おまかせ",
      "1品だけ",
      "複数品を指定",
    ]);
    expect(servingsModeOptions.map((option) => option.label)).toEqual([
      "指定なし",
      "1人分",
      "2人分",
      "3〜4人分",
      "作り置き多め",
      "詳しく指定",
    ]);
  });

  test("調理時間候補は期待した順で並ぶ", () => {
    expect(cookTimeOptions).toEqual([
      "指定なし",
      "10分以内",
      "20分以内",
      "30分以内",
      "45分以内",
      "60分以内",
    ]);
  });

  test("人数グループは表示順とラベルが揃っている", () => {
    expect(servingGroups.map(({ label }) => label)).toEqual(["大人", "シニア", "子供", "幼児"]);
  });

  test("候補データに必要な値が含まれている", () => {
    expect(comboOptionSets.materials).toEqual(
      expect.arrayContaining(["卵", "豆腐", "もやし", "しめじ", "しろ菜"]),
    );
    expect(comboOptionSets.targetDishes).toEqual(
      expect.arrayContaining([
        "カレー",
        "オムライス",
        "ハンバーグ",
        "肉じゃが",
        "唐揚げ",
        "生姜焼き",
        "鶏の照り焼き",
        "さばの味噌煮",
        "親子丼",
        "味噌汁",
      ]),
    );
    expect(comboOptionSets.recipeRoles).toEqual([...recipeRoleOptions]);
    expect(comboOptionSets.cookingTools).toEqual(
      expect.arrayContaining(["電子レンジ", "フライパン", "鍋", "ヘルシオ ホットクック"]),
    );
    expect(comboOptionSets.pairingTargets).toEqual(
      expect.arrayContaining(["カレー", "餃子", "焼き魚", "肉じゃが"]),
    );
    expect(comboOptionSets.recipeDirections).toEqual(
      expect.arrayContaining(["あっさり", "和風", "野菜たっぷり", "平日夕食"]),
    );
    expect(comboOptionSets.ngFoodsAndSeasonings).toEqual(
      expect.arrayContaining(["にんじん", "にんにく", "唐辛子", "砂糖", "しょうゆ"]),
    );
  });

  test("注目候補は初期表示用に定義される", () => {
    expect(featuredComboOptions.recipeDirections).toEqual([
      "あっさり",
      "こってり",
      "やさしい味",
      "ご飯が進む",
      "甘辛",
      "ピリ辛",
      "味噌味",
      "ごま風味",
      "和風",
      "洋風",
      "中華風",
      "韓国風",
    ]);
    expect(featuredComboOptions.cookingTools).toEqual([
      "電子レンジ",
      "フライパン",
      "鍋",
      "トースター",
      "ヘルシオ ホットクック",
      "炊飯器",
      "オーブン",
      "火を使わない",
    ]);
  });

  test("チップ順序は基本項目から詳細項目の順に並ぶ", () => {
    expect(conditionChipOrder).toEqual([
      "materials",
      "targetDish",
      "recipeRoles",
      "pairingTargets",
      "cookingTools",
      "recipeDirections",
      "ngFoodsAndSeasonings",
    ]);
  });

  test("フォーム定義は先頭と末尾の想定どおりになっている", () => {
    expect(combos[0]?.id).toBe("materials");
    expect(combos[0]?.basic).toBe(true);
    expect(combos.at(-1)?.id).toBe("ngFoodsAndSeasonings");
  });

  test("作りたい料理は単一値の候補入力として定義される", () => {
    expect(combos.find((combo) => combo.id === "targetDish")?.single).toBe(true);
  });

  test("材料候補は表示用に五十音順で並ぶ", () => {
    const values = getComboOptionValues("materials");
    const sorted = [...values].sort((a, b) => a.localeCompare(b, "ja"));

    expect(values).toEqual(sorted);
  });

  test("食材以外の候補は設定配列の順番を維持する", () => {
    expect(getComboOptionValues("recipeDirections")).toEqual(comboOptionSets.recipeDirections);
    expect(getComboOptionValues("cookingTools")).toEqual(comboOptionSets.cookingTools);
    expect(getComboOptionValues("ngFoodsAndSeasonings")).toEqual(
      comboOptionSets.ngFoodsAndSeasonings,
    );
  });
});
