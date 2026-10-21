import { describe, expect, test } from "vitest";
import {
  countAdvancedConditions,
  createPromptDataReader,
  createPromptDataReaderFromInputs,
} from "../../src/conditions";
import type { ComboId, MaterialRequest, PromptData } from "../../src/types";

const comboValues = {
  materials: ["豆腐", "しめじ"],
  targetDish: ["カレー"],
  recipeRoles: ["副菜・一品"],
  cookingTools: ["電子レンジ"],
  pairingTargets: ["餃子"],
  recipeDirections: ["あっさり"],
  ngFoodsAndSeasonings: ["にんじん"],
} as const satisfies Record<ComboId, readonly string[]>;

const materialRequests: MaterialRequest[] = [
  {
    id: "material-1",
    name: "豆腐",
    usage: "required",
    useUpAmountMode: "as-written",
    useUpAmount: "",
  },
];

function makePromptData(overrides: Partial<PromptData> = {}): PromptData {
  return {
    requestIntent: "auto",
    materialUseMode: "auto",
    materialRequests: [],
    materials: [],
    targetDish: [],
    recipeRoles: [],
    cookingTools: [],
    pairingTargets: [],
    recipeDirections: [],
    ngFoodsAndSeasonings: [],
    servings: "",
    servingsMode: "unspecified",
    recipeCount: "auto",
    cookTime: "",
    supplementalNotes: "",
    ...overrides,
  };
}

describe("createPromptDataReader", () => {
  test("現在の条件を1つの読み取りモデルへ集約する", () => {
    const reader = createPromptDataReader({
      getComboValues: (group) => [...comboValues[group]],
      getRequestIntent: () => "pairing",
      getMaterialUseMode: () => "specified",
      getMaterialRequests: () => materialRequests,
      getServingsText: () => "大人2人",
      getServingsMode: () => "two",
      getRecipeCount: () => "one",
      getCookTimeText: () => "20分以内",
      getSupplementalNotes: () => "子ども用に辛くしない。",
    });

    expect(reader.read()).toEqual({
      ...comboValues,
      ngFoodsAndSeasonings: [],
      recipeDirections: [],
      recipeRoles: [],
      pairingTargets: [],
      targetDish: [],
      requestIntent: "auto",
      materialUseMode: "specified",
      materialRequests,
      servings: "大人2人",
      servingsMode: "two",
      recipeCount: "auto",
      cookTime: "",
      supplementalNotes: "子ども用に辛くしない。",
    });
  });

  test("combo 値は現在の string[] 互換モデルとして全項目から読む", () => {
    const calls: string[] = [];
    const reader = createPromptDataReader({
      getComboValues: (group) => {
        calls.push(group);
        return [...comboValues[group]];
      },
      getServingsText: () => "",
      getCookTimeText: () => "",
      getSupplementalNotes: () => "",
    });

    expect(reader.read()).toEqual({
      ...comboValues,
      ngFoodsAndSeasonings: [],
      recipeDirections: [],
      recipeRoles: [],
      pairingTargets: [],
      targetDish: [],
      requestIntent: "auto",
      materialUseMode: "auto",
      materialRequests: [],
      servings: "",
      servingsMode: "unspecified",
      recipeCount: "auto",
      cookTime: "",
      supplementalNotes: "",
    });
    expect(calls).toEqual([
      "materials",
      "targetDish",
      "recipeRoles",
      "cookingTools",
      "pairingTargets",
      "recipeDirections",
      "ngFoodsAndSeasonings",
    ]);
  });

  test("旧intentの作りたい料理を出力から除外する", () => {
    const reader = createPromptDataReader({
      getComboValues: (group) => [...comboValues[group]],
      getRequestIntent: () => "target-dish",
      getServingsText: () => "",
      getCookTimeText: () => "",
      getSupplementalNotes: () => "",
    });

    expect(reader.read().targetDish).toEqual([]);
    expect(reader.read().pairingTargets).toEqual([]);
  });

  test("旧intent・品数・役割は出力モデルへ引き継がない", () => {
    const reader = createPromptDataReader({
      getComboValues: (group) => [...comboValues[group]],
      getRequestIntent: () => "pairing",
      getRecipeCount: () => "auto",
      getServingsText: () => "",
      getCookTimeText: () => "",
      getSupplementalNotes: () => "",
    });

    expect(reader.read()).toMatchObject({
      requestIntent: "auto",
      recipeCount: "auto",
      targetDish: [],
      pairingTargets: [],
      recipeRoles: [],
    });
  });

  test("材料の使い方がおまかせなら古い materialRequests は読まない", () => {
    const reader = createPromptDataReader({
      getComboValues: (group) => [...comboValues[group]],
      getMaterialUseMode: () => "auto",
      getMaterialRequests: () => materialRequests,
      getServingsText: () => "",
      getCookTimeText: () => "",
      getSupplementalNotes: () => "",
    });

    expect(reader.read()).toMatchObject({
      materialUseMode: "auto",
      materialRequests: [],
    });
  });

  test("旧品数を指定しても役割を現在の出力へ含めない", () => {
    const reader = createPromptDataReader({
      getComboValues: (group) => [...comboValues[group]],
      getRequestIntent: () => "auto",
      getRecipeCount: () => "multiple",
      getServingsText: () => "",
      getCookTimeText: () => "",
      getSupplementalNotes: () => "",
    });

    expect(reader.read()).toMatchObject({
      requestIntent: "auto",
      recipeCount: "auto",
      recipeRoles: [],
      targetDish: [],
      pairingTargets: [],
    });
  });

  test("旧作りたい料理 intent は現在の出力を変更しない", () => {
    const reader = createPromptDataReader({
      getComboValues: (group) => [...comboValues[group]],
      getRequestIntent: () => "target-dish",
      getRecipeCount: () => "multiple",
      getServingsText: () => "",
      getCookTimeText: () => "",
      getSupplementalNotes: () => "",
    });

    expect(reader.read()).toMatchObject({
      requestIntent: "auto",
      recipeCount: "auto",
      recipeRoles: [],
      targetDish: [],
      pairingTargets: [],
    });
  });
});

