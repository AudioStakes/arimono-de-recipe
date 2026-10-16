import { describe, expect, test } from "vitest";
import { validateMaterialRequestAmounts } from "../../src/recipe-decision";
import type { MaterialRequest } from "../../src/types";

describe("material request validation", () => {
  test("使い切る材料だけ量の入力を必須にする", () => {
    const requests: MaterialRequest[] = [
      {
        id: "auto",
        name: "豆腐",
        usage: "auto",
        useUpAmountMode: "as-written",
        useUpAmount: "",
      },
      {
        id: "required",
        name: "卵",
        usage: "required",
        useUpAmountMode: "as-written",
        useUpAmount: "",
      },
      {
        id: "invalid-use-up",
        name: "キャベツ",
        usage: "use-up",
        useUpAmountMode: "as-written",
        useUpAmount: " ",
      },
      {
        id: "valid-use-up",
        name: "もやし",
        usage: "use-up",
        useUpAmountMode: "custom",
        useUpAmount: "1袋",
      },
    ];

    expect(validateMaterialRequestAmounts(requests)).toEqual([
      {
        requestId: "invalid-use-up",
        message: "使い切る場合は量を入力してください。",
      },
    ]);
  });
});
