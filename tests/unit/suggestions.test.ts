import { describe, expect, test } from "vitest";
import {
  filterAvailableComboOptions,
  getOptionSearchText,
  normalizeSearchText,
} from "../../src/suggestions";

describe("suggestion search helpers", () => {
  test("ひらがなとカタカナの正規化結果は一致する", () => {
    expect(normalizeSearchText("はんばーぐ")).toBe(normalizeSearchText("ハンバーグ"));
  });

  test("漢字候補は読みエイリアスを含む検索テキストを持つ", () => {
    expect(getOptionSearchText("卵")).toContain(normalizeSearchText("たまご"));
    expect(getOptionSearchText("餃子")).toContain(normalizeSearchText("ぎょうざ"));
    expect(getOptionSearchText("電子レンジ")).toContain(normalizeSearchText("でんしれんじ"));
    expect(getOptionSearchText("和風")).toContain(normalizeSearchText("washoku"));
  });

  test("読み入力で漢字候補を絞り込める", () => {
    expect(filterAvailableComboOptions(["卵", "豆腐", "ハンバーグ"], "たまご")).toEqual(["卵"]);
    expect(filterAvailableComboOptions(["餃子", "焼き魚"], "ぎょうざ")).toEqual(["餃子"]);
    expect(filterAvailableComboOptions(["電子レンジ", "炊飯器"], "でんしれんじ")).toEqual([
      "電子レンジ",
    ]);
    expect(filterAvailableComboOptions(["和風", "中華風"], "washoku")).toEqual(["和風"]);
    expect(filterAvailableComboOptions(["ヘルシオ ホットクック", "炊飯器"], "hotcook")).toEqual([
      "ヘルシオ ホットクック",
    ]);
  });

  test("ひらがな入力でカタカナ候補を絞り込める", () => {
    expect(filterAvailableComboOptions(["ハンバーグ", "カレー"], "はんばーぐ")).toEqual([
      "ハンバーグ",
    ]);
  });

  test("選択済み候補は結果から除外され、最大40件に制限される", () => {
    expect(filterAvailableComboOptions(["卵", "豆腐", "餃子"], "", ["豆腐"])).toEqual([
      "卵",
      "餃子",
    ]);

    const options = Array.from({ length: 50 }, (_, index) => `候補${index + 1}`);
    expect(filterAvailableComboOptions(options, "")).toHaveLength(40);
  });
});
