import { describe, expect, test } from "vitest";
import { isImeComposing } from "../../src/ui";

describe("isImeComposing", () => {
  test("IME変換中のEnterはピル化しない判定になる", () => {
    const input = { dataset: {} } as HTMLInputElement;

    expect(isImeComposing(input, { isComposing: true, keyCode: 13 } as KeyboardEvent)).toBe(
      true,
    );
  });

  test("keyCode 229 をIME中として扱う", () => {
    const input = { dataset: {} } as HTMLInputElement;

    expect(isImeComposing(input, { isComposing: false, keyCode: 229 } as KeyboardEvent)).toBe(
      true,
    );
  });

  test("dataset.composing が true の場合はIME中として扱う", () => {
    const input = { dataset: { composing: "true" } } as unknown as HTMLInputElement;

    expect(isImeComposing(input, { isComposing: false, keyCode: 13 } as KeyboardEvent)).toBe(
      true,
    );
  });

  test("dataset.justComposed が true の場合はIME確定直後として扱う", () => {
    const input = { dataset: { justComposed: "true" } } as unknown as HTMLInputElement;

    expect(isImeComposing(input, { isComposing: false, keyCode: 13 } as KeyboardEvent)).toBe(
      true,
    );
  });

  test("IME状態でないEnterは通常のEnterとして扱う", () => {
    const input = { dataset: {} } as HTMLInputElement;

    expect(isImeComposing(input, { isComposing: false, keyCode: 13 } as KeyboardEvent)).toBe(
      false,
    );
  });
});
