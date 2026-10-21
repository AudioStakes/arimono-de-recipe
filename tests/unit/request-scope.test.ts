import { describe, expect, test } from "vitest";
import type { GeneratePromptRecipeResult } from "../../src/ai-recipe-client";
import { buildConditionChipSpecs } from "../../src/chips";
import { buildPrompt, makeEmptyPromptData } from "../../src/prompt";
import { createRecipeApplication } from "../../src/recipe-application";

describe("current request output", () => {
  test("legacy fields cannot affect the prompt or condition chips", () => {
    const active = makeEmptyPromptData({
      materials: ["豆腐"],
      servings: "大人2人",
      cookingTools: ["電子レンジ"],
      supplementalNotes: "20分以内。卵を使わない。",
    });
    const legacy = {
      ...active,
      requestIntent: "pairing" as const,
      targetDish: ["カレー"],
      pairingTargets: ["餃子"],
      recipeCount: "multiple" as const,
      recipeRoles: ["汁物"],
      cookTime: "60分以内",
      recipeDirections: ["こってり"],
      ngFoodsAndSeasonings: ["豆腐"],
    };
    expect(buildPrompt(legacy)).toBe(buildPrompt(active));
    expect(buildConditionChipSpecs(legacy)).toEqual(buildConditionChipSpecs(active));
    expect(legacy.targetDish).toEqual(["カレー"]);
  });

  test("no default intent chip or removed-field rules are emitted", () => {
    expect(buildConditionChipSpecs(makeEmptyPromptData())).toEqual([]);
    const prompt = buildPrompt(makeEmptyPromptData());
    expect(prompt).not.toContain("使えない・持っていない食材・調味料");
    expect(prompt).not.toContain("その他の要望");
    expect(prompt).toContain("1品分だけを出力してください。");
  });

  test("free text requests can specify multiple recipes and optional explanation", () => {
    const notes = "餃子に合う副菜を2品。20分以内。卵は使わない。保存方法と栄養も知りたい。";
    const prompt = buildPrompt(
      makeEmptyPromptData({ materials: ["豆腐"], supplementalNotes: notes }),
    );
    expect(prompt).toContain(`### その他の要望\n\n${notes}`);
    expect(prompt).not.toContain("レシピを1つ提案");
    expect(prompt).not.toContain("料理名を1つ書いて");
    expect(prompt).toContain("求められた追加説明だけ末尾へ付けてください。");
    expect(prompt).toContain("品数の希望に従い、希望がなければ1品");
    for (const heading of [
      "作りたい料理",
      "作りたい品数",
      "料理の役割・量感",
      "調理時間",
      "レシピの方向性",
      "一緒に出す料理",
      "使えない・持っていない食材・調味料",
    ]) {
      expect(prompt).not.toContain(`### ${heading}`);
    }
  });

  test("changing retained legacy state does not cancel an active request", async () => {
    const pending: { signal: AbortSignal; finish: (result: GeneratePromptRecipeResult) => void }[] =
      [];
    const app = createRecipeApplication({
      sendRecipe: (_prompt, signal) => new Promise((finish) => pending.push({ signal, finish })),
    });
    app.commitInput("materials", "豆腐");
    const prompt = app.getSnapshot().prompt;
    const send = app.send();
    app.setRequestIntent("target-dish");
    app.commitInput("targetDish", "カレー");
    app.setRecipeCount("multiple");
    app.setCookTime("20分以内");
    expect(pending[0]?.signal.aborted).toBe(false);
    expect(app.getSnapshot().prompt).toBe(prompt);
    expect(app.readPromptData()).toMatchObject({
      requestIntent: "auto",
      targetDish: [],
      recipeCount: "auto",
      cookTime: "",
    });
    pending[0]?.finish({ ok: true, recipe: "# 豆腐の料理", model: "fake", usage: null });
    await send;
    expect(app.getSnapshot().aiPrompt.status).toBe("success");
  });
});
