import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { GeneratePromptRecipeResult } from "../../src/ai-recipe-client";
import { createRecipeApplication } from "../../src/recipe-application";

const createApp = () =>
  createRecipeApplication({
    sendRecipe: async () => ({ ok: true, recipe: "# ごはん", model: "fake", usage: null }),
  });

describe("recipe application without a browser", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => {
    vi.clearAllTimers();
    vi.useRealTimers();
  });
  it("captures model choice, cancels old generations, and never automatically switches providers", async () => {
    const requests: {
      model: string;
      signal: AbortSignal;
      finish: (value: GeneratePromptRecipeResult) => void;
    }[] = [];
    const app = createRecipeApplication({
      sendRecipe: (_prompt, signal, model) =>
        new Promise((finish) => requests.push({ model, signal, finish })),
    });
    app.commitInput("materials", "豆腐");
    const prompt = app.getSnapshot().prompt;
    const first = app.send();
    app.setAiModel("@cf/meta/llama-3.3-70b-instruct-fp8-fast");
    expect(requests[0]?.signal.aborted).toBe(true);
    requests[0]?.finish({ ok: true, recipe: "古い回答", model: "old", usage: null });
    await first;
    expect(app.getSnapshot().aiPrompt.status).toBe("idle");
    await vi.advanceTimersByTimeAsync(10_000);
    const second = app.send();
    expect(requests[1]?.model).toBe("@cf/meta/llama-3.3-70b-instruct-fp8-fast");
    requests[1]?.finish({ ok: true, recipe: "新しい回答", model: "new", usage: null });
    await second;
    expect(app.getSnapshot().prompt).toBe(prompt);
    await vi.advanceTimersByTimeAsync(10_000);
    app.setAvailableAiModels(["openai/gpt-oss-20b"]);
    expect(app.getSnapshot().selectedAiModel).toBe("@cf/meta/llama-3.3-70b-instruct-fp8-fast");
    await app.send();
    expect(requests).toHaveLength(2);
    expect(app.getSnapshot().aiPrompt.status).toBe("error");
  });
  it("commits exact material names and preserves metadata through rename and duplicate merge", () => {
    const app = createApp();
    app.commitInput("materials", "  豆腐 150g  ");
    app.commitInput("materials", "豆腐 150g");
    const first = app.getSnapshot().materialRequests[0];
    expect(first).toMatchObject({
      name: "豆腐 150g",
      usage: "auto",
      useUpAmountMode: "as-written",
    });
    if (!first) throw new Error("Expected material");
    app.updateMaterial(first.id, {
      usage: "use-up",
      useUpAmountMode: "custom",
      useUpAmount: "150g",
    });
    app.editValue("materials", first.name, "木綿豆腐");
    expect(app.getSnapshot().materialRequests).toEqual([
      {
        ...first,
        name: "木綿豆腐",
        usage: "use-up",
        useUpAmountMode: "custom",
        useUpAmount: "150g",
      },
    ]);
    app.commitInput("materials", "卵");
    const destination = app.getSnapshot().materialRequests[1];
    app.editValue("materials", "木綿豆腐", "卵");
    expect(app.getSnapshot().materialRequests).toEqual([destination]);
  });

  it("retains legacy state while exposing only current request fields and servings", () => {
    const app = createApp();
    app.commitInput("materials", " 卵、豆腐  150g ");
    app.commitInput("targetDish", "カレー");
    app.commitInput("pairingTargets", "味噌汁");
    app.setRecipeCount("multiple");
    app.commitInput("recipeRoles", "主菜・しっかり");
    app.commitInput("recipeRoles", "副菜・一品");
    app.setServingsMode("custom");
    app.adjustServings("adultCount", 20);
    app.adjustServings("childCount", 2);
    app.setRequestIntent("target-dish");
    expect(app.readPromptData()).toMatchObject({
      materials: ["卵、豆腐  150g"],
      targetDish: [],
      pairingTargets: [],
      recipeCount: "auto",
      recipeRoles: [],
      servings: "大人10人、子供2人",
    });
    app.setRequestIntent("pairing");
    app.setRecipeCount("auto");
    expect(app.readPromptData()).toMatchObject({
      targetDish: [],
      pairingTargets: [],
      recipeCount: "auto",
      recipeRoles: [],
    });
    app.setRequestIntent("target-dish");
    expect(app.readPromptData().targetDish).toEqual([]);
    expect(app.getValues("targetDish")).toEqual(["カレー"]);
    expect(app.getValues("pairingTargets")).toEqual(["味噌汁"]);
    app.setServingsMode("unspecified");
    expect(app.readPromptData().servings).toBe("");
    app.setServingsMode("custom");
    expect(app.readPromptData().servings).toBe("大人10人、子供2人");
  });

  it("invalidates old requests by generation even when the prompt returns to the same text", async () => {
    const pending: {
      resolve: (result: GeneratePromptRecipeResult) => void;
      signal: AbortSignal;
      prompt: string;
    }[] = [];
    const app = createRecipeApplication({
      sendRecipe: (prompt, signal) =>
        new Promise((resolve) => pending.push({ resolve, signal, prompt })),
    });
    app.commitInput("materials", "卵");
    const first = app.send();
    void app.send();
    expect(pending).toHaveLength(1);
    expect(app.getSnapshot().aiPrompt.status).toBe("loading");
    expect(pending[0]?.prompt).toBe(app.getSnapshot().prompt);
    app.setSupplementalNotes("変更");
    expect(pending[0]?.signal.aborted).toBe(true);
    app.setSupplementalNotes("");
    await vi.advanceTimersByTimeAsync(10_000);
    const second = app.send();
    pending[1]?.resolve({ ok: true, recipe: "新しい回答", model: "fake", usage: null });
    await second;
    pending[0]?.resolve({ ok: true, recipe: "古い回答", model: "fake", usage: null });
    await first;
    expect(app.getSnapshot().aiPrompt).toMatchObject({ status: "success", recipe: "新しい回答" });
    app.commitInput("targetDish", "非表示の料理");
    expect(app.getSnapshot().aiPrompt.status).toBe("success");
  });

  it("offers all existing candidates without changing selected values or exposing mutable state", () => {
    const app = createApp();
    expect(app.getSuggestions("materials")).toHaveLength(20);
    expect(app.getSuggestions("materials").slice(0, 3)).toEqual(["卵", "豆腐", "鶏もも肉"]);
    app.commitInput("materials", "卵");
    expect(app.getSuggestions("materials")).not.toContain("卵");
    expect(app.getSuggestions("materials", "高野")).toContain("高野豆腐");
    const snapshot = app.getSnapshot();
    Reflect.set(snapshot.materialRequests[0] ?? {}, "name", "外から変更");
    Reflect.set(snapshot.values.materials, 1, "外から追加");
    Reflect.set(snapshot.servingCounts, "adultCount", 8);
    expect(app.getValues("materials")).toEqual(["卵"]);
    expect(app.getSnapshot().servingCounts.adultCount).toBeUndefined();
    app.commitInput("materials", "豆腐");
    expect(snapshot.materialRequests).toHaveLength(1);
    expect(snapshot.prompt).not.toContain("- 豆腐\n");
  });

  it("keeps copyable text during input errors, request failure, retry and cancellation", async () => {
    let attempts = 0;
    const app = createRecipeApplication({
      sendRecipe: async () => {
        attempts += 1;
        return attempts === 1
          ? { ok: false, error: { code: "request_timed_out", message: "待機時間を超えました" } }
          : { ok: true, recipe: "# 完成", model: "fake", usage: null };
      },
    });
    await app.send();
    expect(app.getSnapshot().aiPrompt.errorSource).toBe("input");
    expect(attempts).toBe(0);
    expect(app.getSnapshot().sendCooldownSeconds).toBe(0);
    app.commitInput("materials", "豆腐150g");
    const id = app.getSnapshot().materialRequests[0]?.id ?? "";
    app.updateMaterial(id, { usage: "use-up" });
    const invalidPrompt = app.getSnapshot().prompt;
    await app.send();
    expect(app.getSnapshot().materialErrors).toHaveLength(1);
    expect(app.getSnapshot().prompt).toBe(invalidPrompt);
    expect(attempts).toBe(0);
    expect(app.getSnapshot().sendCooldownSeconds).toBe(0);
    app.updateMaterial(id, { useUpAmountMode: "as-written", useUpAmount: "150g" });
    expect(app.readPromptData().materialRequests[0]).toMatchObject({
      useUpAmountMode: "as-written",
      useUpAmount: "150g",
    });
    expect(app.getSnapshot().materialErrors).toEqual([]);
    const prompt = app.getSnapshot().prompt;
    await app.send();
    expect(app.getSnapshot().aiPrompt).toMatchObject({ status: "error", errorSource: "request" });
    expect(app.getSnapshot().prompt).toBe(prompt);
    await vi.advanceTimersByTimeAsync(10_000);
    await app.send();
    expect(app.getSnapshot().aiPrompt.status).toBe("success");
    app.reportRenderFailure();
    expect(app.getSnapshot().aiPrompt).toMatchObject({ status: "error", errorSource: "request" });
    app.cancel();
    expect(app.getSnapshot().aiPrompt.status).toBe("idle");
    expect(app.getSnapshot().prompt).toBe(prompt);
  });

  it("publishes changes with detached snapshots and can unsubscribe", () => {
    const app = createApp();
    const prompts: string[] = [];
    const unsubscribe = app.subscribe(() => prompts.push(app.getSnapshot().prompt));
    app.commitInput("materials", "鶏肉");
    app.setSupplementalNotes("20分以内");
    expect(prompts).toHaveLength(2);
    expect(prompts[1]).toContain("20分以内");
    unsubscribe();
    app.clearValues("materials");
    expect(prompts).toHaveLength(2);
    expect(app.getValues("materials")).toEqual([]);
  });

  it("can rename and remove a material by its stable ID", () => {
    const app = createApp();
    app.commitInput("materials", "玉ねぎ");
    const id = app.getSnapshot().materialRequests[0]?.id ?? "";
    app.renameMaterial(id, "新玉ねぎ");
    app.updateMaterial(id, { useUpAmount: "1個" });
    expect(app.getSnapshot().materialRequests[0]?.useUpAmountMode).toBe("custom");
    app.setMaterialAmount(id, "1/2個");
    expect(app.getSnapshot().materialRequests[0]).toMatchObject({ id, name: "新玉ねぎ" });
    expect(app.getSnapshot().materialRequests[0]).toMatchObject({
      useUpAmount: "1/2個",
      useUpAmountMode: "custom",
    });
    app.removeMaterial(id);
    expect(app.getSnapshot().materialRequests).toEqual([]);
  });

  it("cancels an in-flight request and ignores a transport that resolves after cancellation", async () => {
    let complete: (result: GeneratePromptRecipeResult) => void = () => {};
    let signal: AbortSignal | undefined;
    const app = createRecipeApplication({
      sendRecipe: (_prompt, requestSignal) => {
        signal = requestSignal;
        return new Promise((resolve) => {
          complete = resolve;
        });
      },
    });
    app.commitInput("materials", "卵");
    const prompt = app.getSnapshot().prompt;
    const pending = app.send();
    app.cancel();
    expect(signal?.aborted).toBe(true);
    complete({ ok: true, recipe: "取り消した回答", model: "fake", usage: null });
    await pending;
    expect(app.getSnapshot().aiPrompt).toMatchObject({ status: "idle", recipe: "" });
    expect(app.getSnapshot().prompt).toBe(prompt);
  });
});

