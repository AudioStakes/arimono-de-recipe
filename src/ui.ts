import { renderAiRecipePanel, resetAiRecipeForInputChange } from "./ai-recipe-panel";
import type { AppElements } from "./app-elements";
import { bindAppEvents } from "./app-events";
import { getCookTimeValue, updateCookTimeDisplay } from "./combo-field";
import { type ComboRegistry, createComboRegistry } from "./combo-registry";
import { createPromptDataReaderFromInputs } from "./conditions";
import {
  advancedConditionOrder,
  combos,
  cookTimeOptions,
  materialUsageOptions,
  recipeCountOptions,
  requestIntentOptions,
  servingGroups,
  servingsModeOptions,
} from "./data";
import { icon } from "./icons";
import type { PromptPanelServices } from "./output-panel";
import {
  markUserHasInput as markUserHasInputPanel,
  refreshPromptPanel as refreshPromptPanelPanel,
} from "./output-panel";
import {
  createInitialRecipeDecisionState,
  USE_UP_AMOUNT_REQUIRED_MESSAGE,
  validateMaterialRequestAmounts,
} from "./recipe-decision";
import { getServingsMode, getServingsValue, updateServingSteppers } from "./serving-controls";
import type {
  AppState,
  ComboConfig,
  ComboId,
  MaterialRequest,
  MaterialUsage,
  RecipeCount,
  RequestIntent,
  UseUpAmountMode,
} from "./types";

type RadioOption<T extends string> = Readonly<{ value: T; label: string }>;

const createInitialState = (): AppState => {
  return {
    hasUserInput: false,
    inlineVisible: false,
    nearBottom: false,
    ticking: false,
    mobileSheetOpen: false,
    materialRequests: [],
    recipeDecision: createInitialRecipeDecisionState(),
    aiRecipe: {
      status: "idle",
      activeSurface: "desktop",
      request: null,
      candidates: null,
      selectedCandidateId: "",
      cookingCandidateId: "",
      cookingTab: "materials",
      model: "",
      usage: null,
      errorMessage: "",
      requestId: 0,
    },
  };
};

const queryElement = <T extends Element>(selector: string, root: ParentNode = document): T => {
  const element = root.querySelector<T>(selector);
  if (!element) throw new Error(`Element not found: ${selector}`);
  return element;
};

const queryAllElements = <T extends Element>(
  selector: string,
  root: ParentNode = document,
): T[] => [...root.querySelectorAll<T>(selector)];

const queryMaybeElement = <T extends Element>(
  selector: string,
  root: ParentNode = document,
): T | null => root.querySelector<T>(selector);

const fieldLabelHtml = (text: string, iconName: ComboConfig["icon"]): string =>
  `<span class="field-icon" aria-hidden="true">${icon(iconName)}</span>${text}`;

let outputPanelServices: PromptPanelServices | null = null;
let materialRequestCounter = 0;

function createMaterialRequest(name: string): MaterialRequest {
  let id: string;
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    id = crypto.randomUUID();
  } else {
    materialRequestCounter += 1;
    id = `material-request-${materialRequestCounter}`;
  }

  return {
    id,
    name,
    usage: "auto",
    useUpAmountMode: "as-written",
    useUpAmount: "",
  };
}

function renderRadioOptions<T extends string>(
  name: string,
  options: readonly { value: T; label: string }[],
  defaultValue: T,
  className = "choice-grid",
): string {
  return `
    <div class="${className}">
      ${options
        .map(
          ({ value, label }) => `
            <label class="choice-option">
              <input type="radio" name="${name}" value="${value}"${value === defaultValue ? " checked" : ""} />
              <span>${label}</span>
            </label>
          `,
        )
        .join("")}
    </div>
  `;
}

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function readCheckedValue<T extends string>(
  name: string,
  options: readonly RadioOption<T>[],
  fallback: T,
): T {
  const checked = queryMaybeElement<HTMLInputElement>(`input[name="${name}"]:checked`);
  const value = checked?.value;
  return options.some((option) => option.value === value) ? (value as T) : fallback;
}

function getRequestIntentValue(): RequestIntent {
  return readCheckedValue<RequestIntent>("requestIntent", requestIntentOptions, "auto");
}

