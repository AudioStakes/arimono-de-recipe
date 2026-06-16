import type { AppElements } from "./app-elements";
import { bindAppEvents } from "./app-events";
import { getCookTimeValue, updateCookTimeDisplay } from "./combo-field";
import { type ComboRegistry, createComboRegistry } from "./combo-registry";
import { createPromptDataReaderFromInputs } from "./conditions";
import { advancedConditionOrder, combos, cookTimeOptions, servingGroups } from "./data";
import { icon } from "./icons";
import type { PromptPanelServices } from "./output-panel";
import {
  markUserHasInput as markUserHasInputPanel,
  refreshPromptPanel as refreshPromptPanelPanel,
} from "./output-panel";
import { getServingsValue, updateServingSteppers } from "./serving-controls";
import type { AppState, ComboConfig, ComboId } from "./types";

const createInitialState = (): AppState => {
  return {
    hasUserInput: false,
    inlineVisible: false,
    nearBottom: false,
    ticking: false,
    mobileSheetOpen: false,
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
    renderComboField(getCombo("materials")),
    renderServingsField(),
  ].join("");

  queryElement("#advancedFields").innerHTML = [
    renderCollapsibleComboField(getCombo("dishTypes")),
    renderCollapsibleComboField(getCombo("cookingTools")),
    renderCollapsibleComboField(getCombo("pairingTargets")),
    renderCollapsibleCookTimeField(),
    ...advancedConditionOrder.map((id) => renderCollapsibleComboField(getCombo(id))),
    renderCollapsibleNotesField(),
  ].join("");

  queryAllElements<HTMLElement>("[data-icon]").forEach((element) => {
    const iconName = (element.dataset as DOMStringMap & { icon?: ComboConfig["icon"] }).icon;
    if (iconName) element.innerHTML = icon(iconName as ComboConfig["icon"]);
  });
}

function renderComboField(combo: ComboConfig): string {
  return `
    <div class="field" data-testid="recipe-item-${combo.id}">
      <label class="field-title" for="${combo.id}Input">${fieldLabelHtml(combo.label, combo.icon)}</label>
      ${renderComboFieldControl(combo)}
    </div>
  `;
}

function renderComboFieldControl(combo: ComboConfig): string {
  const inputId = `${combo.id}Input`;
  const suggestionsId = `${combo.id}Suggestions`;
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
          role="combobox"
          aria-autocomplete="list"
          aria-expanded="false"
          aria-controls="${suggestionsId}"
          aria-haspopup="listbox"
        />
        <button class="combo-picker" type="button" aria-label="${combo.label}の候補を表示" aria-controls="${suggestionsId}"></button>
        <div id="${suggestionsId}" class="suggestions" data-testid="combo-suggestions-${combo.id}" role="listbox" aria-label="${combo.label}の候補"></div>
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
        <textarea id="supplementalNotes" data-testid="supplemental-notes" placeholder="例: 子ども用に辛くしない。冷蔵庫で3日間保存したい。"></textarea>
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
          <div class="serving-label" id="${id}Label"><span aria-hidden="true">${icon(iconName)}</span>${label}</div>
          <div class="serving-stepper" data-serving-id="${id}" data-testid="serving-stepper-${id}" data-count="0" aria-labelledby="${id}Label">
            <button class="serving-adjust serving-minus" type="button" aria-label="${label}を1人減らす">−</button>
            <span class="serving-count" aria-live="polite">0人</span>
            <button class="serving-adjust serving-plus" type="button" aria-label="${label}を1人増やす">+</button>
          </div>
        </div>
      `,
    )
    .join("");

  return `
    <fieldset class="field fieldset">
      <legend class="field-title">${fieldLabelHtml("食べる人数", "users")}</legend>
      <div class="serving-grid" aria-label="食べる人数">${controls}</div>
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
  const notifyOutputChange = (): void => {
    if (!outputPanelServices) return;
    markUserHasInputPanel(state, elements, outputPanelServices);
  };

  const conditionReader = createPromptDataReaderFromInputs({
    comboRegistry,
    getServingsText: getServingsValue,
    getCookTimeText: getCookTimeValue,
    getSupplementalNotes: () =>
      queryMaybeElement<HTMLTextAreaElement>("#supplementalNotes")?.value.trim() ?? "",
  });

  comboRegistry.setOnChange(notifyOutputChange);

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
    },
    clearSupplementalNotes: () => {
      const textarea = queryMaybeElement<HTMLTextAreaElement>("#supplementalNotes");
      if (textarea) textarea.value = "";
    },
    onChange: notifyOutputChange,
  };
}
