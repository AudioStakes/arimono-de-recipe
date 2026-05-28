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

  test("モバイル幅では常に表示する", () => {
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
          innerWidth: 390,
        },
      ),
    ).toEqual({
      show: true,
      suppress: false,
      nearBottom: false,
    });
  });

  test("デスクトップ幅では旧条件どおり表示判定する", () => {
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
          innerWidth: 1280,
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
          innerWidth: 1280,
        },
      ),
    ).toEqual({
      show: false,
      suppress: true,
      nearBottom: false,
    });
  });
});
