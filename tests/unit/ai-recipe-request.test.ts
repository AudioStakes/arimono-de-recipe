import { describe, expect, test } from "vitest";
import {
  buildAiRecipeCandidateRequest,
  getAiRecipeInputLimitError,
} from "../../src/ai-recipe-request";
import { aiRecipeCandidateLimits } from "../../src/ai-recipe-schema";
import { makeEmptyPromptData } from "../../src/prompt";

const aiRecipeRequestLimits = aiRecipeCandidateLimits.request;

describe("buildAiRecipeCandidateRequest", () => {
  test("候補に入りきらない必須材料の指定をAI送信前に案内する", () => {
    const names = Array.from({ length: 7 }, (_, index) => `材料${index}`);
    const data = makeEmptyPromptData({
      materials: names,
      materialUseMode: "specified",
      materialRequests: names.map((name, index) => ({
        id: `material-${index}`,
        name,
        usage: "required",
        useUpAmountMode: "as-written",
        useUpAmount: "",
      })),
    });
    expect(getAiRecipeInputLimitError(data)).toContain("合計6件まで");
    expect(getAiRecipeInputLimitError(data)).toContain("依頼文コピー");
    data.materialRequests[0] = {
      ...data.materialRequests[0],
      id: "material-0",
      name: "材料0",
      usage: "auto",
      useUpAmountMode: "as-written",
      useUpAmount: "",
    };
    expect(getAiRecipeInputLimitError(data)).toBeNull();
  });
  test("NG指定を上限で黙って切り捨てず、送信前のエラーにできる", () => {
    const data = makeEmptyPromptData({
      materials: ["豆腐"],
      ngFoodsAndSeasonings: Array.from({ length: 9 }, (_, index) => `NG${index}`),
    });
    expect(getAiRecipeInputLimitError(data)).toContain("8件まで");
    expect(getAiRecipeInputLimitError(data)).toContain("依頼文コピー");
  });

  test("材料や自由記述を黙って切り捨てず、入力上限を知らせる", () => {
    expect(
      getAiRecipeInputLimitError(
        makeEmptyPromptData({
          materials: Array.from({ length: 13 }, (_, index) => `材料${index}`),
        }),
      ),
    ).toContain("12件まで");
    expect(
      getAiRecipeInputLimitError(
        makeEmptyPromptData({
          materials: ["豆腐"],
          supplementalNotes: "あ".repeat(181),
        }),
      ),
    ).toContain("長すぎます");
    expect(
      getAiRecipeInputLimitError(
        makeEmptyPromptData({
          materials: ["あ".repeat(81)],
        }),
      ),
    ).toContain("80文字まで");
    expect(
      getAiRecipeInputLimitError(
        makeEmptyPromptData({
          materials: ["豆腐"],
          ngFoodsAndSeasonings: ["  卵", "卵  "],
        }),
      ),
    ).toBeNull();
  });

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
      materials: [
        { name: "豆腐", usage: "auto" },
        { name: "キャベツ", usage: "auto" },
      ],
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

  test("必ず使う・使い切りたい材料制約をmaterialsへ含める", () => {
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

    expect(request.materials).toEqual([
      { name: "豆腐150g", usage: "required" },
      { name: "キャベツ", usage: "use_up", amount: "1/4玉" },
    ]);
    expect(request.notes).toBe("薄味");
  });

  test("自動・必ず使う材料の分量もmaterialsへ含める", () => {
    const request = buildAiRecipeCandidateRequest(
      makeEmptyPromptData({
        materials: ["豆腐", "卵"],
        materialUseMode: "specified",
        materialRequests: [
          {
            id: "material-auto",
            name: "豆腐",
            usage: "auto",
            useUpAmountMode: "custom",
            useUpAmount: "150g",
          },
          {
            id: "material-required",
            name: "卵",
            usage: "required",
            useUpAmountMode: "custom",
            useUpAmount: "2個",
          },
        ],
      }),
    );

    expect(request.materials).toEqual([
      { name: "豆腐", usage: "auto", amount: "150g" },
      { name: "卵", usage: "required", amount: "2個" },
    ]);
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
            useUpAmountMode: "custom",
            useUpAmount: "1個",
          },
        ],
      }),
    );

    expect(request.materials).toHaveLength(aiRecipeRequestLimits.maxMaterials);
    expect(request.materials.slice(0, 2)).toEqual([
      { name: "材料13", usage: "required" },
      { name: "材料12", usage: "use_up", amount: "1個" },
    ]);
    expect(request.notes).toBeUndefined();
  });
});