function getRecipeCountValue(): RecipeCount {
  return readCheckedValue<RecipeCount>("recipeCount", recipeCountOptions, "auto");
}

function getEffectiveRecipeCountValue(): RecipeCount {
  const recipeCount = getRecipeCountValue();
  return getRequestIntentValue() === "pairing" && recipeCount === "auto" ? "one" : recipeCount;
}

function isMaterialUsage(value: string | undefined): value is MaterialUsage {
  return materialUsageOptions.some((option) => option.value === value);
}

function isLikelyEditedMaterialName(previousName: string, nextName: string): boolean {
  return (
    previousName.length > 0 &&
    nextName.startsWith(previousName) &&
    nextName.slice(previousName.length).trim().length > 0
  );
}

function syncMaterialRequests(state: AppState, materialNames: string[]): void {
  const usedRequestIds = new Set<string>();
  const previousRequests = state.materialRequests;

  state.materialRequests = materialNames.map((name, index) => {
    const exactMatch = previousRequests.find(
      (request) => request.name === name && !usedRequestIds.has(request.id),
    );
    const sameIndexMatch = previousRequests[index];
    const editedMatch =
      sameIndexMatch && isLikelyEditedMaterialName(sameIndexMatch.name, name)
        ? sameIndexMatch
        : undefined;
    const request = exactMatch ?? editedMatch ?? createMaterialRequest(name);

    usedRequestIds.add(request.id);
    return {
      ...request,
      name,
    };
  });
}

function updateMaterialRequest(
  state: AppState,
  requestId: string,
  updates: Partial<Pick<MaterialRequest, "usage" | "useUpAmountMode" | "useUpAmount">>,
): void {
  state.materialRequests = state.materialRequests.map((request) =>
    request.id === requestId ? { ...request, ...updates } : request,
  );
}

function readMaterialRequestControls(state: AppState): void {
  for (const request of state.materialRequests) {
    const usageValue = queryMaybeElement<HTMLInputElement>(
      `input[name="materialUsage-${CSS.escape(request.id)}"]:checked`,
    )?.value;
    const useUpAmount =
      queryMaybeElement<HTMLInputElement>(`[data-material-amount-for="${CSS.escape(request.id)}"]`)
        ?.value ?? request.useUpAmount;
    const useUpAmountMode: UseUpAmountMode = useUpAmount.trim() ? "custom" : "as-written";

    updateMaterialRequest(state, request.id, {
      ...(isMaterialUsage(usageValue) ? { usage: usageValue } : {}),
      useUpAmountMode,
      useUpAmount,
    });
  }
}

function getMaterialRequestErrors(state: AppState): Map<string, string> {
  return new Map(
    validateMaterialRequestAmounts(state.materialRequests).map((error) => [
      error.requestId,
      error.message,
    ]),
  );
}

function syncMaterialRequestValidationState(state: AppState): void {
  const errors = getMaterialRequestErrors(state);
  for (const request of state.materialRequests) {
    const input = queryMaybeElement<HTMLInputElement>(
      `[data-material-amount-for="${CSS.escape(request.id)}"]`,
    );
    const error = queryMaybeElement<HTMLElement>(
      `[data-material-amount-error-for="${CSS.escape(request.id)}"]`,
    );
    const message = errors.get(request.id) ?? "";

    if (input) {
      input.required = request.usage === "use-up";
      if (message) {
        input.setAttribute("aria-invalid", "true");
      } else {
        input.removeAttribute("aria-invalid");
      }
    }

    if (error) {
      error.hidden = !message;
      error.textContent = message;
      if (message) {
        error.setAttribute("role", "alert");
      } else {
        error.removeAttribute("role");
      }
    }
  }
}

function validateMaterialRequestPanel(state: AppState): boolean {
  readMaterialRequestControls(state);
  const errors = validateMaterialRequestAmounts(state.materialRequests);
  renderMaterialUsePanel(state);
  syncMaterialRequestValidationState(state);

  const firstError = errors[0];
  if (!firstError) {
    return true;
  }

  queryMaybeElement<HTMLInputElement>(
    `[data-material-amount-for="${CSS.escape(firstError.requestId)}"]`,
  )?.focus();
  return false;
}

