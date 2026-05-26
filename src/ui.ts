import {
  advancedComboOrder,
  chipOrder,
  combos,
  cookTimeOptions,
  optionSets,
  servingGroups,
} from "./data";
import { icon } from "./icons";
import { buildPrompt } from "./prompt";
import type { AppState, ChipItem, ComboConfig, ComboId, PromptData } from "./types";

const createInitialState = (): AppState => {
  const initialCombos = {} as Record<ComboId, string[]>;
  for (const combo of combos) {
    initialCombos[combo.id] = [];
  }

  return {
    combos: initialCombos,
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

const optionHtml = (value: number): string => `<option value="${value}">${value}人</option>`;
const labelHtml = (text: string, iconName: ComboConfig["icon"]): string =>
  `<span class="field-icon" aria-hidden="true">${icon(iconName)}</span>${text}`;
const inlineList = (items: string[]): string => items.join("、");
const suggestionLabel = (value: string): string => (value === "高野豆腐" ? "高野とうふ" : value);

export function initializeApp(root: HTMLElement): void {
  root.innerHTML = renderAppShell();

  const state = createInitialState();
  const elements = getElements();

  renderFields();
  bindEvents(state, elements);
  updateCookTimeDisplay();
  updateConditionChips(state, elements);
  updatePromptPreview(state, elements);
  updateStickyState(state, elements);
}

function renderAppShell(): string {
  return `
    <header>
      <h1>
        <span class="title-main"><span class="title-accent">ありもの</span> <span class="title-de">de</span> <span class="title-accent">レシピ</span></span>
        <span class="title-sub">プロンプトメーカー</span>
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
        <input type="text" placeholder="${combo.placeholder}" aria-label="${combo.label}" autocomplete="off" role="combobox" aria-expanded="false" />
        <button class="combo-picker" type="button" aria-label="${combo.label}の候補を表示"></button>
        <div class="suggestions" role="listbox" aria-label="${combo.label}の候補"></div>
      </div>
    </div>
  `;
}

function renderServingsField(): string {
  const options = Array.from({ length: 11 }, (_, index) => optionHtml(index)).join("");
  const controls = servingGroups
    .map(
      ({ id, label, icon: iconName }) => `
        <div>
          <label class="serving-label" for="${id}"><span aria-hidden="true">${icon(iconName)}</span>${label}</label>
          <div class="select-wrap"><select id="${id}" aria-label="${label}の人数">${options}</select></div>
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

function comboOptionValues(group: ComboId): string[] {
  const combo = getCombo(group);
  const values = optionSets[combo.optionSet] ?? [];
  return combo.optionSet === "materials"
    ? [...values].sort((a, b) => a.localeCompare(b, "ja"))
    : values;
}

function closeSuggestions(except?: HTMLElement | null): void {
  for (const element of $$<HTMLElement>(".suggestions.show")) {
    if (element === except) continue;
    element.classList.remove("show");
    const input = safe$<HTMLInputElement>("input", element.closest(".combo") ?? document);
    input?.setAttribute("aria-expanded", "false");
  }
}

function showSuggestions(state: AppState, input: HTMLInputElement): void {
  const box = input.closest<HTMLElement>(".combo");
  if (!box) return;
  const group = (box.dataset as DOMStringMap & { combo?: ComboId }).combo as ComboId;
  const panel = safe$<HTMLElement>(".suggestions", box);
  if (!panel) return;

  const query = input.value.trim();
  const selected = new Set(comboValues(state, group));
  const options = comboOptionValues(group).filter(
    (value) => !selected.has(value) && (!query || value.includes(query)),
  );

  panel.innerHTML = options.length
    ? options
        .map(
          (value) =>
            `<button type="button" class="suggestion-option" data-value="${value}" role="option" aria-label="${suggestionLabel(value)}">${value}</button>`,
        )
        .join("")
    : '<div class="suggestion-empty">候補がありません</div>';

  closeSuggestions(panel);
  panel.classList.add("show");
  input.setAttribute("aria-expanded", "true");
}

function addComboValue(
  state: AppState,
  elements: ReturnType<typeof getElements>,
  group: ComboId,
  value: string,
  input?: HTMLInputElement | null,
): void {
  const text = value.trim();
  if (!text) return;
  if (!state.combos[group].includes(text)) state.combos[group].push(text);
  if (input) input.value = "";
  renderCombo(state, elements, group);
  closeSuggestions();
  markHasInput(state, elements);
}

function removeComboValue(
  state: AppState,
  elements: ReturnType<typeof getElements>,
  group: ComboId,
  value: string,
): void {
  state.combos[group] = comboValues(state, group).filter((item) => item !== value);
  renderCombo(state, elements, group);
  markHasInput(state, elements);
}

function renderCombo(
  state: AppState,
  elements: ReturnType<typeof getElements>,
  group: ComboId,
): void {
  const box = safe$<HTMLElement>(`[data-combo="${group}"]`);
  if (!box) return;
  const input = $("input", box) as HTMLInputElement;
  for (const pill of $$<HTMLElement>(".pill", box)) {
    pill.remove();
  }

  for (const value of comboValues(state, group)) {
    const pill = document.createElement("span");
    pill.className = "pill";
    pill.tabIndex = -1;
    (pill.dataset as DOMStringMap & { value?: string }).value = value;
    pill.innerHTML = `<span>${value}</span>`;

    const remove = document.createElement("button");
    remove.type = "button";
    remove.textContent = "×";
    remove.setAttribute("aria-label", `${value}を削除`);
    remove.addEventListener("click", () => removeComboValue(state, elements, group, value));

    pill.addEventListener("keydown", (event) => {
      const keyboardEvent = event as KeyboardEvent;
      if (keyboardEvent.key !== "Backspace" && keyboardEvent.key !== "Delete") return;
      keyboardEvent.preventDefault();
      removeComboValue(state, elements, group, value);
      input.focus();
    });

    pill.appendChild(remove);
    box.insertBefore(pill, input);
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
    input,
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
  return Number(safe$<HTMLSelectElement>(`#${id}`)?.value ?? 0);
}

function getServingsValue(): string {
  return servingGroups
    .map(({ id, label }) => [label, getCountValue(id)] as const)
    .filter(([, count]) => count > 0)
    .map(([label, count]) => `${label}${count}人`)
    .join("、");
}

function chipItems(state: AppState, elements: ReturnType<typeof getElements>): ChipItem[] {
  const items: ChipItem[] = [];
  const addCombo = (id: ComboId) => {
    const combo = getCombo(id);
    const values = comboValues(state, id);
    if (!values.length) return;
    items.push({
      label: `${combo.chip || combo.label}: ${inlineList(values)}`,
      removable: true,
      action: () => {
        state.combos[id] = [];
        renderCombo(state, elements, id);
        markHasInput(state, elements);
      },
    });
  };

  addCombo("materials");
  const servings = getServingsValue();
  if (servings) items.push({ label: servings });
  for (const id of ["dishTypes", "cookingTools", "pairingTargets"] as ComboId[]) {
    addCombo(id);
  }
  const cookTime = getCookTimeValue();
  if (cookTime) {
    items.push({
      label: `調理時間: ${cookTime}`,
      removable: true,
      action: () => {
        $("#cookTimeRange", document).setAttribute("value", "0");
        (safe$<HTMLInputElement>("#cookTimeRange") as HTMLInputElement).value = "0";
        markHasInput(state, elements);
      },
    });
  }
  chipOrder
    .filter((id) => !["materials", "dishTypes", "cookingTools", "pairingTargets"].includes(id))
    .forEach(addCombo);

  const supplementalNotes = safe$<HTMLTextAreaElement>("#supplementalNotes")?.value.trim();
  if (supplementalNotes) {
    items.push({
      label: "補足あり",
      removable: true,
      action: () => {
        const textarea = safe$<HTMLTextAreaElement>("#supplementalNotes");
        if (textarea) textarea.value = "";
        markHasInput(state, elements);
      },
    });
  }

  return items;
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
  state: AppState,
  elements: ReturnType<typeof getElements>,
  event: Event,
): Promise<void> {
  const button = event.currentTarget as HTMLElement | null;
  if (!elements.output.value.trim()) updatePromptPreview(state, elements);
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
    const input = (event.target as Element).closest<HTMLInputElement>(".combo input");
    if (!input) return;
    if (keyboardEvent.key === "Enter") {
      keyboardEvent.preventDefault();
      commitComboInput(state, elements, input);
      return;
    }
    if (keyboardEvent.key === "ArrowDown") {
      keyboardEvent.preventDefault();
      showSuggestions(state, input);
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
    const input = safe$<HTMLInputElement>("input", button.closest(".combo") ?? document);
    if (input) openSuggestions(state, input);
  });

  elements.form.addEventListener("click", (event) => {
    const target = event.target as Element;
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
          safe$<HTMLInputElement>("input", combo),
        );
      return;
    }
    const button = target.closest<HTMLButtonElement>(".combo-picker");
    if (button) {
      const input = safe$<HTMLInputElement>("input", button.closest(".combo") ?? document);
      if (input) openSuggestions(state, input);
      return;
    }
    const combo = target.closest<HTMLElement>(".combo");
    if (combo) {
      const input = safe$<HTMLInputElement>("input", combo);
      if (input) openSuggestions(state, input);
    } else {
      closeSuggestions();
    }
  });

  elements.form.addEventListener("change", (event) => {
    const input = (event.target as Element).closest<HTMLInputElement>(".combo input");
    if (input) commitComboInput(state, elements, input);
    else markHasInput(state, elements);
  });

  elements.form.addEventListener(
    "blur",
    (event) => {
      const input = (event.target as Element).closest<HTMLInputElement>(".combo input");
      if (!input) return;
      window.setTimeout(() => {
        if (!input.closest(".combo")?.contains(document.activeElement)) {
          commitComboInput(state, elements, input);
        }
      }, 120);
    },
    true,
  );

  elements.form.addEventListener("input", (event) => {
    const input = (event.target as Element).closest<HTMLInputElement>(".combo input");
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
