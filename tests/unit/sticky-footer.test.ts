import { describe, expect, test } from "vitest";
import { getStickyFooterView, isNearBottom } from "../../src/sticky-footer";

describe("sticky-footer", () => {
  test("画面下に近いと判定される条件を返す", () => {
    expect(
      isNearBottom({
        scrollY: 700,
        innerHeight: 300,
        documentHeight: 1100,
      }),
    ).toBe(true);

    expect(
      isNearBottom({
        scrollY: 100,
        innerHeight: 300,
        documentHeight: 1100,
      }),
    ).toBe(false);
  });

  test("入力済みで本文ボタンが見えておらず、下端でなければ表示する", () => {
    expect(
      getStickyFooterView(
        {
          hasUserInput: true,
          inlineVisible: false,
          nearBottom: false,
        },
        {
          scrollY: 100,
          innerHeight: 300,
          documentHeight: 1100,
        },
      ),
    ).toEqual({
      show: true,
      suppress: false,
      nearBottom: false,
    });
  });

  test("入力がないか本文ボタンが見えていれば隠す", () => {
    expect(
      getStickyFooterView(
        {
          hasUserInput: false,
          inlineVisible: false,
          nearBottom: false,
        },
        {
          scrollY: 100,
          innerHeight: 300,
          documentHeight: 1100,
        },
      ),
    ).toEqual({
      show: false,
      suppress: true,
      nearBottom: false,
    });

    expect(
      getStickyFooterView(
        {
          hasUserInput: true,
          inlineVisible: true,
          nearBottom: false,
        },
        {
          scrollY: 100,
          innerHeight: 300,
          documentHeight: 1100,
        },
      ),
    ).toEqual({
      show: false,
      suppress: true,
      nearBottom: false,
    });
  });
});