function renderMaterialUsePanel(state: AppState): void {
  const panel = queryMaybeElement<HTMLElement>("#materialUsePanel");
  if (!panel) return;

  panel.hidden = false;

  if (state.materialRequests.length === 0) {
    panel.innerHTML =
      '<p class="field-hint">先に「家にある食材・材料」を追加すると、材料ごとの使い方を選べます。</p>';
    return;
  }

  const errors = getMaterialRequestErrors(state);

  panel.innerHTML = `
    <p class="field-hint">必要な材料だけ「必ず使う」または「使い切る」を選びます。量はどの使い方でも入力できます。</p>
    <div class="material-request-list">
      ${state.materialRequests
        .map((request) => {
          const amountLabel = request.usage === "use-up" ? "量（必須）" : "量（任意）";
          const amountId = `materialAmount-${request.id}`;
          const errorId = `materialAmountError-${request.id}`;
          const errorMessage = errors.get(request.id) ?? "";
          const invalidAttributes = errorMessage ? ' aria-invalid="true"' : "";
          const describedBy = errorMessage ? ` aria-describedby="${errorId}"` : "";

          return `
            <fieldset class="material-request-row" data-material-request-id="${request.id}" data-testid="material-card-${request.id}">
              <legend class="material-request-name">${escapeHtml(request.name)}</legend>
              <button
                class="material-request-remove"
                type="button"
                data-remove-material="${escapeHtml(request.name)}"
                aria-label="${escapeHtml(request.name)}を材料から削除"
              >削除</button>
              <div class="material-request-controls">
              ${renderRadioOptions(
                `materialUsage-${request.id}`,
                materialUsageOptions,
                request.usage,
                "segmented-control",
              )}
                <label class="text-input-label material-amount-field underlined-field" for="${amountId}">
                  <span>${amountLabel}</span>
                  <input
                    id="${amountId}"
                    class="material-amount-input"
                    type="text"
                    value="${escapeHtml(request.useUpAmount)}"
                    data-material-amount-for="${request.id}"
                    data-testid="material-amount-${request.id}"
                    placeholder="例: 150g、1/2個"
                    autocomplete="off"
                    ${request.usage === "use-up" ? "required" : ""}
                    aria-errormessage="${errorId}"
                    ${describedBy}
                    ${invalidAttributes}
                  />
                </label>
                <p
                  id="${errorId}"
                  class="field-error material-amount-error"
                  data-material-amount-error-for="${request.id}"
                  data-testid="material-use-up-error-${request.id}"
                  ${errorMessage ? 'role="alert"' : "hidden"}
                >${escapeHtml(errorMessage || USE_UP_AMOUNT_REQUIRED_MESSAGE)}</p>
              </div>
            </fieldset>
          `;
        })
        .join("")}
    </div>
  `;
}

function setCollapsibleStateForField(field: HTMLElement, expanded: boolean): void {
  const button = field.querySelector<HTMLButtonElement>(".field-toggle");
  if (!button) return;

  button.setAttribute("aria-expanded", String(expanded));
  const chevron = button.querySelector<HTMLElement>(".field-toggle-chevron");
  if (chevron) {
    chevron.textContent = expanded ? "⌃" : "⌄";
  }

  const panelId = button.getAttribute("aria-controls");
  const panel = panelId ? document.getElementById(panelId) : null;
  if (panel) {
    panel.hidden = !expanded;
    panel.setAttribute("data-state", expanded ? "open" : "closed");
  }

  field.classList.toggle("is-open", expanded);
  field.setAttribute("data-state", expanded ? "open" : "closed");
}

function syncIntentSections(): void {
  const intent = getRequestIntentValue();
  const targetDishField = queryMaybeElement<HTMLElement>("#targetDishField");
  const pairingField = queryMaybeElement<HTMLElement>("#pairingTargetsField");
  const recipeCountField = queryMaybeElement<HTMLElement>('[data-collapsible="recipeCount"]');
  const recipeRoleField = queryMaybeElement<HTMLElement>("#recipeRolesField");

  if (targetDishField) {
    targetDishField.hidden = intent !== "target-dish";
  }

  if (pairingField) {
    pairingField.hidden = intent !== "pairing";
  }

  if (recipeCountField) {
    recipeCountField.hidden = intent === "target-dish";
    if (intent === "pairing") {
      setCollapsibleStateForField(recipeCountField, true);
    } else if (intent === "target-dish") {
      setCollapsibleStateForField(recipeCountField, false);
    }
  }

  const recipeCount = getEffectiveRecipeCountValue();
  if (recipeRoleField) {
    recipeRoleField.hidden = intent === "target-dish" || recipeCount === "auto";
  }
}

