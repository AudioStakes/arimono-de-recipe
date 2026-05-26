import { cookTimeOptions } from "./data";
import { updateComboValues } from "./combo-values";
import { createComboPill } from "./combo-pill";
import { closeSuggestions } from "./combo-suggestions";
export {
  closeSuggestions,
  comboOptionValues,
  focusAdjacentSuggestion,
  showSuggestions,
} from "./combo-suggestions";
import type { AppState, ComboId } from "./types";

const $$ = <T extends Element>(selector: string, root: ParentNode = document): T[] => [
  ...root.querySelectorAll<T>(selector),
];

const safe$ = <T extends Element>(selector: string, root: ParentNode = document): T | null =>
  root.querySelector<T>(selector);

type ImeDataset = DOMStringMap & {
  composing?: string;
  justComposed?: string;
  skipBlurCommit?: string;
};

type ChangeNotify = () => void;
let changeNotify: ChangeNotify = () => {};

export function setComboChangeHandler(handler: ChangeNotify): void {
  changeNotify = handler;
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

export function markComboCompositionEnded(input: HTMLInputElement | null): void {
  markCompositionEnded(input);
}

function getMainComboInput(box: HTMLElement): HTMLInputElement | null {
  return safe$<HTMLInputElement>(".combo-input", box);
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

function getEditingState(state: AppState, group: ComboId, value: string): boolean {
  return state.editingCombo?.group === group && state.editingCombo.value === value;
}

function comboValues(state: AppState, id: ComboId): string[] {
  return state.combos[id] ?? [];
}

export function renderCombo(state: AppState, group: ComboId): void {
  const box = safe$<HTMLElement>(`[data-combo="${group}"]`);
  if (!box) return;
  const input = getMainComboInput(box);
  for (const pill of $$<HTMLElement>(".pill", box)) {
    pill.remove();
  }

  for (const value of comboValues(state, group)) {
    box.insertBefore(
      createComboPill(state, group, value, getEditingState(state, group, value), input, {
        isImeComposing,
        markCompositionEnded,
        startEditing: startComboEditing,
        finishEditing: finishComboEditing,
        cancelEditing: cancelComboEditing,
        removeValue: removeComboValue,
      }),
      input ?? null,
    );
  }
}

export function addComboValue(
  state: AppState,
  group: ComboId,
  value: string,
  input?: HTMLInputElement | null,
  options: { refocusInput?: boolean } = {},
  notifyChange: ChangeNotify = changeNotify,
): void {
  const text = value.trim();
  if (!text) return;
  if (!state.combos[group].includes(text)) state.combos[group].push(text);
  if (input) input.value = "";
  renderCombo(state, group);
  closeSuggestions();
  if (input && options.refocusInput) {
    focusInputAtEnd(input);
  }
  notifyChange();
}

export function startComboEditing(state: AppState, group: ComboId, value: string): void {
  state.editingCombo = { group, value };
  renderCombo(state, group);
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

export function finishComboEditing(
  state: AppState,
  group: ComboId,
  oldValue: string,
  input: HTMLInputElement,
  options: { focusAfterSave?: boolean } = {},
  notifyChange: ChangeNotify = changeNotify,
): void {
  const values = comboValues(state, group);
  const nextValues = updateComboValues(values, oldValue, input.value);
  const nextValue = input.value.trim();
  state.editingCombo = null;

  if (nextValues !== values) {
    state.combos[group] = nextValues;
  }

  renderCombo(state, group);

  if (options.focusAfterSave) {
    focusComboValue(group, nextValues.includes(nextValue) ? nextValue : oldValue);
  }

  if (nextValues !== values) {
    notifyChange();
  }
}

export function cancelComboEditing(state: AppState, group: ComboId, oldValue: string): void {
  state.editingCombo = null;
  renderCombo(state, group);
  focusComboValue(group, oldValue);
}

export function focusComboValue(group: ComboId, value: string): void {
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

export function removeComboValue(
  state: AppState,
  group: ComboId,
  value: string,
  notifyChange: ChangeNotify = changeNotify,
): void {
  state.combos[group] = comboValues(state, group).filter((item) => item !== value);
  if (getEditingState(state, group, value)) {
    state.editingCombo = null;
  }
  renderCombo(state, group);
  notifyChange();
  const box = safe$<HTMLElement>(`[data-combo="${group}"]`);
  getMainComboInput(box ?? document.body)?.focus({ preventScroll: true });
}

export function commitComboInput(
  state: AppState,
  input: HTMLInputElement,
  notifyChange: ChangeNotify = changeNotify,
): void {
  const box = input.closest<HTMLElement>(".combo");
  if (!box) return;
  addComboValue(
    state,
    (box.dataset as DOMStringMap & { combo?: ComboId }).combo as ComboId,
    input.value,
    undefined,
    {},
    notifyChange,
  );
  requestAnimationFrame(() => {
    input.value = "";
  });
}

export function focusPreviousPill(input: HTMLInputElement): boolean {
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

export function getCookTimeValue(): string {
  const range = safe$<HTMLInputElement>("#cookTimeRange");
  return range ? (cookTimeOptions[Number(range.value)] ?? "") : "";
}

export function updateCookTimeDisplay(): void {
  const label = safe$<HTMLElement>("#cookTimeLabel");
  if (label) label.textContent = getCookTimeValue() || "指定なし";
}
