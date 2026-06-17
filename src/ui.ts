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
  materialUseModeOptions,
  recipeCountOptions,
  requestIntentOptions,
  servingGroups,
  servingsModeOptions,
  useUpAmountModeOptions,
} from "./data";
import { icon } from "./icons";
import type { PromptPanelServices } from "./output-panel";
import {
  markUserHasInput as markUserHasInputPanel,
  refreshPromptPanel as refreshPromptPanelPanel,
} from "./output-panel";
import { getServingsMode, getServingsValue, updateServingSteppers } from "./serving-controls";
import type {
  AppState,
  ComboConfig,
  ComboId,
  MaterialRequest,
  MaterialUsage,
  MaterialUseMode,
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

function getMaterialUseModeValue(): MaterialUseMode {
  return readCheckedValue<MaterialUseMode>("materialUseMode", materialUseModeOptions, "auto");
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

function isUseUpAmountMode(value: string | undefined): value is UseUpAmountMode {
  return useUpAmountModeOptions.some((option) => option.value === value);
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
    const useUpAmountModeValue = queryMaybeElement<HTMLInputElement>(
      `input[name="useUpAmountMode-${CSS.escape(request.id)}"]:checked`,
    )?.value;
    const useUpAmount =
      queryMaybeElement<HTMLInputElement>(`[data-material-amount-for="${CSS.escape(request.id)}"]`)
        ?.value ?? request.useUpAmount;

    updateMaterialRequest(state, request.id, {
      ...(isMaterialUsage(usageValue) ? { usage: usageValue } : {}),
      ...(isUseUpAmountMode(useUpAmountModeValue) ? { useUpAmountMode: useUpAmountModeValue } : {}),
      useUpAmount,
    });
  }
}

function renderMaterialUsePanel(state: AppState): void {
  const panel = queryMaybeElement<HTMLElement>("#materialUsePanel");
  if (!panel) return;

  if (getMaterialUseModeValue() !== "specified") {
    panel.hidden = true;
    panel.innerHTML = "";
    return;
  }

  panel.hidden = false;

  if (state.materialRequests.length === 0) {
    panel.innerHTML =
      '<p class="field-hint">先に「家にある食材・材料」を追加すると、材料ごとの使い方を選べます。</p>';
    return;
  }

  const hasSpecifiedMaterial = state.materialRequests.some((request) => request.usage !== "auto");
  const prompt = hasSpecifiedMaterial
    ? ""
    : '<p class="field-hint">必要な材料だけ「必ず使う」または「使い切る」を選んでください。</p>';

  panel.innerHTML = `
    ${prompt}
    <div class="material-request-list">
      ${state.materialRequests
        .map((request) => {
          const amountLabel = request.usage === "use-up" ? "使い切りたい量" : "使う量";

          return `
            <fieldset class="material-request-row" data-material-request-id="${request.id}">
              <legend>${escapeHtml(request.name)}</legend>
              ${renderRadioOptions(
                `materialUsage-${request.id}`,
                materialUsageOptions,
                request.usage,
                "segmented-control",
              )}
              <div class="material-amount-controls"${request.usage === "auto" ? " hidden" : ""}>
                ${renderRadioOptions(
                  `useUpAmountMode-${request.id}`,
                  useUpAmountModeOptions,
                  request.useUpAmountMode,
                  "choice-grid compact-choice-grid",
                )}
                <label class="text-input-label"${request.useUpAmountMode === "custom" ? "" : " hidden"}>
                  <span>${amountLabel}</span>
                  <input
                    type="text"
                    value="${escapeHtml(request.useUpAmount)}"
                    data-material-amount-for="${request.id}"
                    placeholder="例: 150g、1/2個"
                    autocomplete="off"
                  />
                </label>
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
      <p class="lead" id="appLead">「ありもので何作ろう？」を、AIへそのまま渡せるレシピ依頼文に。</p>
      <p class="use-flow" aria-label="使い方">
        <span class="flow-step">1. 条件を入力</span>
        <span class="flow-arrow" aria-hidden="true">→</span>
        <span class="flow-step">2. 依頼文ができる</span>
        <span class="flow-arrow" aria-hidden="true">→</span>
        <span class="flow-step">3. コピーしてAIへ渡す</span>
      </p>
    </header>
    <div class="app-layout">
      <form class="form" id="recipeForm" data-testid="recipe-form" novalidate aria-describedby="appLead">
        <div id="basicFields" data-testid="basic-fields"></div>
        <div id="advancedFields" class="advanced-fields" data-testid="advanced-fields"></div>
      </form>
      <section class="prompt-section" aria-label="AIへ渡すレシピ依頼文">
        <div class="prompt-heading">
          <h2>AIへ渡すレシピ依頼文</h2>
          <p>この文章をコピーして、ChatGPTなどのAIへ渡してください。</p>
        </div>
        <div id="conditionChips" class="chips" data-testid="condition-chips" aria-live="polite"></div>
        <button
          id="copyPrompt"
          class="copy-icon-button copy-button"
          type="button"
          aria-label="依頼文をコピー"
          title="依頼文をコピー"
          data-testid="copy-prompt"
          data-default-label="依頼文をコピー"
          data-success-label="コピーしました。AIへ渡してください"
        >
          <span class="copy-button-icon" aria-hidden="true" data-icon="copy"></span>
          <span class="copy-label">依頼文をコピー</span>
          <span class="copy-status" aria-live="polite"></span>
        </button>
        <div class="output-shell">
          <textarea id="output" class="output" data-testid="prompt-output" readonly></textarea>
        </div>
      </section>
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
        <div id="stickyChips" class="sticky-chips" data-testid="sticky-condition-chips" aria-live="polite"></div>
        <div class="sheet-actions">
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
            aria-label="AIへ渡す依頼文をコピーする"
            title="AIへ渡す依頼文をコピーする"
            data-testid="copy-prompt-sticky"
            data-default-label="AIへ渡す依頼文をコピーする"
            data-success-label="コピーしました。AIへ渡してください"
          >
            <span class="copy-button-icon" aria-hidden="true" data-icon="copy"></span>
            <span class="copy-label">AIへ渡す依頼文をコピーする</span>
            <span class="copy-status" aria-live="polite"></span>
          </button>
        </div>
        <div
          id="mobilePromptPanel"
          class="mobile-prompt-panel"
          data-testid="mobile-prompt-panel"
          data-state="closed"
          aria-hidden="true"
        >
          <div class="mobile-prompt-head">
            <h2>AIに渡す依頼文</h2>
            <button id="sheetClose" class="sheet-close" type="button" aria-label="閉じる">×</button>
          </div>
          <div class="output-shell mobile-output-shell">
            <textarea id="mobileOutput" class="output mobile-output" data-testid="mobile-prompt-output" readonly></textarea>
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
  };
}

function renderFields(): void {
  queryElement("#basicFields").innerHTML = [
    renderRequestIntentField(),
    `<div id="targetDishField" hidden>${renderComboField(getCombo("targetDish"), "targetDishHint")}<p id="targetDishHint" class="field-hint">作りたい料理名を自由に入力できます。候補は入力補助です。</p></div>`,
    `<div id="pairingTargetsField" hidden>${renderComboField(getCombo("pairingTargets"))}</div>`,
    renderComboField(getCombo("materials")),
    renderMaterialUseField(),
    renderServingsField(),
  ].join("");

  queryElement("#advancedFields").innerHTML = [
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
      ${renderRadioOptions("materialUseMode", materialUseModeOptions, "auto")}
      <div id="materialUsePanel" class="material-use-panel" data-testid="material-use-panel" hidden></div>
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
    markUserHasInputPanel(state, elements, outputPanelServices);
  };

  const conditionReader = createPromptDataReaderFromInputs({
    comboRegistry,
    getRequestIntent: getRequestIntentValue,
    getMaterialUseMode: getMaterialUseModeValue,
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
    onChange: notifyOutputChange,
  };
}