function syncRecipeRoleMode(comboRegistry: ComboRegistry): void {
  comboRegistry.setSingleMode("recipeRoles", getEffectiveRecipeCountValue() === "one");
}

function syncServingModeVisibility(): void {
  const customPanel = queryMaybeElement<HTMLElement>("#customServingsPanel");
  if (customPanel) {
    customPanel.hidden = getServingsMode() !== "custom";
  }
}

function syncRecipeRoleOrder(): void {
  const intent = getRequestIntentValue();
  const combo = queryMaybeElement<HTMLElement>('[data-combo="recipeRoles"]');
  if (combo) {
    (combo.dataset as DOMStringMap & { roleOrder?: string }).roleOrder =
      intent === "pairing" ? "pairing" : "default";
  }
  const input = queryMaybeElement<HTMLInputElement>("#recipeRolesInput");
  if (input) {
    input.placeholder = intent === "pairing" ? "例: 副菜・一品" : "例: 主菜・しっかり";
  }
}

export function initializeApp(root: HTMLElement): void {
  document.title = "ありもの de レシピ";
  root.setAttribute("data-testid", "app-shell");
  root.innerHTML = renderAppShell();

  const state = createInitialState();
  const elements = getAppElements();
  renderFields();
  const comboRegistry = createComboRegistry(elements.form);
  comboRegistry.bind(elements.form);
  outputPanelServices = createOutputPanelServices(state, elements, comboRegistry);
  const outputPanel = outputPanelServices;
  if (!outputPanel) {
    throw new Error("Output panel was not initialized.");
  }

  bindAppEvents(state, elements, outputPanel);
  updateCookTimeDisplay();
  updateServingSteppers();
  refreshPromptPanelPanel(state, elements, outputPanel);
  renderAiRecipePanel(state, elements);
}