describe("minimum AI send interval", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => {
    vi.clearAllTimers();
    vi.useRealTimers();
  });

  it.each([true, false])(
    "keeps the 10-second deadline after success=%s, edits and cancellation",
    async (success) => {
      const sendRecipe = vi.fn(
        async (): Promise<GeneratePromptRecipeResult> =>
          success
            ? { ok: true, recipe: "完成", model: "fake", usage: null }
            : { ok: false, error: { code: "network_error", message: "接続できません" } },
      );
      const app = createRecipeApplication({ sendRecipe });
      app.commitInput("materials", "豆腐");
      await app.send();
      expect(app.getSnapshot().sendCooldownSeconds).toBe(10);
      app.setSupplementalNotes("温かい料理");
      app.setAiModel("@cf/meta/llama-3.3-70b-instruct-fp8-fast");
      app.cancel();
      app.clearValues("materials");
      app.commitInput("materials", "卵");
      await app.send();
      await vi.advanceTimersByTimeAsync(9_999);
      await app.send();
      expect(sendRecipe).toHaveBeenCalledTimes(1);
      expect(app.getSnapshot().sendCooldownSeconds).toBe(1);
      await vi.advanceTimersByTimeAsync(1);
      expect(app.getSnapshot().sendCooldownSeconds).toBe(0);
      await app.send();
      expect(sendRecipe).toHaveBeenCalledTimes(2);
      expect(app.getSnapshot().sendCooldownSeconds).toBe(10);
    },
  );

  it("keeps a slow request disabled even after ten seconds", async () => {
    let finish = (_result: GeneratePromptRecipeResult) => {};
    const sendRecipe = vi.fn(
      () =>
        new Promise<GeneratePromptRecipeResult>((resolve) => {
          finish = resolve;
        }),
    );
    const app = createRecipeApplication({ sendRecipe });
    app.commitInput("materials", "豆腐");
    const request = app.send();
    await vi.advanceTimersByTimeAsync(10_000);
    await app.send();
    expect(app.getSnapshot().aiPrompt.status).toBe("loading");
    expect(sendRecipe).toHaveBeenCalledTimes(1);
    finish({ ok: true, recipe: "完成", model: "fake", usage: null });
    await request;
    const second = app.send();
    expect(sendRecipe).toHaveBeenCalledTimes(2);
    finish({ ok: true, recipe: "再送後", model: "fake", usage: null });
    await second;
  });
});
