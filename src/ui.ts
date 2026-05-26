import { advancedComboOrder, combos, cookTimeOptions, servingGroups } from "./data";
import { icon } from "./icons";
import { createComboRegistry, type ComboRegistry } from "./combo-registry";
import { createConditionReaderFromInputs } from "./conditions";
import { getServingsValue, updateServingSteppers } from "./serving-controls";
import { getCookTimeValue, updateCookTimeDisplay } from "./combo-field";
import { bindAppEvents } from "./app-events";
import type { PromptPanelServices } from "./output-panel";
import {
  markPromptHasInput as markPromptHasInputPanel,
  refreshPromptPanel as refreshPromptPanelPanel,
} from "./output-panel";
import type { AppState, ComboConfig, ComboId } from "./types";
import type { AppElements } from "./app-elements";

const createInitialState = (): AppState => {
  return {
    hasUserInput: false,
    inlineVisible: false,
    nearBottom: false,
    ticking: false,
  };
};

const $ = <T extends Element>(selector: string, root: ParentNode = document): T => {
  const element = root.querySelector<T>(selector);
  if (!element) throw new Error(`Element not found: ${selector}`);
  return element;
};

const $$ = <T extends Element>(selector: string, root: ParentNode = document): T[] => [
  ...root.querySelectorAll<T>(selector),
];

const safe$ = <T extends Element>(selector: string, root: ParentNode = document): T | null =>
  root.querySelector<T>(selector);

const labelHtml = (text: string, iconName: ComboConfig["icon"]): string =>
  `<span class="field-icon" aria-hidden="true">${icon(iconName)}</span>${text}`;

let activeOutputPanel: PromptPanelServices | null = null;

