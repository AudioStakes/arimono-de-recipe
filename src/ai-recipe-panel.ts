import { generateRecipe } from "./ai-recipe-client";
import { buildAiRecipeCandidateRequest } from "./ai-recipe-request";
import type { AppElements } from "./app-elements";
import { type PromptPanelServices, refreshPromptPanel } from "./output-panel";
import { renderRecipeCandidateList, renderRecipeCookingView } from "./recipe-candidate-list";
import type {
  AiRecipeCandidateRequest,
  AiRecipeCookingTab,
  AiRecipeMaterialInput,
  AiRecipeSurface,
  AppState,
} from "./types";

const mobileAiRecipeTestIds = {
  "ai-recipe-heading": "mobile-ai-recipe-heading",
  "ai-recipe-status": "mobile-ai-recipe-status",
  "ai-recipe-content": "mobile-ai-recipe-content",
  "ai-recipe-error": "mobile-ai-recipe-error",
  "ai-recipe-retry": "mobile-ai-recipe-retry",
  "ai-recipe-adjust-input": "mobile-ai-recipe-adjust-input",
} as const;

type AiRecipeTestId = keyof typeof mobileAiRecipeTestIds;

const FALLBACK_MESSAGE =
  "AIへの依頼に失敗しました。AI向けレシピ依頼文をコピーして、普段使っているAIに貼り付けてください。";
const EMPTY_MATERIALS_MESSAGE =
  "まずは家にある食材を入れてください。AI向けレシピ依頼文のコピーは使えます。";

