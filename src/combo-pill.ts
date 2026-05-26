import type { AppState, ComboId } from "./types";

type ImeDataset = DOMStringMap & {
  composing?: string;
  suppressBlurCommit?: string;
};

type ComboPillHandlers = {
  isImeComposing: (input: HTMLInputElement, event: KeyboardEvent) => boolean;
  markCompositionEnded: (input: HTMLInputElement | null) => void;
  startEditing: (state: AppState, group: ComboId, value: string) => void;
  finishEditing: (
    state: AppState,
    group: ComboId,
    value: string,
    input: HTMLInputElement,
    options?: { focusAfterSave?: boolean },
  ) => void;
  cancelEditing: (state: AppState, group: ComboId, value: string) => void;
  removeValue: (state: AppState, group: ComboId, value: string) => void;
};

export function createComboPill(
  state: AppState,
  group: ComboId,
  value: string,
  editing: boolean,
  input: HTMLInputElement | null,
  handlers: ComboPillHandlers,
): HTMLElement {
  const pill = document.createElement("span");
  pill.className = "pill";
  pill.tabIndex = -1;
  (pill.dataset as DOMStringMap & { value?: string }).value = value;

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
        if (handlers.isImeComposing(editInput, keyboardEvent)) {
          return;
        }
        keyboardEvent.preventDefault();
        dataset.suppressBlurCommit = "true";
        handlers.finishEditing(state, group, value, editInput, { focusAfterSave: true });
        return;
      }
      if (keyboardEvent.key === "Escape") {
        keyboardEvent.preventDefault();
        dataset.suppressBlurCommit = "true";
        handlers.cancelEditing(state, group, value);
      }
    });

    editInput.addEventListener("compositionstart", () => {
      const dataset = editInput.dataset as ImeDataset;
      dataset.composing = "true";
    });
    editInput.addEventListener("compositionend", () => {
      handlers.markCompositionEnded(editInput);
    });
    editInput.addEventListener("blur", () => {
      if (dataset.suppressBlurCommit === "true") {
        return;
      }
      window.setTimeout(() => {
        if (pill.contains(document.activeElement)) {
          return;
        }
        handlers.finishEditing(state, group, value, editInput);
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
      handlers.startEditing(state, group, value);
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
    handlers.removeValue(state, group, value);
  });

  pill.addEventListener("keydown", (event) => {
    const keyboardEvent = event as KeyboardEvent;
    if (keyboardEvent.key === "Enter" && !editing && event.target === pill) {
      keyboardEvent.preventDefault();
      handlers.startEditing(state, group, value);
      return;
    }
    if (keyboardEvent.key !== "Backspace" && keyboardEvent.key !== "Delete") return;
    keyboardEvent.preventDefault();
    const dataset = pill.dataset as DOMStringMap & { armedDelete?: string };
    if (dataset.armedDelete === "true") {
      return;
    }
    handlers.removeValue(state, group, value);
    input?.focus({ preventScroll: true });
  });

  pill.appendChild(remove);
  return pill;
}
