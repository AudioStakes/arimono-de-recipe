import { describe, expect, test } from "vitest";
import { updateComboValues } from "../../src/combo-values";

describe("updateComboValues", () => {
  test("値を別の値へ更新できる", () => {
    expect(updateComboValues(["ハンバーグ"], "ハンバーグ", "デミグラスハンバーグ")).toEqual([
      "デミグラスハンバーグ",
    ]);
  });

  test("前後空白をtrimして保存する", () => {
    expect(updateComboValues(["ハンバーグ"], "ハンバーグ", "  デミグラスハンバーグ  ")).toEqual([
      "デミグラスハンバーグ",
    ]);
  });

  test("空欄はキャンセル扱いで元の配列を維持する", () => {
    const values = ["ハンバーグ"];

    expect(updateComboValues(values, "ハンバーグ", "   ")).toBe(values);
  });

  test("同じ値への編集は元の配列を維持する", () => {
    const values = ["ハンバーグ"];

    expect(updateComboValues(values, "ハンバーグ", "ハンバーグ")).toBe(values);
  });

  test("既存値と重複する値へ編集した場合は統合する", () => {
    expect(updateComboValues(["ハンバーグ", "卵"], "卵", "ハンバーグ")).toEqual(["ハンバーグ"]);
  });

  test("存在しないoldValueを指定しても壊れない", () => {
    const values = ["ハンバーグ"];

    expect(updateComboValues(values, "卵", "デミグラスハンバーグ")).toBe(values);
  });
});
