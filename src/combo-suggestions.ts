import { combos, optionSets } from "./data";
import { filterComboOptions } from "./suggestions";
import type { AppState, ComboId } from "./types";

type ImeDataset = DOMStringMap & {
  skipBlurCommit?: string;
};

const $$ = <T extends Element>(selector: string, root: ParentNode = document): T[] => [
  ...root.querySelectorAll<T>(selector),
];

const safe$ = <T extends Element>(selector: string, root: ParentNode = document): T | null =>
  root.querySelector<T>(selector);

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

export function comboOptionValues(group: ComboId): string[] {
  const combo = combos.find((item) => item.id === group);
  if (!combo) throw new Error(`Combo not found: ${group}`);
  const values = optionSets[combo.optionSet] ?? [];
  return combo.optionSet === "materials"
    ? [...values].sort((a, b) => a.localeCompare(b, "ja"))
    : values;
}

function comboValues(state: AppState, id: ComboId): string[] {
  return state.combos[id] ?? [];
}

export function closeSuggestions(except?: HTMLElement | null): void {
  for (const element of $$<HTMLElement>(".suggestions.show")) {
    if (element === except) continue;
    element.classList.remove("show");
    const input = safe$<HTMLInputElement>(".combo-input", element.closest(".combo") ?? document);
    input?.setAttribute("aria-expanded", "false");
  }
}

export function focusAdjacentSuggestion(
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

export function showSuggestions(state: AppState, input: HTMLInputElement): HTMLButtonElement[] {
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
