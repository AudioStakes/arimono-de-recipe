import { type AiModelId, aiModels, defaultAiModelId, findAiModel } from "./ai-models";
import type { GeneratePromptRecipeResult } from "./ai-recipe-client";
import { getComboOptionValues, getInitialComboOptionValues } from "./combo-options";
import { updateComboValues } from "./combo-values";
import { createPromptDataReader } from "./conditions";
import { combos, pairingRecipeRoleOptions, servingsModeOptions } from "./data";
import { buildPrompt } from "./prompt";
import { validateMaterialRequestAmounts } from "./recipe-decision/materials";
import {
  clampServingCount,
  formatServings,
  type ServingCounts,
  type ServingGroupId,
} from "./servings";
import { filterAvailableComboOptions } from "./suggestions";
import type { ComboId, MaterialRequest, RecipeCount, RequestIntent, ServingsMode } from "./types";

export type RecipeApplicationDependencies = {
  sendRecipe: (
    prompt: string,
    signal: AbortSignal,
    model: AiModelId,
  ) => Promise<GeneratePromptRecipeResult>;
};

export function createRecipeApplication(dependencies: RecipeApplicationDependencies) {
  let materialRequests: MaterialRequest[] = [];
  const values: Record<Exclude<ComboId, "materials">, string[]> = {
    targetDish: [],
    recipeRoles: [],
    cookingTools: [],
    pairingTargets: [],
    recipeDirections: [],
    ngFoodsAndSeasonings: [],
  };
  let requestIntent: RequestIntent = "auto";
  let recipeCount: RecipeCount = "auto";
  let servingsMode: ServingsMode = "unspecified";
  const servingCounts: ServingCounts = {};
  let cookTime = "";
  let supplementalNotes = "";
  let nextId = 0;
  let selectedAiModel: AiModelId = defaultAiModelId;
  let availableAiModels = new Set<AiModelId>(
    aiModels.filter((model) => model.provider === "cloudflare").map((model) => model.id),
  );

  const getValues = (group: ComboId): string[] =>
    group === "materials" ? materialRequests.map((request) => request.name) : [...values[group]];
  const effectiveCount = (): RecipeCount =>
    requestIntent === "target-dish"
      ? "auto"
      : requestIntent === "pairing" && recipeCount === "auto"
        ? "one"
        : recipeCount;
  const isSingle = (group: ComboId): boolean =>
    group === "recipeRoles"
      ? effectiveCount() === "one"
      : combos.find((combo) => combo.id === group)?.single === true;
  const syncRoleMode = (): void => {
    if (isSingle("recipeRoles")) values.recipeRoles = values.recipeRoles.slice(0, 1);
  };
  type AiState = {
    status: "idle" | "loading" | "success" | "error";
    submittedPrompt: string;
    recipe: string;
    errorMessage: string;
    errorSource: "input" | "request" | null;
  };
  const idle = (): AiState => ({
    status: "idle",
    submittedPrompt: "",
    recipe: "",
    errorMessage: "",
    errorSource: null,
  });
  let aiPrompt = idle();
  let generation = 0;
  let controller: AbortController | null = null;
  let nextSendAt = 0;
  const sendCooldownSeconds = (): number =>
    Math.max(0, Math.ceil((nextSendAt - performance.now()) / 1000));
  const listeners = new Set<() => void>();
  const emit = (): void => {
    for (const listener of listeners) listener();
  };
  const reader = createPromptDataReader({
    getComboValues: getValues,
    getRequestIntent: () => requestIntent,
    getMaterialUseMode: () => "specified",
    getMaterialRequests: () => materialRequests.map((request) => ({ ...request })),
    getServingsMode: () => servingsMode,
    getServingsText: () =>
      servingsMode === "unspecified"
        ? ""
        : servingsMode === "custom"
          ? formatServings(servingCounts)
          : (servingsModeOptions.find((option) => option.value === servingsMode)?.label ?? ""),
    getRecipeCount: () => recipeCount,
    getCookTimeText: () => cookTime,
    getSupplementalNotes: () => supplementalNotes.trim(),
  });

  const getPrompt = (): string => buildPrompt(reader.read());
  const change = (action: () => void): void => {
    const before = getPrompt();
    action();
    if (getPrompt() !== before) {
      generation += 1;
      controller?.abort();
      controller = null;
      aiPrompt = idle();
    }
    emit();
  };

  const renameMaterial = (id: string, name: string): void => {
    const oldName = materialRequests.find((request) => request.id === id)?.name;
    if (!oldName) return;
    const names = getValues("materials");
    if (updateComboValues(names, oldName, name) === names) return;
    const duplicate = names.includes(name.trim());
    materialRequests = materialRequests.flatMap((request) =>
      request.id !== id ? [request] : duplicate ? [] : [{ ...request, name: name.trim() }],
    );
  };

  return {
    getValues,
    isSingle,
    getSuggestions(group: ComboId, query = ""): string[] {
      const source =
        group === "recipeRoles" && !query.trim() && requestIntent === "pairing"
          ? [...pairingRecipeRoleOptions]
          : query.trim()
            ? getComboOptionValues(group)
            : getInitialComboOptionValues(group);
      return filterAvailableComboOptions(source, query, getValues(group));
    },
    commitInput(group: ComboId, value: string): void {
      change(() => {
        const name = value.trim();
        if (!name || getValues(group).includes(name)) return;
        if (group !== "materials") {
          values[group] = isSingle(group) ? [name] : [...values[group], name];
          return;
        }
        nextId += 1;
        materialRequests = [
          ...materialRequests,
          {
            id: `material-${nextId}`,
            name,
            usage: "auto",
            useUpAmountMode: "as-written",
            useUpAmount: "",
          },
        ];
      });
    },
    editValue(group: ComboId, oldValue: string, newValue: string): void {
      change(() => {
        const names = getValues(group);
        const next = updateComboValues(names, oldValue, newValue);
        if (next === names) return;
        if (group !== "materials") {
          values[group] = next;
          return;
        }
        const id = materialRequests.find((request) => request.name === oldValue)?.id;
        if (id) renameMaterial(id, newValue);
      });
    },
    removeValue(group: ComboId, value: string): void {
      change(() => {
        if (group === "materials")
          materialRequests = materialRequests.filter(
            (request) => request.name.trim() !== value.trim(),
          );
        else values[group] = values[group].filter((item) => item.trim() !== value.trim());
      });
    },
    clearValues(group: ComboId): void {
      change(() => {
        if (group === "materials") materialRequests = [];
        else values[group] = [];
      });
    },
    updateMaterial(
      id: string,
      updates: Partial<Pick<MaterialRequest, "usage" | "useUpAmountMode" | "useUpAmount">>,
    ): void {
      change(() => {
        materialRequests = materialRequests.map((request) =>
          request.id === id
            ? {
                ...request,
                ...updates,
                ...(updates.useUpAmount !== undefined && updates.useUpAmountMode === undefined
                  ? {
                      useUpAmountMode: updates.useUpAmount.trim()
                        ? ("custom" as const)
                        : ("as-written" as const),
                    }
                  : {}),
              }
            : request,
        );
      });
    },
    renameMaterial(id: string, name: string): void {
      change(() => renameMaterial(id, name));
    },
    removeMaterial(id: string): void {
      change(() => {
        materialRequests = materialRequests.filter((request) => request.id !== id);
      });
    },
    setMaterialAmount(id: string, amount: string): void {
      change(() => {
        materialRequests = materialRequests.map((request) =>
          request.id === id
            ? {
                ...request,
                useUpAmount: amount,
                useUpAmountMode: amount.trim() ? "custom" : "as-written",
              }
            : request,
        );
      });
    },
    setRequestIntent(value: RequestIntent): void {
      change(() => {
        requestIntent = value;
        syncRoleMode();
      });
    },
    setRecipeCount(value: RecipeCount): void {
      change(() => {
        recipeCount = value;
        syncRoleMode();
      });
    },
    setServingsMode(value: ServingsMode): void {
      change(() => {
        servingsMode = value;
      });
    },
    adjustServings(id: ServingGroupId, delta: number): void {
      change(() => {
        servingCounts[id] = clampServingCount((servingCounts[id] ?? 0) + delta);
      });
    },
    setCookTime(value: string): void {
      change(() => {
        cookTime = value;
      });
    },
    setSupplementalNotes(value: string): void {
      change(() => {
        supplementalNotes = value;
      });
    },
    readPromptData: reader.read,
    subscribe(listener: () => void): () => void {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    async send(): Promise<void> {
      if (aiPrompt.status === "loading" || sendCooldownSeconds() > 0) return;
      const submittedPrompt = getPrompt();
      const amountErrors = validateMaterialRequestAmounts(materialRequests);
      const errorMessage = amountErrors.length
        ? "使い切る材料の分量を入力してください。依頼文はコピーできます。"
        : !materialRequests.length
          ? "まずは家にある食材を入れてください。"
          : !availableAiModels.has(selectedAiModel)
            ? "選択したAIは現在利用できません。別のモデルを選ぶか、依頼文をコピーしてください。"
            : "";
      const requestGeneration = ++generation;
      if (errorMessage) {
        aiPrompt = {
          ...idle(),
          status: "error",
          submittedPrompt,
          errorMessage,
          errorSource: "input",
        };
        emit();
        return;
      }
      nextSendAt = performance.now() + 10_000;
      controller = new AbortController();
      const signal = controller.signal;
      aiPrompt = { ...idle(), status: "loading", submittedPrompt };
      emit();
      let result: GeneratePromptRecipeResult;
      try {
        result = await dependencies.sendRecipe(submittedPrompt, signal, selectedAiModel);
      } catch {
        result = {
          ok: false,
          error: { code: "network_error", message: "AIへの接続に失敗しました。" },
        };
      }
      if (generation !== requestGeneration) return;
      controller = null;
      aiPrompt = {
        status: result.ok ? "success" : "error",
        submittedPrompt,
        recipe: result.ok ? result.recipe : "",
        errorMessage: result.ok ? "" : result.error.message,
        errorSource: result.ok ? null : "request",
      };
      emit();
    },
    cancel(): void {
      generation += 1;
      controller?.abort();
      controller = null;
      aiPrompt = idle();
      emit();
    },
    setAiModel(model: AiModelId): void {
      if (!findAiModel(model) || !availableAiModels.has(model) || model === selectedAiModel) return;
      selectedAiModel = model;
      generation += 1;
      controller?.abort();
      controller = null;
      aiPrompt = idle();
      emit();
    },
    setAvailableAiModels(models: readonly AiModelId[]): void {
      availableAiModels = new Set(models.filter((model) => findAiModel(model)));
      if (!availableAiModels.has(selectedAiModel)) {
        generation += 1;
        controller?.abort();
        controller = null;
        aiPrompt = idle();
      }
      emit();
    },
    reportRenderFailure(): void {
      if (aiPrompt.status !== "success") return;
      aiPrompt = {
        ...aiPrompt,
        status: "error",
        recipe: "",
        errorSource: "request",
        errorMessage:
          "AIの回答を表示できませんでした。もう一度送信するか、依頼文をコピーしてください。",
      };
      emit();
    },
    getSnapshot() {
      return {
        materialRequests: materialRequests.map((request) => ({
          ...request,
        })) as readonly Readonly<MaterialRequest>[],
        materialErrors: validateMaterialRequestAmounts(materialRequests),
        aiPrompt: { ...aiPrompt } as Readonly<AiState>,
        selectedAiModel,
        sendCooldownSeconds: sendCooldownSeconds(),
        availableAiModels: [...availableAiModels] as readonly AiModelId[],
        requestIntent,
        recipeCount,
        effectiveRecipeCount: effectiveCount(),
        servingsMode,
        servingCounts: { ...servingCounts },
        cookTime,
        supplementalNotes,
        values: Object.fromEntries(combos.map(({ id }) => [id, getValues(id)])) as Record<
          ComboId,
          string[]
        >,
        prompt: getPrompt(),
      } as const;
    },
  };
}

export type RecipeApplication = ReturnType<typeof createRecipeApplication>;

export type RecipeSnapshot = ReturnType<RecipeApplication["getSnapshot"]>;
