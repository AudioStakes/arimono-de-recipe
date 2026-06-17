import { describe, expect, test } from "vitest";
import { buildAiRecipeCandidateRequest } from "../../src/ai-recipe-request";
import { aiRecipeCandidateLimits } from "../../src/ai-recipe-schema";
import { makeEmptyPromptData } from "../../src/prompt";

const aiRecipeRequestLimits = aiRecipeCandidateLimits.request;

describe("buildAiRecipeCandidateRequest", () => {
  test("短い構造化JSONを作り、空項目を省略する", () => {
    const request = buildAiRecipeCandidateRequest(
      makeEmptyPromptData({
        materials: ["豆腐", "豆腐", "  キャベツ  "],
        servings: "大人2人",
        cookTime: "",
        recipeDirections: ["あっさり"],
        cookingTools: [],
        ngFoodsAndSeasonings: [],
        supplementalNotes: "",
      }),
    );

    expect(request).toEqual({
      mode: "candidates",
      materials: ["豆腐", "キャベツ"],
      servings: "大人2人",
      directions: ["あっさり"],
    });
    expect(JSON.stringify(request)).not.toContain("## 役割");
  });

  test("materials, directions, tools, avoid, notesの上限を適用する", () => {
    const request = buildAiRecipeCandidateRequest(
      makeEmptyPromptData({
        materials: Array.from({ length: 20 }, (_, index) => `材料${index}`),
        recipeDirections: Array.from({ length: 8 }, (_, index) => `方向${index}`),
        recipeRoles: ["主菜", "副菜"],
        cookingTools: Array.from({ length: 10 }, (_, index) => `道具${index}`),
        ngFoodsAndSeasonings: Array.from({ length: 10 }, (_, index) => `NG${index}`),
        supplementalNotes: "あ".repeat(aiRecipeRequestLimits.maxNotesLength + 20),
      }),
    );

    expect(request.materials).toHaveLength(aiRecipeRequestLimits.maxMaterials);
    expect(request.directions).toHaveLength(aiRecipeRequestLimits.maxDirections);
    expect(request.tools).toHaveLength(aiRecipeRequestLimits.maxTools);
    expect(request.avoid).toHaveLength(aiRecipeRequestLimits.maxAvoid);
    expect(request.notes).toHaveLength(aiRecipeRequestLimits.maxNotesLength);
  });

  test("必ず使う・使い切りたい材料制約を短いnotesへ含める", () => {
    const request = buildAiRecipeCandidateRequest(
      makeEmptyPromptData({
        materials: ["豆腐150g", "キャベツ"],
        materialUseMode: "specified",
        materialRequests: [
          {
            id: "material-1",
            name: "豆腐150g",
            usage: "required",
            useUpAmountMode: "as-written",
            useUpAmount: "",
          },
          {
            id: "material-2",
            name: "キャベツ",
            usage: "use-up",
            useUpAmountMode: "custom",
            useUpAmount: "1/4玉",
          },
        ],
        supplementalNotes: "薄味",
      }),
    );

    expect(request.notes).toBe("必須:豆腐150g / 使切:キャベツ(1/4玉)。薄味");
  });

  test("必ず使う・使い切りたい材料をmaterials上限内で優先する", () => {
    const request = buildAiRecipeCandidateRequest(
      makeEmptyPromptData({
        materials: Array.from({ length: 14 }, (_, index) => `材料${index}`),
        materialUseMode: "specified",
        materialRequests: [
          {
            id: "material-required",
            name: "材料13",
            usage: "required",
            useUpAmountMode: "as-written",
            useUpAmount: "",
          },
          {
            id: "material-use-up",
            name: "材料12",
            usage: "use-up",
            useUpAmountMode: "as-written",
            useUpAmount: "",
          },
        ],
      }),
    );

    expect(request.materials).toHaveLength(aiRecipeRequestLimits.maxMaterials);
    expect(request.materials.slice(0, 2)).toEqual(["材料13", "材料12"]);
    expect(request.notes).toContain("必須:材料13");
    expect(request.notes).toContain("使切:材料12");
  });
});