export function initializeApp(root: HTMLElement): void {
  root.innerHTML = renderAppShell();

  const state = createInitialState();
  const elements = getElements();
  renderFields();
  const comboRegistry = createComboRegistry(elements.form);
  comboRegistry.bind(elements.form);
  activeOutputPanel = createOutputPanelServices(state, elements, comboRegistry);
  const outputPanel = activeOutputPanel;
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
        <img
          class="title-image"
          src="/title-banner.webp"
          alt="ありもの de レシピ プロンプトメーカー"
          width="1200"
          height="300"
          decoding="async"
        />
      </h1>
      <p class="lead">冷蔵庫にある材料と条件から、AI にレシピ提案を依頼する文章を作ります。</p>
    </header>
    <div class="form" id="recipeForm">
      <div id="basicFields"></div>
      <details class="advanced" id="advancedDetails">
        <summary><span class="summary-title" id="advancedTitle">こだわり条件を追加</span><span id="advancedCount"></span></summary>
        <div id="advancedFields"></div>
      </details>
      <div class="field result-field">
        <label for="output"><span class="field-icon" aria-hidden="true" data-icon="copy"></span>プロンプト</label>
        <p class="result-note">コピーしてAIに貼り付けてください。</p>
        <div class="output-shell">
          <textarea id="output" class="output" readonly placeholder="ここにプロンプトが表示されます。"></textarea>
          <button id="copyPrompt" class="copy-icon-button" type="button" aria-label="プロンプトをコピー" title="コピー">
            <span class="copy-toast" role="status">コピーしました</span><span data-icon="copy"></span>
          </button>
        </div>
        <div id="conditionChips" class="chips" aria-live="polite"></div>
        <div class="output-actions"><button id="generatePromptInline" type="button">プロンプトを見る</button></div>
      </div>
    </div>
    <div class="bottom-actions" id="bottomActions">
      <div class="bottom-actions-inner">
        <div id="stickyChips" class="sticky-chips" aria-live="polite"></div>
        <button id="generatePromptSticky" type="button">プロンプトを見る</button>
        <button id="copyPromptSticky" class="copy-icon-button sticky-copy" type="button" aria-label="プロンプトをコピー" title="コピー">
          <span class="copy-toast" role="status">コピーしました</span><span data-icon="copy"></span>
        </button>
      </div>
    </div>
  `;
}

function getElements(): AppElements {
  return {
    form: $("#recipeForm"),
    output: $("#output") as HTMLTextAreaElement,
    bottom: $("#bottomActions") as HTMLElement,
    inlineButton: $("#generatePromptInline") as HTMLButtonElement,
    stickyButton: $("#generatePromptSticky") as HTMLButtonElement,
    chips: $("#conditionChips") as HTMLElement,
    stickyChips: $("#stickyChips") as HTMLElement,
    advancedDetails: $("#advancedDetails") as HTMLDetailsElement,
    advancedTitle: $("#advancedTitle") as HTMLElement,
    advancedCount: $("#advancedCount") as HTMLElement,
  };
}

function renderFields(): void {
  $("#basicFields").innerHTML = [
    renderComboField(getCombo("materials")),
    renderServingsField(),
    ...combos.filter((combo) => combo.basic && combo.id !== "materials").map(renderComboField),
  ].join("");

  $("#advancedFields").innerHTML = [
    renderCookTimeField(),
    ...advancedComboOrder.map((id) => renderComboField(getCombo(id))),
    `<div class="field"><label for="supplementalNotes">${labelHtml("補足", "note")}</label><textarea id="supplementalNotes" placeholder="例: 子ども用に辛くしない。冷蔵庫で3日間保存したい。"></textarea></div>`,
  ].join("");

  $$<HTMLElement>("[data-icon]").forEach((element) => {
    const iconName = (element.dataset as DOMStringMap & { icon?: ComboConfig["icon"] }).icon;
    if (iconName) element.innerHTML = icon(iconName as ComboConfig["icon"]);
  });
}

function renderComboField(combo: ComboConfig): string {
  return `
    <div class="field">
      <div class="field-title">${labelHtml(combo.label, combo.icon)}</div>
      <div class="combo" data-combo="${combo.id}">
        <input class="combo-input" type="text" placeholder="${combo.placeholder}" aria-label="${combo.label}" autocomplete="off" role="combobox" aria-expanded="false" />
        <button class="combo-picker" type="button" aria-label="${combo.label}の候補を表示"></button>
        <div class="suggestions" role="listbox" aria-label="${combo.label}の候補"></div>
      </div>
    </div>
  `;
}

function renderServingsField(): string {
  const controls = servingGroups
    .map(
      ({ id, label, icon: iconName }) => `
        <div class="serving-card">
          <div class="serving-label" id="${id}Label"><span aria-hidden="true">${icon(iconName)}</span>${label}</div>
          <div class="serving-stepper" data-serving-id="${id}" data-count="0" aria-labelledby="${id}Label">
            <button class="serving-adjust serving-minus" type="button" aria-label="${label}を1人減らす">−</button>
            <span class="serving-count" aria-live="polite">0人</span>
            <button class="serving-adjust serving-plus" type="button" aria-label="${label}を1人増やす">+</button>
          </div>
        </div>
      `,
    )
    .join("");

  return `<div class="field"><div class="field-title">${labelHtml("人数・分量", "users")}</div><div class="serving-grid" aria-label="人数・分量">${controls}</div></div>`;
}

function renderCookTimeField(): string {
  return `
    <div class="field">
      <label for="cookTimeRange">${labelHtml("調理時間", "clock")}</label>
      <div class="range-card">
        <div class="range-meta"><span>指定なし</span><span id="cookTimeLabel" class="range-value">指定なし</span><span>60分以内</span></div>
        <input id="cookTimeRange" type="range" min="0" max="${cookTimeOptions.length - 1}" step="1" value="0" aria-label="調理時間" />
      </div>
    </div>
  `;
}

function getCombo(id: ComboId): ComboConfig {
  const combo = combos.find((item) => item.id === id);
  if (!combo) throw new Error(`Combo not found: ${id}`);
  return combo;
}

function createOutputPanelServices(
  state: AppState,
  elements: ReturnType<typeof getElements>,
  comboRegistry: ComboRegistry,
): PromptPanelServices {
  const notifyOutputChange = (): void => {
    if (!activeOutputPanel) return;
    markPromptHasInputPanel(state, elements, activeOutputPanel);
  };

  const conditionReader = createConditionReaderFromInputs({
    comboRegistry,
    getServingsText: getServingsValue,
    getCookTimeText: getCookTimeValue,
    getSupplementalNotes: () =>
      safe$<HTMLTextAreaElement>("#supplementalNotes")?.value.trim() ?? "",
  });

  comboRegistry.setOnChange(notifyOutputChange);

  return {
    readConditions: () => conditionReader.read(),
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
      const range = safe$<HTMLInputElement>("#cookTimeRange");
      if (range) range.value = "0";
    },
    clearSupplementalNotes: () => {
      const textarea = safe$<HTMLTextAreaElement>("#supplementalNotes");
      if (textarea) textarea.value = "";
    },
    onChange: notifyOutputChange,
  };
}
