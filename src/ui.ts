import { buildConditionChipSpecs } from "./chips";
import { updateComboValues } from "./combo-values";
import { advancedComboOrder, combos, cookTimeOptions, optionSets, servingGroups } from "./data";
import { icon } from "./icons";
import { buildPrompt } from "./prompt";
import { buildServingsText, clampServingCount, type ServingGroupId } from "./servings";
import { filterComboOptions } from "./suggestions";
import type { AppState, ChipItem, ComboConfig, ComboId, PromptData } from "./types";

const createInitialState = (): AppState => {
  const initialCombos = {} as Record<ComboId, string[]>;
  for (const combo of combos) {
    initialCombos[combo.id] = [];
  }

  return {
    combos: initialCombos,
    editingCombo: null,
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

const SERVING_MIN = 0;
const SERVING_MAX = 10;
type ImeDataset = DOMStringMap & {
  composing?: string;
  justComposed?: string;
  skipBlurCommit?: string;
};

const labelHtml = (text: string, iconName: ComboConfig["icon"]): string =>
  `<span class="field-icon" aria-hidden="true">${icon(iconName)}</span>${text}`;
const suggestionLabel = (value: string): string => (value === "高野豆腐" ? "高野とうふ" : value);

function getComboBox(input: HTMLInputElement): HTMLElement | null {
  return input.closest<HTMLElement>(".combo");
}

function getSuggestionOptions(panel: HTMLElement): HTMLButtonElement[] {
  return $$<HTMLButtonElement>(".suggestion-option", panel);
}

function focusInputAtEnd(input: HTMLInputElement): void {
  input.focus({ preventScroll: true });
  const length = input.value.length;
  try {
    input.setSelectionRange(length, length);
  } catch {
    // 一部の環境では選択範囲設定ができないことがあるので無視する。
  }
}

function focusSuggestionOption(input: HTMLInputElement, option: HTMLButtonElement): void {
  const dataset = input.dataset as ImeDataset;
  dataset.skipBlurCommit = "true";
  option.focus({ preventScroll: true });
  window.requestAnimationFrame(() => {
    dataset.skipBlurCommit = "false";
  });
}

function focusAdjacentSuggestion(
  input: HTMLInputElement,
  current: HTMLButtonElement,
  delta: number,
): boolean {
  const panel = current.closest<HTMLElement>(".suggestions");
  if (!panel) return false;
  const options = getSuggestionOptions(panel);
  const index = options.indexOf(current);
  if (index < 0) return false;

  if (delta < 0 && index === 0) {
    focusInputAtEnd(input);
    return true;
  }

  let nextIndex = index + delta;
  if (delta > 0 && nextIndex >= options.length) {
    nextIndex = 0;
  }
  if (nextIndex < 0 || nextIndex >= options.length) {
    return false;
  }

  const next = options[nextIndex];
  if (!next) return false;
  focusSuggestionOption(input, next);
  return true;
}

export function isImeComposing(
  input: HTMLInputElement | null | undefined,
  e: Pick<KeyboardEvent, "isComposing" | "keyCode">,
): boolean {
  const dataset = input?.dataset as ImeDataset | undefined;

  return Boolean(
    e.isComposing ||
      e.keyCode === 229 ||
      dataset?.composing === "true" ||
      dataset?.justComposed === "true",
  );
}

function markCompositionEnded(input: HTMLInputElement | null): void {
  if (!input) {
    return;
  }

  const dataset = input.dataset as ImeDataset;
  dataset.composing = "false";
  dataset.justComposed = "true";

  window.setTimeout(() => {
    dataset.justComposed = "false";
  }, 80);
}

function getMainComboInput(box: HTMLElement): HTMLInputElement | null {
  return safe$<HTMLInputElement>(".combo-input", box);
}

function getEditingState(state: AppState, group: ComboId, value: string): boolean {
  return state.editingCombo?.group === group && state.editingCombo.value === value;
}

export function initializeApp(root: HTMLElement): void {
  root.innerHTML = renderAppShell();

  const state = createInitialState();
  const elements = getElements();

  renderFields();
  bindEvents(state, elements);
  updateCookTimeDisplay();
  updateServingSteppers();
  updateConditionChips(state, elements);
  updatePromptPreview(state, elements);
  updateStickyState(state, elements);
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

function getElements() {
  return {
    form: $("#recipeForm"),
    output: $("#output") as HTMLTextAreaElement,
    bottom: $("#bottomActions"),
    inlineButton: $("#generatePromptInline") as HTMLButtonElement,
    stickyButton: $("#generatePromptSticky") as HTMLButtonElement,
    chips: $("#conditionChips"),
    stickyChips: $("#stickyChips"),
    advancedDetails: $("#advancedDetails") as HTMLDetailsElement,
    advancedTitle: $("#advancedTitle"),
    advancedCount: $("#advancedCount"),
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

function comboValues(state: AppState, id: ComboId): string[] {
  return state.combos[id] ?? [];
}

export function comboOptionValues(group: ComboId): string[] {
  const combo = getCombo(group);
  const values = optionSets[combo.optionSet] ?? [];
  return combo.optionSet === "materials"
    ? [...values].sort((a, b) => a.localeCompare(b, "ja"))
    : values;
}

function getServingsCounts(): Partial<Record<ServingGroupId, number>> {
  const counts: Partial<Record<ServingGroupId, number>> = {};
  for (const { id } of servingGroups) {
    counts[id] = getCountValue(id);
  }
  return counts;
}

function setCountValue(id: ServingGroupId, value: number): void {
  const stepper = safe$<HTMLElement>(`[data-serving-id="${id}"]`);
  if (!stepper) return;

  const count = clampServingCount(value);
  const dataset = stepper.dataset as DOMStringMap & { count?: string };
  dataset.count = String(count);

  const countLabel = safe$<HTMLElement>(".serving-count", stepper);
  if (countLabel) countLabel.textContent = `${count}人`;

  const minus = safe$<HTMLButtonElement>(".serving-minus", stepper);
  const plus = safe$<HTMLButtonElement>(".serving-plus", stepper);
  if (minus) minus.disabled = count <= SERVING_MIN;
  if (plus) plus.disabled = count >= SERVING_MAX;
}

function updateServingSteppers(): void {
  for (const { id } of servingGroups) {
    setCountValue(id, getCountValue(id));
  }
}

function adjustServingValue(id: ServingGroupId, delta: number): void {
  setCountValue(id, getCountValue(id) + delta);
}

function closeSuggestions(except?: HTMLElement | null): void {
  for (const element of $$<HTMLElement>(".suggestions.show")) {
    if (element === except) continue;
    element.classList.remove("show");
    const input = safe$<HTMLInputElement>(".combo-input", element.closest(".combo") ?? document);
    input?.setAttribute("aria-expanded", "false");
  }
}

function showSuggestions(state: AppState, input: HTMLInputElement): HTMLButtonElement[] {
  const box = getComboBox(input);
  if (!box) return [];
  const group = (box.dataset as DOMStringMap & { combo?: ComboId }).combo as ComboId;
  const panel = safe$<HTMLElement>(".suggestions", box);
  if (!panel) return [];

  const query = input.value.trim();
  const options = filterComboOptions(comboOptionValues(group), query, comboValues(state, group));

  panel.innerHTML = options.length
    ? options
        .map(
          (value) =>
            `<button type="button" class="suggestion-option" tabindex="-1" data-value="${value}" role="option" aria-label="${suggestionLabel(value)}">${value}</button>`,
        )
        .join("")
    : '<div class="suggestion-empty">候補がありません</div>';

  closeSuggestions(panel);
  panel.classList.add("show");
  input.setAttribute("aria-expanded", "true");
  return getSuggestionOptions(panel);
}

function addComboValue(
  state: AppState,
  elements: ReturnType<typeof getElements>,
  group: ComboId,
  value: string,
  input?: HTMLInputElement | null,
  options: { refocusInput?: boolean } = {},
): void {
  const text = value.trim();
  if (!text) return;
  if (!state.combos[group].includes(text)) state.combos[group].push(text);
  if (input) input.value = "";
  renderCombo(state, elements, group);
  closeSuggestions();
  if (input && options.refocusInput) {
    focusInputAtEnd(input);
  }
  markHasInput(state, elements);
}

function startComboEditing(
  state: AppState,
  elements: ReturnType<typeof getElements>,
  group: ComboId,
  value: string,
): void {
  state.editingCombo = { group, value };
  renderCombo(state, elements, group);
  closeSuggestions();

  const pill = safe$<HTMLElement>(
    `.pill[data-value="${CSS.escape(value)}"]`,
    safe$<HTMLElement>(`[data-combo="${group}"]`) ?? document,
  );
  const input = pill ? safe$<HTMLInputElement>(".pill-edit-input", pill) : null;
  if (!input) return;
  input.focus({ preventScroll: true });
  input.select();
}

function finishComboEditing(
  state: AppState,
  elements: ReturnType<typeof getElements>,
  group: ComboId,
  oldValue: string,
  input: HTMLInputElement,
  options: { focusAfterSave?: boolean } = {},
): void {
  const values = comboValues(state, group);
  const nextValues = updateComboValues(values, oldValue, input.value);
  const nextValue = input.value.trim();
  state.editingCombo = null;

  if (nextValues !== values) {
    state.combos[group] = nextValues;
  }

  renderCombo(state, elements, group);

  if (options.focusAfterSave) {
    focusComboValue(group, nextValues.includes(nextValue) ? nextValue : oldValue);
  }

  if (nextValues !== values) {
    markHasInput(state, elements);
  }
}

function cancelComboEditing(
  state: AppState,
  elements: ReturnType<typeof getElements>,
  group: ComboId,
  oldValue: string,
): void {
  state.editingCombo = null;
  renderCombo(state, elements, group);
  focusComboValue(group, oldValue);
}

function focusComboValue(group: ComboId, value: string): void {
  const box = safe$<HTMLElement>(`[data-combo="${group}"]`);
  const pill = box ? safe$<HTMLElement>(`.pill[data-value="${CSS.escape(value)}"]`, box) : null;
  const label = pill ? safe$<HTMLButtonElement>(".pill-label", pill) : null;
  if (label) {
    label.focus({ preventScroll: true });
    return;
  }

  const input = box ? getMainComboInput(box) : null;
  input?.focus({ preventScroll: true });
}

function removeComboValue(
  state: AppState,
  elements: ReturnType<typeof getElements>,
  group: ComboId,
  value: string,
): void {
  state.combos[group] = comboValues(state, group).filter((item) => item !== value);
  if (getEditingState(state, group, value)) {
    state.editingCombo = null;
  }
  renderCombo(state, elements, group);
  markHasInput(state, elements);
  const box = safe$<HTMLElement>(`[data-combo="${group}"]`);
  getMainComboInput(box ?? document.body)?.focus({ preventScroll: true });
}

function renderCombo(
  state: AppState,
  elements: ReturnType<typeof getElements>,
  group: ComboId,
): void {
  const box = safe$<HTMLElement>(`[data-combo="${group}"]`);
  if (!box) return;
  const input = getMainComboInput(box);
  for (const pill of $$<HTMLElement>(".pill", box)) {
    pill.remove();
  }

  for (const value of comboValues(state, group)) {
    const pill = document.createElement("span");
    pill.className = "pill";
    pill.tabIndex = -1;
    (pill.dataset as DOMStringMap & { value?: string }).value = value;
    const editing = getEditingState(state, group, value);

    if (editing) {
      pill.classList.add("editing");
      const editInput = document.createElement("input");
      editInput.className = "pill-edit-input";
      editInput.type = "text";
      editInput.value = value;
      editInput.setAttribute("aria-label", `${value}を編集`);
      editInput.setAttribute("autocomplete", "off");
      const dataset = editInput.dataset as ImeDataset & { suppressBlurCommit?: string };

      editInput.addEventListener("keydown", (event) => {
        const keyboardEvent = event as KeyboardEvent;
        if (keyboardEvent.key === "Enter") {
          if (isImeComposing(editInput, keyboardEvent)) {
            return;
          }
          keyboardEvent.preventDefault();
          dataset.suppressBlurCommit = "true";
          finishComboEditing(state, elements, group, value, editInput, { focusAfterSave: true });
          return;
        }
        if (keyboardEvent.key === "Escape") {
          keyboardEvent.preventDefault();
          dataset.suppressBlurCommit = "true";
          cancelComboEditing(state, elements, group, value);
        }
      });

      editInput.addEventListener("compositionstart", () => {
        const dataset = editInput.dataset as ImeDataset;
        dataset.composing = "true";
      });
      editInput.addEventListener("compositionend", () => {
        markCompositionEnded(editInput);
      });
      editInput.addEventListener("blur", () => {
        if (dataset.suppressBlurCommit === "true") {
          return;
        }
        window.setTimeout(() => {
          if (pill.contains(document.activeElement)) {
            return;
          }
          finishComboEditing(state, elements, group, value, editInput);
        }, 0);
      });
      editInput.addEventListener("click", (event) => {
        event.stopPropagation();
      });
      pill.appendChild(editInput);
    } else {
      const label = document.createElement("button");
      label.type = "button";
      label.className = "pill-label";
      label.textContent = value;
      label.setAttribute("aria-label", `${value}を編集`);
      label.addEventListener("click", (event) => {
        event.stopPropagation();
        startComboEditing(state, elements, group, value);
      });
      pill.appendChild(label);
    }

    const remove = document.createElement("button");
    remove.type = "button";
    remove.className = "pill-remove";
    remove.textContent = "×";
    remove.setAttribute("aria-label", `${value}を削除`);
    remove.addEventListener("click", (event) => {
      event.stopPropagation();
      removeComboValue(state, elements, group, value);
    });

    pill.addEventListener("keydown", (event) => {
      const keyboardEvent = event as KeyboardEvent;
      if (keyboardEvent.key === "Enter" && !editing && event.target === pill) {
        keyboardEvent.preventDefault();
        startComboEditing(state, elements, group, value);
        return;
      }
      if (keyboardEvent.key !== "Backspace" && keyboardEvent.key !== "Delete") return;
      keyboardEvent.preventDefault();
      const dataset = pill.dataset as DOMStringMap & { armedDelete?: string };
      if (dataset.armedDelete === "true") {
        return;
      }
      removeComboValue(state, elements, group, value);
      input?.focus({ preventScroll: true });
    });

    pill.appendChild(remove);
    box.insertBefore(pill, input ?? null);
  }
}

function commitComboInput(
  state: AppState,
  elements: ReturnType<typeof getElements>,
  input: HTMLInputElement,
): void {
  const box = input.closest<HTMLElement>(".combo");
  if (!box) return;
  addComboValue(
    state,
    elements,
    (box.dataset as DOMStringMap & { combo?: ComboId }).combo as ComboId,
    input.value,
  );
  requestAnimationFrame(() => {
    input.value = "";
  });
}

function focusPreviousPill(input: HTMLInputElement): boolean {
  const box = input.closest<HTMLElement>(".combo");
  if (!box || input.value) return false;
  const pills = $$<HTMLElement>(".pill", box);
  const target = pills[pills.length - 1];
  if (!target) return false;
  for (const pill of pills) {
    pill.classList.remove("pending-delete");
  }
  target.classList.add("pending-delete");
  const dataset = target.dataset as DOMStringMap & { armedDelete?: string };
  dataset.armedDelete = "true";
  window.setTimeout(() => {
    if (dataset.armedDelete === "true") {
      dataset.armedDelete = "false";
    }
  }, 120);
  target.focus();
  return true;
}

function getCookTimeValue(): string {
  const range = safe$<HTMLInputElement>("#cookTimeRange");
  return range ? (cookTimeOptions[Number(range.value)] ?? "") : "";
}

function updateCookTimeDisplay(): void {
  const label = safe$<HTMLElement>("#cookTimeLabel");
  if (label) label.textContent = getCookTimeValue() || "指定なし";
}

function getCountValue(id: string): number {
  const stepper = safe$<HTMLElement>(`[data-serving-id="${id}"]`);
  const dataset = stepper?.dataset as DOMStringMap & { count?: string };
  return Number(dataset?.count ?? 0);
}

function getServingsValue(): string {
  return buildServingsText(getServingsCounts());
}

function chipItems(state: AppState, elements: ReturnType<typeof getElements>): ChipItem[] {
  const data = getFormData(state);
  const specs = buildConditionChipSpecs(data);

  return specs.map((spec) => {
    if (spec.kind === "combo") {
      return {
        label: spec.label,
        removable: spec.removable,
        action: () => {
          if (state.editingCombo?.group === spec.id) {
            state.editingCombo = null;
          }
          state.combos[spec.id] = [];
          renderCombo(state, elements, spec.id);
          markHasInput(state, elements);
        },
      };
    }

    if (spec.kind === "cookTime") {
      return {
        label: spec.label,
        removable: spec.removable,
        action: () => {
          const range = safe$<HTMLInputElement>("#cookTimeRange");
          if (range) range.value = "0";
          markHasInput(state, elements);
        },
      };
    }

    if (spec.kind === "supplementalNotes") {
      return {
        label: spec.label,
        removable: spec.removable,
        action: () => {
          const textarea = safe$<HTMLTextAreaElement>("#supplementalNotes");
          if (textarea) textarea.value = "";
          markHasInput(state, elements);
        },
      };
    }

    return {
      label: spec.label,
      removable: spec.removable,
    };
  });
}

function renderChips(
  container: Element,
  items: ChipItem[],
  options: { readOnly?: boolean } = {},
): void {
  container.innerHTML = "";
  container.classList.toggle("show", items.length > 0);
  for (const item of items) {
    const chip = document.createElement("span");
    chip.className = "chip";
    chip.appendChild(document.createTextNode(item.label));
    if (item.removable && !options.readOnly && item.action) {
      const remove = document.createElement("button");
      remove.type = "button";
      remove.className = "chip-remove";
      remove.textContent = "×";
      remove.addEventListener("click", item.action);
      chip.appendChild(remove);
    }
    container.appendChild(chip);
  }
}

function getFormData(state: AppState): PromptData {
  return {
    materials: comboValues(state, "materials"),
    dishTypes: comboValues(state, "dishTypes"),
    cookingTools: comboValues(state, "cookingTools"),
    pairingTargets: comboValues(state, "pairingTargets"),
    difficulty: comboValues(state, "difficulty"),
    health: comboValues(state, "health"),
    flavors: comboValues(state, "flavors"),
    genres: comboValues(state, "genres"),
    scenes: comboValues(state, "scenes"),
    ngMaterials: comboValues(state, "ngMaterials"),
    ngSeasonings: comboValues(state, "ngSeasonings"),
    servings: getServingsValue(),
    cookTime: getCookTimeValue(),
    supplementalNotes: safe$<HTMLTextAreaElement>("#supplementalNotes")?.value.trim() ?? "",
  };
}

function updateAdvancedCount(state: AppState, elements: ReturnType<typeof getElements>): void {
  const count =
    advancedComboOrder.reduce((sum, id) => sum + comboValues(state, id).length, 0) +
    (getCookTimeValue() ? 1 : 0) +
    (safe$<HTMLTextAreaElement>("#supplementalNotes")?.value.trim() ? 1 : 0);
  elements.advancedCount.textContent = count ? `(${count}件指定中)` : "";
  updateAdvancedTitle(elements);
}

function updateAdvancedTitle(elements: ReturnType<typeof getElements>): void {
  elements.advancedTitle.textContent = elements.advancedDetails.open
    ? "こだわり条件"
    : "こだわり条件を追加";
}

function isNearBottom(): boolean {
  return window.scrollY + window.innerHeight >= document.documentElement.scrollHeight - 160;
}

function updateStickyActions(state: AppState, elements: ReturnType<typeof getElements>): void {
  const show = state.hasUserInput && !state.inlineVisible && !state.nearBottom;
  elements.bottom.classList.toggle("show", show);
  elements.bottom.classList.toggle("suppress", !show);
}

function updateStickyState(state: AppState, elements: ReturnType<typeof getElements>): void {
  state.nearBottom = isNearBottom();
  updateStickyActions(state, elements);
}

function updatePromptPreview(state: AppState, elements: ReturnType<typeof getElements>): void {
  elements.output.value = buildPrompt(getFormData(state));
  updateStickyState(state, elements);
}

function updateConditionChips(state: AppState, elements: ReturnType<typeof getElements>): void {
  const items = chipItems(state, elements);
  renderChips(elements.chips, items);
  renderChips(elements.stickyChips, items.slice(0, 8), { readOnly: true });
  updateAdvancedCount(state, elements);
}

function markHasInput(state: AppState, elements: ReturnType<typeof getElements>): void {
  state.hasUserInput = true;
  updateCookTimeDisplay();
  updateServingSteppers();
  updateConditionChips(state, elements);
  updatePromptPreview(state, elements);
}

function openSuggestions(state: AppState, input: HTMLInputElement): void {
  input.focus({ preventScroll: true });
  showSuggestions(state, input);
}

function scrollToPrompt(state: AppState, elements: ReturnType<typeof getElements>): void {
  updatePromptPreview(state, elements);
  elements.output.scrollIntoView({ behavior: "smooth", block: "start" });
  elements.output.focus();
  elements.output.setSelectionRange(0, 0);
  markHasInput(state, elements);
}

async function copyPrompt(
  _state: AppState,
  elements: ReturnType<typeof getElements>,
  event: Event,
): Promise<void> {
  const button = event.currentTarget as HTMLElement | null;
  if (!elements.output.value.trim()) updatePromptPreview(_state, elements);
  try {
    await navigator.clipboard.writeText(String(elements.output.value || ""));
  } catch {
    elements.output.select();
    document.execCommand("copy");
  }
  showCopyToast(button);
}

function showCopyToast(button: HTMLElement | null): void {
  const toast = button?.querySelector<HTMLElement>(".copy-toast");
  if (!toast) return;
  toast.classList.remove("show");
  void toast.offsetWidth;
  toast.classList.add("show");
  window.setTimeout(() => toast.classList.remove("show"), 1500);
}

function bindEvents(state: AppState, elements: ReturnType<typeof getElements>): void {
  elements.form.addEventListener("keydown", (event) => {
    const keyboardEvent = event as KeyboardEvent;
    const target = event.target as Element | null;
    const option = target?.closest<HTMLButtonElement>(".suggestion-option");
    const combo = target?.closest<HTMLElement>(".combo");
    const input =
      target?.closest<HTMLInputElement>(".combo-input") ??
      (combo ? getMainComboInput(combo) : null);

    if (option && input) {
      if (keyboardEvent.key === "Enter") {
        keyboardEvent.preventDefault();
        const optionCombo = option.closest<HTMLElement>(".combo");
        const value = (option.dataset as DOMStringMap & { value?: string }).value;
        if (optionCombo && value) {
          addComboValue(
            state,
            elements,
            (optionCombo.dataset as DOMStringMap & { combo?: ComboId }).combo as ComboId,
            value,
            input,
            { refocusInput: true },
          );
        }
        return;
      }
      if (keyboardEvent.key === "ArrowDown") {
        keyboardEvent.preventDefault();
        focusAdjacentSuggestion(input, option, 1);
        return;
      }
      if (keyboardEvent.key === "ArrowUp") {
        keyboardEvent.preventDefault();
        focusAdjacentSuggestion(input, option, -1);
        return;
      }
      if (keyboardEvent.key === "Escape") {
        keyboardEvent.preventDefault();
        closeSuggestions();
        focusInputAtEnd(input);
        return;
      }
    }

    if (!input) return;

    if (keyboardEvent.key === "Enter") {
      if (isImeComposing(input, keyboardEvent)) {
        return;
      }
      keyboardEvent.preventDefault();
      commitComboInput(state, elements, input);
      return;
    }
    if (keyboardEvent.key === "ArrowDown") {
      keyboardEvent.preventDefault();
      const options = showSuggestions(state, input);
      if (options[0]) {
        focusSuggestionOption(input, options[0]);
      }
      return;
    }
    if (keyboardEvent.key === "Escape") {
      closeSuggestions();
      return;
    }
    if (
      (keyboardEvent.key === "Backspace" || keyboardEvent.key === "Delete") &&
      !input.value &&
      focusPreviousPill(input)
    ) {
      keyboardEvent.preventDefault();
    }
  });

  elements.form.addEventListener("pointerdown", (event) => {
    const target = event.target as Element;
    const button = target.closest<HTMLButtonElement>(".combo-picker");
    if (!button) return;
    event.preventDefault();
    const input = safe$<HTMLInputElement>(".combo-input", button.closest(".combo") ?? document);
    if (input) openSuggestions(state, input);
  });

  elements.form.addEventListener("click", (event) => {
    const target = event.target as Element;
    if (target.closest(".pill")) {
      return;
    }
    const servingButton = target.closest<HTMLButtonElement>(".serving-adjust");
    if (servingButton) {
      const stepper = servingButton.closest<HTMLElement>(".serving-stepper");
      const id = (stepper?.dataset as DOMStringMap & { servingId?: ServingGroupId }).servingId;
      const delta = servingButton.classList.contains("serving-plus") ? 1 : -1;
      if (id) {
        adjustServingValue(id, delta);
        markHasInput(state, elements);
      }
      return;
    }

    const option = target.closest<HTMLElement>(".suggestion-option");
    if (option) {
      const combo = option.closest<HTMLElement>(".combo");
      const value = (option.dataset as DOMStringMap & { value?: string }).value;
      if (combo && value)
        addComboValue(
          state,
          elements,
          (combo.dataset as DOMStringMap & { combo?: ComboId }).combo as ComboId,
          value,
          getMainComboInput(combo),
          { refocusInput: true },
        );
      return;
    }
    const button = target.closest<HTMLButtonElement>(".combo-picker");
    if (button) {
      const input = safe$<HTMLInputElement>(".combo-input", button.closest(".combo") ?? document);
      if (input) openSuggestions(state, input);
      return;
    }
    const combo = target.closest<HTMLElement>(".combo");
    if (combo) {
      const input = getMainComboInput(combo);
      if (input) openSuggestions(state, input);
    } else {
      closeSuggestions();
    }
  });

  elements.form.addEventListener("change", () => {
    markHasInput(state, elements);
  });

  elements.form.addEventListener("compositionstart", (event) => {
    const input = (event.target as Element).closest<HTMLInputElement>(".combo-input");
    if (input) {
      const dataset = input.dataset as ImeDataset;
      dataset.composing = "true";
    }
  });

  elements.form.addEventListener("compositionend", (event) => {
    const input = (event.target as Element).closest<HTMLInputElement>(".combo-input");
    if (!input) {
      return;
    }

    markCompositionEnded(input);
    showSuggestions(state, input);
  });

  elements.form.addEventListener("compositionupdate", (event) => {
    const input = (event.target as Element).closest<HTMLInputElement>(".combo-input");
    if (!input) {
      return;
    }

    window.requestAnimationFrame(() => {
      showSuggestions(state, input);
    });
  });

  elements.form.addEventListener("focusout", (event) => {
    const focusEvent = event as FocusEvent;
    const combo = (event.target as Element | null)?.closest<HTMLElement>(".combo");
    if (!combo) return;

    const relatedTarget = focusEvent.relatedTarget as Node | null;
    if (relatedTarget && combo.contains(relatedTarget)) {
      return;
    }

    const input = getMainComboInput(combo);
    if (!input) return;

    window.setTimeout(() => {
      const dataset = input.dataset as ImeDataset;
      if (dataset.skipBlurCommit === "true") {
        dataset.skipBlurCommit = "false";
        return;
      }
      if (!combo.contains(document.activeElement)) {
        commitComboInput(state, elements, input);
        closeSuggestions();
      }
    }, 120);
  });

  elements.form.addEventListener("input", (event) => {
    const input = (event.target as Element).closest<HTMLInputElement>(".combo-input");
    if (input) showSuggestions(state, input);
    markHasInput(state, elements);
  });

  window.addEventListener(
    "scroll",
    () => {
      if (state.ticking) return;
      state.ticking = true;
      requestAnimationFrame(() => {
        updateStickyState(state, elements);
        state.ticking = false;
      });
    },
    { passive: true },
  );

  window.addEventListener("resize", () => updateStickyState(state, elements));
  elements.advancedDetails.addEventListener("toggle", () => updateAdvancedTitle(elements));
  elements.inlineButton.addEventListener("click", () => scrollToPrompt(state, elements));
  elements.stickyButton.addEventListener("click", () => scrollToPrompt(state, elements));
  $("#copyPrompt").addEventListener("click", (event) => void copyPrompt(state, elements, event));
  $("#copyPromptSticky").addEventListener(
    "click",
    (event) => void copyPrompt(state, elements, event),
  );

  if ("IntersectionObserver" in window) {
    new IntersectionObserver(
      (entries) => {
        state.inlineVisible = entries.some((entry) => entry.isIntersecting);
        updateStickyActions(state, elements);
      },
      { threshold: 0.08 },
    ).observe(elements.inlineButton);
  }
}