function renderAppShell(): string {
  return `
    <header>
      <h1 class="site-title">
        <span class="brand-row">
          <span class="brand-fridge" aria-hidden="true">
            <span class="brand-fridge-item"></span>
            <span class="brand-fridge-item"></span>
            <span class="brand-fridge-item"></span>
            <span class="brand-fridge-item"></span>
          </span>
          <span class="brand-title-text">ありもの de レシピ</span>
        </span>
      </h1>
      <p class="lead" id="appLead">冷蔵庫にある食材を入れて、今日作る料理候補をすぐ見つけます。</p>
    </header>
    <div class="app-layout">
      <form class="form" id="recipeForm" data-testid="recipe-form" novalidate aria-describedby="appLead">
        <div id="basicFields" data-testid="basic-fields"></div>
        <section class="prompt-section" aria-label="料理候補と依頼文">
        <div class="prompt-heading">
          <h2 id="promptHeading">今日の料理候補</h2>
          <p id="promptDescription">家にある材料をもとに候補を見ます。依頼文コピーは別のAIで使うための補助です。</p>
        </div>
        <div class="prompt-action-grid" aria-label="実行方法">
          <article class="prompt-action-card">
            <div class="prompt-action-copy">
              <h3>今日の候補を見る</h3>
              <p>家にある食材をもとに、短い料理候補を3つ表示します。</p>
            </div>
            <button
              id="generateRecipe"
              class="action-button button-primary"
              type="button"
              data-testid="generate-recipe"
            >
              <span class="action-button-icon" aria-hidden="true" data-icon="zap"></span>
              <span class="action-button-label">今日の候補を見る</span>
            </button>
          </article>
          <article class="prompt-action-card">
            <div class="prompt-action-copy">
              <h3>依頼文をコピー</h3>
              <p>ChatGPT、Claude、Geminiなど、普段使っているAIに貼り付けて使えます。</p>
            </div>
            <button
              id="copyPrompt"
              class="copy-icon-button copy-button action-button"
              type="button"
              aria-label="AI向けレシピ依頼文をコピー"
              title="AI向けレシピ依頼文をコピー"
              data-testid="copy-prompt"
              data-default-label="AI向けレシピ依頼文をコピー"
              data-success-label="コピーしました。普段使っているAIに貼り付けてください。"
            >
              <span class="copy-button-icon" aria-hidden="true" data-icon="copy"></span>
              <span class="copy-label">AI向けレシピ依頼文をコピー</span>
              <span class="copy-status" aria-live="polite"></span>
            </button>
          </article>
        </div>
        <div
          id="aiRecipePanel"
          class="ai-recipe-panel"
          data-testid="ai-recipe-panel"
          data-state="idle"
          hidden
        >
        </div>
        <details class="prompt-preview-details">
          <summary>AI向け依頼文を確認する</summary>
          <div class="output-shell">
            <textarea
              id="output"
              class="output"
              data-testid="prompt-output"
              aria-labelledby="promptHeading"
              aria-describedby="promptDescription"
              readonly
            ></textarea>
          </div>
        </details>
      </section>
        <div id="advancedFields" class="advanced-fields" data-testid="advanced-fields"></div>
        <div id="conditionChips" class="chips secondary-condition-chips" data-testid="condition-chips"></div>
      </form>
    </div>
    <div class="bottom-sheet-backdrop" id="bottomSheetBackdrop" hidden></div>
    <div class="bottom-actions" id="bottomActions" data-state="closed">
      <div class="bottom-actions-inner" id="bottomActionsInner">
        <button
          id="sheetExpand"
          class="sheet-corner-expand-button"
          type="button"
          aria-expanded="false"
          aria-controls="mobilePromptPanel"
          aria-label="レシピ依頼文全文を表示"
        >
          ⌃
        </button>
        <div id="stickyChips" class="sticky-chips" data-testid="sticky-condition-chips"></div>
        <div class="sheet-actions">
          <button
            id="generateRecipeMobile"
            class="action-button button-primary"
            type="button"
            data-testid="generate-recipe-mobile"
          >
            <span class="action-button-icon" aria-hidden="true" data-icon="zap"></span>
            <span class="action-button-label">今日の候補を見る</span>
          </button>
          <button
            id="sheetToggle"
            class="sheet-toggle-button"
            type="button"
            aria-expanded="false"
            aria-controls="mobilePromptPanel"
          >
            <span>レシピ依頼文を確認する</span>
          </button>
          <button
            id="copyPromptSticky"
            class="copy-icon-button copy-request-button"
            type="button"
            aria-label="AI向けレシピ依頼文をコピー"
            title="AI向けレシピ依頼文をコピー"
            data-testid="copy-prompt-sticky"
            data-default-label="AI向けレシピ依頼文をコピー"
            data-success-label="コピーしました。普段使っているAIに貼り付けてください。"
          >
            <span class="copy-button-icon" aria-hidden="true" data-icon="copy"></span>
            <span class="copy-label">AI向けレシピ依頼文をコピー</span>
            <span class="copy-status" aria-live="polite"></span>
          </button>
        </div>
        <div
          id="mobilePromptPanel"
          class="mobile-prompt-panel"
          data-testid="mobile-prompt-panel"
          data-state="closed"
          role="region"
          aria-labelledby="mobilePromptHeading"
          aria-hidden="true"
          tabindex="-1"
        >
          <div class="mobile-prompt-head">
            <h2 id="mobilePromptHeading">AIに渡す依頼文</h2>
            <button id="sheetClose" class="sheet-close" type="button" aria-label="閉じる">×</button>
          </div>
          <div class="mobile-sheet-action-grid" aria-label="実行方法">
            <article class="mobile-action-card">
              <p>普段使っているAIへ貼り付け</p>
              <button
                id="copyPromptMobile"
                class="copy-icon-button copy-button action-button"
                type="button"
                aria-label="AI向けレシピ依頼文をコピー"
                title="AI向けレシピ依頼文をコピー"
                data-testid="copy-prompt-mobile-panel"
                data-default-label="AI向けレシピ依頼文をコピー"
                data-success-label="コピーしました。普段使っているAIに貼り付けてください。"
              >
                <span class="copy-button-icon" aria-hidden="true" data-icon="copy"></span>
                <span class="copy-label">AI向けレシピ依頼文をコピー</span>
                <span class="copy-status" aria-live="polite"></span>
              </button>
            </article>
          </div>
          <div
            id="aiRecipePanelMobile"
            class="ai-recipe-panel mobile-ai-recipe-panel"
            data-testid="mobile-ai-recipe-panel"
            data-state="idle"
            hidden
          >
          </div>
          <div class="output-shell mobile-output-shell">
            <textarea
              id="mobileOutput"
              class="output mobile-output"
              data-testid="mobile-prompt-output"
              aria-labelledby="mobilePromptHeading"
              readonly
            ></textarea>
          </div>
        </div>
      </div>
    </div>
  `;
}