function setGenerateButtonState(elements: AppElements, loading: boolean): void {
  for (const button of [elements.generateRecipe, elements.generateRecipeMobile]) {
    button.disabled = loading;
    button.setAttribute("aria-busy", String(loading));
    const label = button.querySelector<HTMLElement>(".action-button-label");
    if (label) {
      label.textContent = loading ? "候補を探しています" : "今日の候補を見る";
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

function formatMaterialConstraint(material: AiRecipeMaterialInput): string {
  return material.amount ? `${material.name}（${material.amount}）` : material.name;
}

function getLoadingStatusText(request: AiRecipeCandidateRequest | null): string {
  const useUpMaterials =
    request?.materials
      .filter((material) => material.usage === "use_up")
      .map((material) => formatMaterialConstraint(material)) ?? [];
  const requiredMaterials =
    request?.materials
      .filter((material) => material.usage === "required")
      .map((material) => formatMaterialConstraint(material)) ?? [];
  const constraints = [
    useUpMaterials.length ? `使い切る材料: ${useUpMaterials.join("、")}` : "",
    requiredMaterials.length ? `必ず使う材料: ${requiredMaterials.join("、")}` : "",
  ].filter(Boolean);

  if (constraints.length === 0) {
    return "今日の候補を探しています。";
  }

  return `今日の候補を探しています。${constraints.join(" / ")}を反映します。`;
}

function focusMaterialInput(elements: AppElements, surface: AiRecipeSurface): void {
  const input = document.querySelector<HTMLElement>('[data-testid="combo-input-materials"]');
  if (!input) {
    return;
  }

  if (surface === "mobile" && !elements.bottomBackdrop.hidden) {
    elements.sheetClose.click();
  }

  window.requestAnimationFrame(() => {
    input.scrollIntoView({ block: "center" });
    input.focus();
  });
}

function renderRecoveryButton(
  label: string,
  testId: string,
  className: string,
  onClick: () => void,
): HTMLButtonElement {
  const button = document.createElement("button");
  button.type = "button";
  button.className = className;
  button.setAttribute("data-testid", testId);
  button.textContent = label;
  button.addEventListener("click", onClick);
  return button;
}

function renderErrorActions(
  state: AppState,
  elements: AppElements,
  services: PromptPanelServices | undefined,
  surface: AiRecipeSurface,
): HTMLDivElement {
  const actions = document.createElement("div");
  actions.className = "ai-recipe-error-actions";
  const hasMaterialRequest = (state.aiRecipe.request?.materials.length ?? 0) > 0;

  if (hasMaterialRequest && services) {
    actions.appendChild(
      renderRecoveryButton(
        "もう一度候補を見る",
        getTestId(surface, "ai-recipe-retry"),
        "button-primary ai-recipe-retry-button",
        () => void createAiRecipe(state, elements, services, surface),
      ),
    );
  }

  actions.appendChild(
    renderRecoveryButton(
      "入力を見直す",
      getTestId(surface, "ai-recipe-adjust-input"),
      "button-secondary ai-recipe-adjust-button",
      () => focusMaterialInput(elements, surface),
    ),
  );

  return actions;
}

function renderAiRecipeSurface(
  state: AppState,
  elements: AppElements,
  surface: AiRecipeSurface,
  services?: PromptPanelServices,
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
      renderPanelHeading("AIの料理候補", surface),
      renderPanelParagraph(
        getLoadingStatusText(aiRecipe.request),
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
    const heading =
      aiRecipe.request?.materials.length === 0
        ? "材料を入力してください"
        : "候補を表示できませんでした";
    panel.replaceChildren(
      renderPanelHeading(heading, surface),
      message,
      renderErrorActions(state, elements, services, surface),
    );
    return;
  }

  const status = renderPanelParagraph(
    "AIの料理候補を表示しました。",
    "ai-recipe-status-text",
    getTestId(surface, "ai-recipe-status"),
    live ? "status" : "",
  );
  const content = document.createElement("div");
  content.className = "ai-recipe-content";
  content.setAttribute("data-testid", getTestId(surface, "ai-recipe-content"));

  if (aiRecipe.candidates) {
    const cookingCandidate = aiRecipe.candidates.items.find(
      (candidate) => candidate.id === aiRecipe.cookingCandidateId,
    );
    if (cookingCandidate) {
      content.appendChild(
        renderRecipeCookingView({
          surface,
          candidate: cookingCandidate,
          materialInputs: aiRecipe.request?.materials ?? [],
          activeTab: aiRecipe.cookingTab,
          onTabChange: (tab) => changeCookingTab(state, elements, tab, surface),
          onBack: () => returnToRecipeDetail(state, elements, surface),
        }),
      );
    } else {
      content.appendChild(
        renderRecipeCandidateList({
          surface,
          candidates: aiRecipe.candidates.items,
          materialInputs: aiRecipe.request?.materials ?? [],
          selectedCandidateId: aiRecipe.selectedCandidateId,
          onSelect: (candidateId) => selectRecipeCandidate(state, elements, candidateId, surface),
          onCook: (candidateId) => startCookingCandidate(state, elements, candidateId, surface),
          onBack: () => clearSelectedRecipeCandidate(state, elements, surface),
        }),
      );
    }
  }

  panel.replaceChildren(renderPanelHeading("AIの料理候補", surface), status, content);
}

export function renderAiRecipePanel(
  state: AppState,
  elements: AppElements,
  services?: PromptPanelServices,
): void {
  setGenerateButtonState(elements, state.aiRecipe.status === "loading");
  renderAiRecipeSurface(state, elements, "desktop", services);
  renderAiRecipeSurface(state, elements, "mobile", services);
}

function focusAiRecipeStatus(elements: AppElements, surface: AiRecipeSurface): void {
  const panel = getSurfacePanel(elements, surface);
  panel.querySelector<HTMLElement>('[role="status"], [role="alert"]')?.focus();
}

function focusRecipeCandidateDetail(elements: AppElements, surface: AiRecipeSurface): void {
  const panel = getSurfacePanel(elements, surface);
  const testId =
    surface === "mobile" ? "mobile-recipe-candidate-detail" : "recipe-candidate-detail";
  panel.querySelector<HTMLElement>(`[data-testid="${testId}"]`)?.focus();
}

function focusRecipeCandidateList(elements: AppElements, surface: AiRecipeSurface): void {
  const panel = getSurfacePanel(elements, surface);
  const testId = surface === "mobile" ? "mobile-recipe-candidate-list" : "recipe-candidate-list";
  panel.querySelector<HTMLElement>(`[data-testid="${testId}"]`)?.focus();
}

function focusRecipeCookingView(elements: AppElements, surface: AiRecipeSurface): void {
  const panel = getSurfacePanel(elements, surface);
  const testId = surface === "mobile" ? "mobile-recipe-cooking-view" : "recipe-cooking-view";
  panel.querySelector<HTMLElement>(`[data-testid="${testId}"]`)?.focus();
}

function focusRecipeCookingTab(
  elements: AppElements,
  surface: AiRecipeSurface,
  tab: AiRecipeCookingTab,
): void {
  const panel = getSurfacePanel(elements, surface);
  const testId =
    surface === "mobile" ? `mobile-recipe-cooking-tab-${tab}` : `recipe-cooking-tab-${tab}`;
  panel.querySelector<HTMLElement>(`[data-testid="${testId}"]`)?.focus();
}

function selectRecipeCandidate(
  state: AppState,
  elements: AppElements,
  candidateId: string,
  surface: AiRecipeSurface,
): void {
  state.aiRecipe = {
    ...state.aiRecipe,
    activeSurface: surface,
    selectedCandidateId: candidateId,
    cookingCandidateId: "",
    cookingTab: "materials",
  };
  renderAiRecipePanel(state, elements);
  focusRecipeCandidateDetail(elements, surface);
}

function startCookingCandidate(
  state: AppState,
  elements: AppElements,
  candidateId: string,
  surface: AiRecipeSurface,
): void {
  state.aiRecipe = {
    ...state.aiRecipe,
    activeSurface: surface,
    selectedCandidateId: candidateId,
    cookingCandidateId: candidateId,
    cookingTab: "materials",
  };
  renderAiRecipePanel(state, elements);
  focusRecipeCookingView(elements, surface);
}

function changeCookingTab(
  state: AppState,
  elements: AppElements,
  tab: AiRecipeCookingTab,
  surface: AiRecipeSurface,
): void {
  state.aiRecipe = {
    ...state.aiRecipe,
    activeSurface: surface,
    cookingTab: tab,
  };
  renderAiRecipePanel(state, elements);
  focusRecipeCookingTab(elements, surface, tab);
}

function returnToRecipeDetail(
  state: AppState,
  elements: AppElements,
  surface: AiRecipeSurface,
): void {
  state.aiRecipe = {
    ...state.aiRecipe,
    activeSurface: surface,
    cookingCandidateId: "",
  };
  renderAiRecipePanel(state, elements);
  focusRecipeCandidateDetail(elements, surface);
}

function clearSelectedRecipeCandidate(
  state: AppState,
  elements: AppElements,
  surface: AiRecipeSurface,
): void {
  state.aiRecipe = {
    ...state.aiRecipe,
    activeSurface: surface,
    selectedCandidateId: "",
    cookingCandidateId: "",
  };
  renderAiRecipePanel(state, elements);
  focusRecipeCandidateList(elements, surface);
}

export function resetAiRecipeForInputChange(state: AppState, elements: AppElements): void {
  if (state.aiRecipe.status === "idle") {
    return;
  }

  state.aiRecipe = {
    status: "idle",
    activeSurface: state.aiRecipe.activeSurface,
    request: null,
    candidates: null,
    selectedCandidateId: "",
    cookingCandidateId: "",
    cookingTab: "materials",
    model: "",
    usage: null,
    errorMessage: "",
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
  if (!services.validateBeforeAiRecipe()) {
    return;
  }

  const requestId = state.aiRecipe.requestId + 1;
  const request = buildAiRecipeCandidateRequest(services.readConditions());
  if (request.materials.length === 0) {
    state.aiRecipe = {
      status: "error",
      activeSurface: surface,
      request,
      candidates: null,
      selectedCandidateId: "",
      cookingCandidateId: "",
      cookingTab: "materials",
      model: "",
      usage: null,
      errorMessage: EMPTY_MATERIALS_MESSAGE,
      requestId,
    };
    renderAiRecipePanel(state, elements, services);
    focusAiRecipeStatus(elements, surface);
    return;
  }

  state.aiRecipe = {
    status: "loading",
    activeSurface: surface,
    request,
    candidates: null,
    selectedCandidateId: "",
    cookingCandidateId: "",
    cookingTab: "materials",
    model: "",
    usage: null,
    errorMessage: "",
    requestId,
  };
  renderAiRecipePanel(state, elements, services);
  focusAiRecipeStatus(elements, surface);

  const result = await generateRecipe(request);
  if (state.aiRecipe.requestId !== requestId) {
    return;
  }

  if (result.ok) {
    state.aiRecipe = {
      status: "success",
      activeSurface: surface,
      request,
      candidates: result.candidates,
      selectedCandidateId: "",
      cookingCandidateId: "",
      cookingTab: "materials",
      model: result.model,
      usage: result.usage,
      errorMessage: "",
      requestId,
    };
  } else {
    state.aiRecipe = {
      status: "error",
      activeSurface: surface,
      request,
      candidates: null,
      selectedCandidateId: "",
      cookingCandidateId: "",
      cookingTab: "materials",
      model: "",
      usage: null,
      errorMessage: FALLBACK_MESSAGE,
      requestId,
    };
  }

  renderAiRecipePanel(state, elements, services);
  focusAiRecipeStatus(elements, surface);
}
