import { describe, expect, test } from "vitest";
import { buildPrompt, makeEmptyPromptData } from "../../src/prompt";
import type { RecipeCandidate, RecipeDecisionCandidateRequest } from "../../src/recipe-decision";
import {
  buildPromptCopyFallback,
  buildRecipeDecisionCandidateRequest,
  createInitialRecipeDecisionState,
  showCandidateList,
  showCookingView,
  showRecipeDecisionError,
  showRecipeDetail,
  startCandidateLoading,
  toRecipeCandidate,
  validateMaterialRequestAmounts,
} from "../../src/recipe-decision";
import type { AiRecipeCandidate, MaterialRequest } from "../../src/types";

const request: RecipeDecisionCandidateRequest = {
  materials: [{ id: "material-1", name: "豆腐", usage: "auto" }],
  directions: [],
  tools: [],
  avoid: [],
};

const candidate: RecipeCandidate = {
  id: "candidate-1",
  title: "豆腐のあんかけ",
  timeMinutes: 15,
  badges: ["quick"],
  usedMaterials: ["豆腐"],
  missingIngredients: [],
  reason: "豆腐を主役にできます。",
  detail: {
    candidateId: "candidate-1",
    title: "豆腐のあんかけ",
    ingredients: ["豆腐", "しょうゆ"],
    instructions: ["豆腐を温める", "あんをかける"],
    tasteAdjustments: [],
  },
};

describe("recipe-decision flow", () => {
  test("inputから候補一覧、詳細、調理ビューへ状態を進められる", () => {
    const initial = createInitialRecipeDecisionState();
    const loading = startCandidateLoading(request, initial.requestId + 1);
    const list = showCandidateList(loading, [candidate]);
    const detail = showRecipeDetail(list, candidate.id);
    const cooking = showCookingView(detail, "taste");

    expect(initial.view).toBe("input");
    expect(loading).toMatchObject({ view: "candidate-loading", requestId: 1 });
    expect(list).toMatchObject({ view: "candidate-list", candidates: [candidate] });
    expect(detail).toMatchObject({ view: "recipe-detail", selectedCandidateId: candidate.id });
    expect(cooking).toMatchObject({
      view: "cooking-view",
      selectedCandidateId: candidate.id,
      cookingTab: "taste",
    });
  });

  test("エラー状態は直前のrequest contextを保持できる", () => {
    const loading = startCandidateLoading(request, 3);
    const error = showRecipeDecisionError(" 候補を作れませんでした ", loading);

    expect(error).toEqual({
      view: "error",
      requestId: 3,
      request,
      message: "候補を作れませんでした",
    });
  });
});

describe("recipe-decision adapters", () => {
  test("prompt dataからrecipe-decision用の材料制約つきrequestを作る", () => {
    const data = makeEmptyPromptData({
      materials: ["豆腐150g", "キャベツ"],
      materialUseMode: "specified",
      materialRequests: [
        {
          id: "material-required",
          name: "豆腐150g",
          usage: "required",
          useUpAmountMode: "as-written",
          useUpAmount: "",
        },
        {
          id: "material-use-up",
          name: "キャベツ",
          usage: "use-up",
          useUpAmountMode: "custom",
          useUpAmount: "1/4玉",
        },
      ],
      recipeDirections: ["あっさり"],
    });

    expect(buildRecipeDecisionCandidateRequest(data)).toEqual({
      materials: [
        {
          id: "material-required",
          name: "豆腐150g",
          usage: "required",
        },
        {
          id: "material-use-up",
          name: "キャベツ",
          usage: "use_up",
          amount: "1/4玉",
        },
      ],
      directions: ["あっさり"],
      tools: [],
      avoid: [],
    });
  });

  test("既存AI候補をrecipe-decision候補へ変換する", () => {
    const aiCandidate: AiRecipeCandidate = {
      id: "a",
      title: "豆腐炒め",
      time: 12,
      badges: ["quick", "easy"],
      use: ["豆腐"],
      miss: [],
      why: "短時間で作れます。",
      ing: ["豆腐", "しょうゆ"],
      steps: ["切る", "炒める"],
    };

    expect(toRecipeCandidate(aiCandidate)).toEqual({
      id: "a",
      title: "豆腐炒め",
      timeMinutes: 12,
      badges: ["quick", "easy"],
      usedMaterials: ["豆腐"],
      missingIngredients: [],
      reason: "短時間で作れます。",
      detail: {
        candidateId: "a",
        title: "豆腐炒め",
        ingredients: ["豆腐", "しょうゆ"],
        instructions: ["切る", "炒める"],
        tasteAdjustments: [],
      },
    });
  });

  test("prompt copy fallbackは既存buildPromptを維持する", () => {
    const data = makeEmptyPromptData({ materials: ["豆腐"] });

    expect(buildPromptCopyFallback(data)).toBe(buildPrompt(data));
  });
});

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
