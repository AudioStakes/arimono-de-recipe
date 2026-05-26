import { describe, expect, test } from "vitest";
import {
  countAdvancedConditions,
  createPromptDataReader,
  createPromptDataReaderFromInputs,
} from "../../src/conditions";

describe("createPromptDataReader", () => {
  test("現在の条件を1つの読み取りモデルへ集約する", () => {
    const comboValues = {
      materials: ["豆腐", "しめじ"],
      dishTypes: ["副菜"],
      cookingTools: ["電子レンジ"],
      pairingTargets: ["餃子"],
      difficulty: ["時短"],
      health: [],
      flavors: ["あっさり"],
      genres: [],
      scenes: ["平日夕食"],
      ngMaterials: ["にんじん"],
      ngSeasonings: [],
    } as const;

    const reader = createPromptDataReader({
      getComboValues: (group) => [...comboValues[group]],
      getServingsText: () => "大人2人",
      getCookTimeText: () => "15分以内",
      getSupplementalNotes: () => "子ども用に辛くしない。",
    });

    expect(reader.read()).toEqual({
      ...comboValues,
      servings: "大人2人",
      cookTime: "15分以内",
      supplementalNotes: "子ども用に辛くしない。",
    });
  });
});

describe("countAdvancedConditions", () => {
  test("詳細条件の指定件数を数える", () => {
    expect(
      countAdvancedConditions({
        materials: ["豆腐"],
        dishTypes: [],
        cookingTools: [],
        pairingTargets: [],
        difficulty: ["時短"],
        health: ["野菜多め"],
        flavors: [],
        genres: ["和食"],
        scenes: [],
        ngMaterials: ["にんじん"],
        ngSeasonings: [],
        servings: "大人2人",
        cookTime: "15分以内",
        supplementalNotes: "子ども用に辛くしない。",
      }),
    ).toBe(6);
  });
});

describe("createPromptDataReaderFromInputs", () => {
  test("combo registry adapter から条件を読める", () => {
    const comboValues = {
      materials: ["豆腐"],
      dishTypes: [],
      cookingTools: ["電子レンジ"],
      pairingTargets: [],
      difficulty: [],
      health: [],
      flavors: [],
      genres: ["和食"],
      scenes: [],
      ngMaterials: [],
      ngSeasonings: ["にんにく"],
    } as const;

    const reader = createPromptDataReaderFromInputs({
      comboRegistry: {
        getValues: (group) => [...comboValues[group]],
      },
      getServingsText: () => "大人2人",
      getCookTimeText: () => "20分以内",
      getSupplementalNotes: () => "辛くしない。",
    });

    expect(reader.read()).toEqual({
      ...comboValues,
      servings: "大人2人",
      cookTime: "20分以内",
      supplementalNotes: "辛くしない。",
    });
  });
});