describe("countAdvancedConditions", () => {
  test("詳細条件の指定件数を数える", () => {
    expect(
      countAdvancedConditions(
        makePromptData({
          materials: ["豆腐"],
          targetDish: ["カレー"],
          cookingTools: ["電子レンジ"],
          recipeDirections: ["和風"],
          ngFoodsAndSeasonings: ["にんじん", "にんにく"],
          servings: "大人2人",
          cookTime: "20分以内",
          supplementalNotes: "子ども用に辛くしない。",
        }),
      ),
    ).toBe(6);
  });

  test("基本項目だけでは詳細条件として数えない", () => {
    expect(
      countAdvancedConditions(
        makePromptData({
          materials: ["豆腐"],
          targetDish: ["カレー"],
          recipeRoles: ["副菜・一品"],
          pairingTargets: ["餃子"],
          servings: "大人2人",
        }),
      ),
    ).toBe(0);
  });
});

describe("createPromptDataReaderFromInputs", () => {
  test("combo registry adapter から条件を読める", () => {
    const reader = createPromptDataReaderFromInputs({
      comboRegistry: {
        getValues: (group) => [...comboValues[group]],
      },
      getRequestIntent: () => "pairing",
      getMaterialUseMode: () => "specified",
      getMaterialRequests: () => materialRequests,
      getServingsText: () => "大人2人",
      getServingsMode: () => "two",
      getRecipeCount: () => "multiple",
      getCookTimeText: () => "20分以内",
      getSupplementalNotes: () => "辛くしない。",
    });

    expect(reader.read()).toEqual({
      ...comboValues,
      ngFoodsAndSeasonings: [],
      recipeDirections: [],
      recipeRoles: [],
      pairingTargets: [],
      targetDish: [],
      requestIntent: "auto",
      materialUseMode: "specified",
      materialRequests,
      servings: "大人2人",
      servingsMode: "two",
      recipeCount: "auto",
      cookTime: "",
      supplementalNotes: "辛くしない。",
    });
  });
});