function getAppElements(): AppElements {
  return {
    form: queryElement("#recipeForm"),
    output: queryElement("#output") as HTMLTextAreaElement,
    mobileOutput: queryElement("#mobileOutput") as HTMLTextAreaElement,
    bottom: queryElement("#bottomActions") as HTMLElement,
    bottomInner: queryElement("#bottomActionsInner") as HTMLElement,
    bottomBackdrop: queryElement("#bottomSheetBackdrop") as HTMLElement,
    sheetToggle: queryElement("#sheetToggle") as HTMLButtonElement,
    sheetExpand: queryElement("#sheetExpand") as HTMLButtonElement,
    sheetClose: queryElement("#sheetClose") as HTMLButtonElement,
    chips: queryElement("#conditionChips") as HTMLElement,
    stickyChips: queryElement("#stickyChips") as HTMLElement,
    generateRecipe: queryElement("#generateRecipe") as HTMLButtonElement,
    generateRecipeMobile: queryElement("#generateRecipeMobile") as HTMLButtonElement,
    copyPromptSticky: queryElement("#copyPromptSticky") as HTMLButtonElement,
    copyPromptMobile: queryElement("#copyPromptMobile") as HTMLButtonElement,
    aiRecipePanel: queryElement("#aiRecipePanel") as HTMLElement,
    aiRecipePanelMobile: queryElement("#aiRecipePanelMobile") as HTMLElement,
  };
}

function renderFields(): void {
  queryElement("#basicFields").innerHTML = [
    renderComboField(getCombo("materials")),
    renderMaterialUseField(),
    renderServingsField(),
  ].join("");

  queryElement("#advancedFields").innerHTML = [
    renderRequestIntentField(),
    `<div id="targetDishField" hidden>${renderComboField(getCombo("targetDish"), "targetDishHint")}<p id="targetDishHint" class="field-hint">作りたい料理名を自由に入力できます。候補は入力補助です。</p></div>`,
    `<div id="pairingTargetsField" hidden>${renderComboField(getCombo("pairingTargets"))}</div>`,
    renderRecipeCountField(),
    renderCollapsibleComboField(getCombo("cookingTools")),
    renderCollapsibleCookTimeField(),
    ...advancedConditionOrder.map((id) => renderCollapsibleComboField(getCombo(id))),
    renderCollapsibleNotesField(),
  ].join("");

  queryAllElements<HTMLElement>("[data-icon]").forEach((element) => {
    const iconName = (element.dataset as DOMStringMap & { icon?: ComboConfig["icon"] }).icon;
    if (iconName) element.innerHTML = icon(iconName as ComboConfig["icon"]);
  });
}

function renderRequestIntentField(): string {
  return `
    <fieldset class="field fieldset intent-field" data-testid="recipe-item-requestIntent">
      <legend class="field-title">${fieldLabelHtml("今回やりたいこと", "heart")}</legend>
      ${renderRadioOptions("requestIntent", requestIntentOptions, "auto")}
    </fieldset>
  `;
}

function renderMaterialUseField(): string {
  return `
    <fieldset class="field fieldset" data-testid="recipe-item-materialUse">
      <legend class="field-title">${fieldLabelHtml("材料の使い方", "leaf")}</legend>
      <div id="materialUsePanel" class="material-use-panel" data-testid="material-use-panel"></div>
    </fieldset>
  `;
}

