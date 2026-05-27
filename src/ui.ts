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
        <img
          class="title-image"
          src="/title-banner.webp"
          alt="ありもの de レシピ プロンプトメーカー"
          width="1200"
          height="300"
          decoding="async"
          fetchpriority="high"
        />
      </h1>
      <p class="lead" id="appLead">冷蔵庫にある食材・材料と条件から、AI にレシピ依頼文を作ります。</p>
    </header>
    <div class="app-layout">
      <form class="form" id="recipeForm" novalidate aria-describedby="appLead">
        <div id="basicFields"></div>
        <details class="advanced" id="advancedDetails">
          <summary aria-controls="advancedFields">
            <span class="summary-title" id="advancedTitle">こだわり条件を追加</span>
            <span id="advancedCount"></span>
          </summary>
          <div class="advanced-body">
            <div class="advanced-intro">
              <span class="section-kicker">こだわり条件</span>
              <p>必要なときだけ追加する条件です。開くと、ここから下がこだわり条件だと分かるようにしています。</p>
            </div>
            <div id="advancedFields"></div>
          </div>
        </details>
      </form>
      <section class="prompt-section" aria-labelledby="promptSectionTitle">
        <div class="prompt-section-header">
          <h2 id="promptSectionTitle">プロンプト</h2>
        </div>
        <div class="prompt-card">
          <div class="prompt-toolbar">
            <label for="output"><span class="field-icon" aria-hidden="true" data-icon="copy"></span>プロンプト</label>
            <button id="copyPrompt" class="copy-icon-button" type="button" aria-label="プロンプトをコピー" title="コピー">
              <span class="copy-toast" role="status">コピーしました</span><span data-icon="copy"></span>
            </button>
          </div>
          <div class="output-shell">
            <textarea id="output" class="output" readonly aria-describedby="outputHelp"></textarea>
          </div>
          <p class="result-note" id="outputHelp">コピーしてAIに貼り付けてください。</p>
          <div id="conditionChips" class="chips" aria-live="polite"></div>
          <div class="output-actions"><button id="generatePromptInline" type="button">プロンプトを見る</button></div>
        </div>
      </section>
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

function getAppElements(): AppElements {
  return {
    form: queryElement("#recipeForm"),
    output: queryElement("#output") as HTMLTextAreaElement,
    bottom: queryElement("#bottomActions") as HTMLElement,
    inlineButton: queryElement("#generatePromptInline") as HTMLButtonElement,
    stickyButton: queryElement("#generatePromptSticky") as HTMLButtonElement,
    chips: queryElement("#conditionChips") as HTMLElement,
    stickyChips: queryElement("#stickyChips") as HTMLElement,
    advancedDetails: queryElement("#advancedDetails") as HTMLDetailsElement,
    advancedTitle: queryElement("#advancedTitle") as HTMLElement,
    advancedCount: queryElement("#advancedCount") as HTMLElement,
  };
}

function renderFields(): void {
  queryElement("#basicFields").innerHTML = [
    renderComboField(getCombo("materials")),
    renderServingsField(),
    ...combos.filter((combo) => combo.basic && combo.id !== "materials").map(renderComboField),
  ].join("");

  queryElement("#advancedFields").innerHTML = [
    renderCookTimeField(),
    ...advancedConditionOrder.map((id) => renderComboField(getCombo(id))),
    `<div class="field"><label for="supplementalNotes">${fieldLabelHtml("その他の要望", "note")}</label><textarea id="supplementalNotes" placeholder="例: 子ども用に辛くしない。冷蔵庫で3日間保存したい。"></textarea></div>`,
  ].join("");

  queryAllElements<HTMLElement>("[data-icon]").forEach((element) => {
    const iconName = (element.dataset as DOMStringMap & { icon?: ComboConfig["icon"] }).icon;
    if (iconName) element.innerHTML = icon(iconName as ComboConfig["icon"]);
  });
}

function renderComboField(combo: ComboConfig): string {
  const inputId = `${combo.id}Input`;
  const suggestionsId = `${combo.id}Suggestions`;
  return `
    <div class="field">
      <label class="field-title" for="${inputId}">${fieldLabelHtml(combo.label, combo.icon)}</label>
      <div class="combo" data-combo="${combo.id}">
        <input
          id="${inputId}"
          class="combo-input"
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
        <div id="${suggestionsId}" class="suggestions" role="listbox" aria-label="${combo.label}の候補"></div>
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

  return `
    <fieldset class="field fieldset">
      <legend class="field-title">${fieldLabelHtml("人数・分量", "users")}</legend>
      <div class="serving-grid" aria-label="人数・分量">${controls}</div>
    </fieldset>
  `;
}

function renderCookTimeField(): string {
  return `
    <div class="field">
      <label for="cookTimeRange">${fieldLabelHtml("調理時間", "clock")}</label>
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
