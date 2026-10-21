import type { PromptData } from "../../src/types";

type EvaluationCase = { id: string; data: Partial<PromptData> };

export const promptEvaluationCases: readonly EvaluationCase[] = [
  {
    id: "basic",
    data: {
      materials: ["豆腐150g", "卵2個"],
    },
  },
  {
    id: "amounts",
    data: {
      materials: ["キャベツ", "豆腐（１丁）"],
      materialUseMode: "specified",
      materialRequests: [
        {
          id: "a",
          name: "キャベツ",
          usage: "use-up",
          useUpAmountMode: "custom",
          useUpAmount: "1/4玉",
        },
        {
          id: "b",
          name: "豆腐（１丁）",
          usage: "required",
          useUpAmountMode: "as-written",
          useUpAmount: "",
        },
      ],
    },
  },
  {
    id: "child",
    data: {
      materials: ["鶏ひき肉150g", "にんじん1/2本"],
      servings: "大人1人、幼児1人",
      servingsMode: "custom",
    },
  },
  {
    id: "tools_ng",
    data: {
      materials: ["豆腐150g", "しめじ50g", "卵2個"],
      cookingTools: ["電子レンジ"],
      supplementalNotes: "卵としょうゆは使わない。10分以内。",
    },
  },
  {
    id: "two_dishes",
    data: {
      materials: ["豆腐", "キャベツ1/4玉", "卵2個"],
      materialUseMode: "specified",
      materialRequests: [
        {
          id: "a",
          name: "豆腐",
          usage: "use-up",
          useUpAmountMode: "custom",
          useUpAmount: "300g",
        },
      ],
      supplementalNotes: "副菜を2品。15分以内。保存方法も短く教えて。",
    },
  },
  {
    id: "conflict",
    data: {
      materials: ["卵2個"],
      materialUseMode: "specified",
      materialRequests: [
        {
          id: "a",
          name: "卵2個",
          usage: "required",
          useUpAmountMode: "as-written",
          useUpAmount: "",
        },
      ],
      supplementalNotes: "卵は使わない。",
    },
  },
  {
    id: "heldout_pork_microwave",
    data: {
      materials: ["じゃがいも250g", "豚こま切れ肉150g"],
      servings: "2人分",
      servingsMode: "custom",
      cookingTools: ["電子レンジ"],
      supplementalNotes: "15分以内。しょうがは使わない。",
    },
  },
  {
    id: "heldout_raw_vegetables",
    data: {
      materials: ["トマト1個", "きゅうり"],
      materialUseMode: "specified",
      materialRequests: [
        {
          id: "cucumber",
          name: "きゅうり",
          usage: "required",
          useUpAmountMode: "custom",
          useUpAmount: "1/2本",
        },
      ],
      cookingTools: ["火を使わない"],
      supplementalNotes: "酢は使わない。",
    },
  },
];