function renderRecipeCountField(): string {
  return renderCollapsibleField(
    "recipeCount",
    "作りたい品数",
    "bowl",
    `
      <fieldset class="panel-fieldset" aria-label="作りたい品数">
        ${renderRadioOptions("recipeCount", recipeCountOptions, "auto")}
      </fieldset>
      <div id="recipeRolesField" class="recipe-role-subfield" data-testid="recipe-item-recipeRoles" hidden>
        <label class="subfield-label" for="recipeRolesInput">料理の役割・量感</label>
        ${renderComboFieldControl(getCombo("recipeRoles"))}
      </div>
    `,
  );
}

function renderComboField(combo: ComboConfig, describedBy = ""): string {
  return `
    <div class="field" data-testid="recipe-item-${combo.id}">
      <label class="field-title" for="${combo.id}Input">${fieldLabelHtml(combo.label, combo.icon)}</label>
      ${renderComboFieldControl(combo, describedBy)}
    </div>
  `;
}

function renderComboFieldControl(combo: ComboConfig, describedBy = ""): string {
  const inputId = `${combo.id}Input`;
  const suggestionsId = `${combo.id}Suggestions`;
  const describedByAttribute = describedBy ? ` aria-describedby="${describedBy}"` : "";
  return `
    <div class="combo" data-combo="${combo.id}" data-testid="combo-${combo.id}">
      <div class="floating-chip-row" aria-live="polite"></div>
      <div class="underlined-field">
        <input
          id="${inputId}"
          class="combo-input"
          data-testid="combo-input-${combo.id}"
          type="text"
          placeholder="${combo.placeholder}"
          autocomplete="off"
          autocapitalize="off"
          spellcheck="false"
          enterkeyhint="done"
          aria-label="${combo.label}"
          role="combobox"
          aria-autocomplete="list"
          aria-controls="${suggestionsId}"
          aria-expanded="false"
          ${describedByAttribute}
        />
        <button class="combo-picker" data-testid="combo-picker-${combo.id}" type="button" aria-label="${combo.label}の候補を表示" aria-controls="${suggestionsId}"></button>
        <div id="${suggestionsId}" class="suggestions" data-testid="combo-suggestions-${combo.id}" role="listbox" aria-label="${combo.label}の候補" aria-hidden="true"></div>
      </div>
    </div>
  `;
}

function renderCollapsibleComboField(combo: ComboConfig): string {
  return renderCollapsibleField(combo.id, combo.label, combo.icon, renderComboFieldControl(combo));
}

function renderCollapsibleCookTimeField(): string {
  return renderCollapsibleField(
    "cookTime",
    "調理時間",
    "clock",
    `
      <div class="range-card">
        <div class="range-meta"><span>指定なし</span><span id="cookTimeLabel" class="range-value">指定なし</span><span>60分以内</span></div>
        <input id="cookTimeRange" data-testid="cook-time-range" type="range" min="0" max="${cookTimeOptions.length - 1}" step="1" value="0" aria-label="調理時間" />
      </div>
    `,
  );
}

function renderCollapsibleNotesField(): string {
  return renderCollapsibleField(
    "supplementalNotes",
    "その他の要望",
    "note",
    `
      <div class="textarea-field">
        <textarea id="supplementalNotes" data-testid="supplemental-notes" aria-label="その他の要望" placeholder="例: 子ども用に辛くしない。冷蔵庫で3日間保存したい。"></textarea>
      </div>
    `,
  );
}

function renderCollapsibleField(
  id: string,
  label: string,
  iconName: ComboConfig["icon"],
  body: string,
): string {
  const panelId = `${id}Panel`;
  return `
    <section class="field field-collapsible" data-collapsible="${id}" data-testid="recipe-item-${id}" data-state="closed">
      <button
        class="field-toggle"
        type="button"
        data-testid="recipe-item-toggle-${id}"
        aria-expanded="false"
        aria-controls="${panelId}"
      >
        <span class="field-toggle-main">
          <span class="field-icon" aria-hidden="true">${icon(iconName)}</span>
          <span class="field-toggle-label">${label}</span>
        </span>
        <span class="field-toggle-chevron" aria-hidden="true">⌄</span>
      </button>
      <div id="${panelId}" class="field-panel" data-testid="recipe-item-panel-${id}" data-state="closed" hidden>
        ${body}
      </div>
    </section>
  `;
}

