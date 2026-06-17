import { generateRecipe } from "./ai-recipe-client";
import type { AppElements } from "./app-elements";
import { type PromptPanelServices, refreshPromptPanel } from "./output-panel";
import type { AiRecipeSurface, AppState } from "./types";

const mobileAiRecipeTestIds = {
  "ai-recipe-heading": "mobile-ai-recipe-heading",
  "ai-recipe-status": "mobile-ai-recipe-status",
  "ai-recipe-content": "mobile-ai-recipe-content",
  "ai-recipe-error": "mobile-ai-recipe-error",
  "ai-recipe-model": "mobile-ai-recipe-model",
} as const;

type AiRecipeTestId = keyof typeof mobileAiRecipeTestIds;

const FALLBACK_MESSAGE =
  "AIへの依頼に失敗しました。AI向けレシピ依頼文をコピーして、普段使っているAIに貼り付けてください。";

function setGenerateButtonState(elements: AppElements, loading: boolean): void {
  for (const button of [elements.generateRecipe, elements.generateRecipeMobile]) {
    button.disabled = loading;
    button.setAttribute("aria-busy", String(loading));
    const label = button.querySelector<HTMLElement>(".action-button-label");
    if (label) {
      label.textContent = loading ? "AIに依頼しています" : "AIでレシピを作成";
    }
  }
}

function getSurfacePanel(elements: AppElements, surface: AiRecipeSurface): HTMLElement {
  return surface === "mobile" ? elements.aiRecipePanelMobile : elements.aiRecipePanel;
}

function getTestId(surface: AiRecipeSurface, testId: AiRecipeTestId): string {
  return surface === "mobile" ? mobileAiRecipeTestIds[testId] : testId;
}

function renderPanelHeading(text: string, surface: AiRecipeSurface): HTMLHeadingElement {
  const heading = document.createElement("h3");
  heading.setAttribute("data-testid", getTestId(surface, "ai-recipe-heading"));
  heading.textContent = text;
  return heading;
}

function renderPanelParagraph(
  text: string,
  className = "",
  testId = "",
  role: "status" | "alert" | "" = "",
): HTMLParagraphElement {
  const paragraph = document.createElement("p");
  paragraph.textContent = text;
  if (className) paragraph.className = className;
  if (testId) paragraph.setAttribute("data-testid", testId);
  if (role) {
    paragraph.setAttribute("role", role);
    paragraph.tabIndex = -1;
  }
  return paragraph;
}

function renderAiRecipeSurface(
  state: AppState,
  elements: AppElements,
  surface: AiRecipeSurface,
): void {
  const panel = getSurfacePanel(elements, surface);
  const aiRecipe = state.aiRecipe;
  const live = aiRecipe.activeSurface === surface;

  panel.replaceChildren();
  panel.hidden = aiRecipe.status === "idle";
  panel.setAttribute("data-state", aiRecipe.status);
  panel.setAttribute("aria-busy", String(aiRecipe.status === "loading"));

  if (aiRecipe.status === "idle") {
    return;
  }

  if (aiRecipe.status === "loading") {
    panel.replaceChildren(
      renderPanelHeading("AIからのレシピ案", surface),
      renderPanelParagraph(
        "AIにレシピ案を依頼しています。",
        "ai-recipe-status-text",
        getTestId(surface, "ai-recipe-status"),
        live ? "status" : "",
      ),
    );
    return;
  }

  if (aiRecipe.status === "error") {
    const message = renderPanelParagraph(
      aiRecipe.errorMessage || FALLBACK_MESSAGE,
      "",
      getTestId(surface, "ai-recipe-error"),
      live ? "alert" : "",
    );
    message.className = "ai-recipe-error-message";
    panel.replaceChildren(renderPanelHeading("AIへの依頼に失敗しました", surface), message);
    return;
  }

  const status = renderPanelParagraph(
    "AIからのレシピ案を表示しました。",
    "ai-recipe-status-text",
    getTestId(surface, "ai-recipe-status"),
    live ? "status" : "",
  );
  const recipe = document.createElement("div");
  recipe.className = "ai-recipe-content";
  recipe.setAttribute("data-testid", getTestId(surface, "ai-recipe-content"));
  recipe.textContent = aiRecipe.recipe;

  const meta = renderPanelParagraph(
    `使用モデル: ${aiRecipe.model}`,
    "ai-recipe-meta",
    getTestId(surface, "ai-recipe-model"),
  );
  panel.replaceChildren(renderPanelHeading("AIからのレシピ案", surface), status, recipe, meta);
}

export function renderAiRecipePanel(state: AppState, elements: AppElements): void {
  setGenerateButtonState(elements, state.aiRecipe.status === "loading");
  renderAiRecipeSurface(state, elements, "desktop");
  renderAiRecipeSurface(state, elements, "mobile");
}

function focusAiRecipeStatus(elements: AppElements, surface: AiRecipeSurface): void {
  const panel = getSurfacePanel(elements, surface);
  panel.querySelector<HTMLElement>('[role="status"], [role="alert"]')?.focus();
}

export function resetAiRecipeForInputChange(state: AppState, elements: AppElements): void {
  if (state.aiRecipe.status === "idle") {
    return;
  }

  state.aiRecipe = {
    status: "idle",
    activeSurface: state.aiRecipe.activeSurface,
    recipe: "",
    model: "",
    usage: null,
    errorMessage: "",
    promptSnapshot: "",
    requestId: state.aiRecipe.requestId + 1,
  };
  renderAiRecipePanel(state, elements);
}

export async function createAiRecipe(
  state: AppState,
  elements: AppElements,
  services: PromptPanelServices,
  surface: AiRecipeSurface = "desktop",
): Promise<void> {
  if (state.aiRecipe.status === "loading") {
    return;
  }

  services.flushPendingInputs();
  refreshPromptPanel(state, elements, services);

  const requestId = state.aiRecipe.requestId + 1;
  const promptSnapshot = elements.output.value;
  state.aiRecipe = {
    status: "loading",
    activeSurface: surface,
    recipe: "",
    model: "",
    usage: null,
    errorMessage: "",
    promptSnapshot,
    requestId,
  };
  renderAiRecipePanel(state, elements);
  focusAiRecipeStatus(elements, surface);

  const result = await generateRecipe(promptSnapshot);
  if (state.aiRecipe.requestId !== requestId) {
    return;
  }

  if (result.ok) {
    state.aiRecipe = {
      status: "success",
      activeSurface: surface,
      recipe: result.recipe,
      model: result.model,
      usage: result.usage,
      errorMessage: "",
      promptSnapshot,
      requestId,
    };
  } else {
    state.aiRecipe = {
      status: "error",
      activeSurface: surface,
      recipe: "",
      model: "",
      usage: null,
      errorMessage: FALLBACK_MESSAGE,
      promptSnapshot,
      requestId,
    };
  }

  renderAiRecipePanel(state, elements);
}