function renderServingsField(): string {
  const controls = servingGroups
    .map(
      ({ id, label, icon: iconName }) => `
        <div class="serving-card">
          <div class="serving-label" id="${id}Label" data-testid="serving-label-${id}"><span aria-hidden="true">${icon(iconName)}</span>${label}</div>
          <div class="serving-stepper" data-serving-id="${id}" data-testid="serving-stepper-${id}" data-count="0" aria-labelledby="${id}Label">
            <button class="serving-adjust serving-minus" data-testid="serving-minus-${id}" type="button" aria-label="${label}を1人減らす">−</button>
            <span class="serving-count" data-testid="serving-count-${id}" aria-live="polite">0人</span>
            <button class="serving-adjust serving-plus" data-testid="serving-plus-${id}" type="button" aria-label="${label}を1人増やす">+</button>
          </div>
        </div>
      `,
    )
    .join("");

  return `
    <fieldset class="field fieldset">
      <legend class="field-title">${fieldLabelHtml("人数・分量", "users")}</legend>
      ${renderRadioOptions("servingsMode", servingsModeOptions, "unspecified")}
      <div id="customServingsPanel" class="custom-servings-panel" data-testid="custom-servings-panel" hidden>
        <div class="serving-grid" aria-label="詳しい人数">${controls}</div>
      </div>
    </fieldset>
  `;
}

function getCombo(id: ComboId): ComboConfig {
  const combo = combos.find((item) => item.id === id);
  if (!combo) throw new Error(`Combo not found: ${id}`);
  return combo;
}

function createOutputPanelServices(
  state: AppState,
  elements: ReturnType<typeof getAppElements>,
  comboRegistry: ComboRegistry,
): PromptPanelServices {
  const syncDynamicFormState = (): void => {
    const activeElement = document.activeElement;
    const amountInputActive = Boolean(
      activeElement instanceof HTMLElement && activeElement.matches("[data-material-amount-for]"),
    );
    readMaterialRequestControls(state);
    syncMaterialRequests(state, comboRegistry.getValues("materials"));
    syncMaterialRequestValidationState(state);
    if (!amountInputActive) {
      renderMaterialUsePanel(state);
    }
    syncIntentSections();
    syncServingModeVisibility();
    syncRecipeRoleMode(comboRegistry);
    syncRecipeRoleOrder();
    updateCookTimeDisplay();
    updateServingSteppers();
  };

  const notifyOutputChange = (): void => {
    if (!outputPanelServices) return;
    syncDynamicFormState();
    resetAiRecipeForInputChange(state, elements);
    markUserHasInputPanel(state, elements, outputPanelServices);
  };

  const conditionReader = createPromptDataReaderFromInputs({
    comboRegistry,
    getRequestIntent: getRequestIntentValue,
    getMaterialUseMode: () => "specified",
    getMaterialRequests: () => state.materialRequests,
    getServingsText: getServingsValue,
    getServingsMode,
    getRecipeCount: getRecipeCountValue,
    getCookTimeText: getCookTimeValue,
    getSupplementalNotes: () =>
      queryMaybeElement<HTMLTextAreaElement>("#supplementalNotes")?.value.trim() ?? "",
  });

  comboRegistry.setOnChange(notifyOutputChange);
  syncDynamicFormState();

  return {
    readConditions: () => conditionReader.read(),
    flushPendingInputs: () => {
      comboRegistry.flushPendingInputs();
    },
    setHasUserInput: (value) => {
      state.hasUserInput = value;
    },
    setNearBottom: (value) => {
      state.nearBottom = value;
    },
    removeComboValue: (group, value) => {
      comboRegistry.removeValue(group, value);
    },
    clearCombo: (group) => {
      comboRegistry.clear(group);
    },
    clearCookTime: () => {
      const range = queryMaybeElement<HTMLInputElement>("#cookTimeRange");
      if (range) range.value = "0";
      updateCookTimeDisplay();
    },
    clearSupplementalNotes: () => {
      const textarea = queryMaybeElement<HTMLTextAreaElement>("#supplementalNotes");
      if (textarea) textarea.value = "";
    },
    validateBeforeAiRecipe: () => validateMaterialRequestPanel(state),
    onChange: notifyOutputChange,
  };
}
