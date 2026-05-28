import { updateComboValues } from "./combo-values";
import { comboOptionSets, combos } from "./data";
import { filterAvailableComboOptions } from "./suggestions";
import type { ComboId } from "./types";

type ImeDataset = DOMStringMap & {
  composing?: string;
  justComposed?: string;
  skipBlurCommit?: string;
};

type PendingDeleteDataset = DOMStringMap & {
  armedDelete?: string;
};

type ComboRegistryOptions = {
  onChange?: () => void;
};

type ComboController = ReturnType<typeof createComboController>;

const $$ = <T extends Element>(selector: string, root: ParentNode = document): T[] => [
  ...root.querySelectorAll<T>(selector),
];

const safe$ = <T extends Element>(selector: string, root: ParentNode = document): T | null =>
  root.querySelector<T>(selector);

function getSuggestionAriaLabel(value: string): string {
  return value === "高野豆腐" ? "高野とうふ" : value;
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

export function isImeComposing(
  input: HTMLInputElement | null | undefined,
  event: Pick<KeyboardEvent, "isComposing" | "keyCode">,
): boolean {
  const dataset = input?.dataset as ImeDataset | undefined;

  return Boolean(
    event.isComposing ||
      event.keyCode === 229 ||
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

export function getComboOptionValues(group: ComboId): string[] {
  const combo = combos.find((item) => item.id === group);
  if (!combo) {
    throw new Error(`Combo not found: ${group}`);
  }
  const values = comboOptionSets[combo.optionSet] ?? [];
  return combo.optionSet === "materials"
    ? [...values].sort((a, b) => a.localeCompare(b, "ja"))
    : values;
}

function createComboController(
  root: HTMLElement,
  group: ComboId,
  notifyChange: () => void,
  closeOthers: (except: HTMLElement | null) => void,
) {
  let values: string[] = [];
  let editingValue: string | null = null;

  const input = safe$<HTMLInputElement>(".combo-input", root);
  const panel = safe$<HTMLElement>(".suggestions", root);
  const chipRow = safe$<HTMLElement>(".floating-chip-row", root);
  if (!input || !panel || !chipRow) {
    throw new Error(`Combo UI is incomplete: ${group}`);
  }
  const comboInput = input;
  const suggestionPanel = panel;
  const floatingChipRow = chipRow;

  function isEditing(value: string): boolean {
    return editingValue === value;
  }

  function renderPills(): void {
    for (const pill of $$<HTMLElement>(".pill", root)) {
      pill.remove();
    }

    for (const value of values) {
      floatingChipRow.appendChild(createPill(value));
    }

    root.classList.toggle("has-values", values.length > 0);
  }

  function focusComboValue(value: string): void {
    const pill = safe$<HTMLElement>(`.pill[data-value="${CSS.escape(value)}"]`, root);
    const label = pill ? safe$<HTMLButtonElement>(".pill-label", pill) : null;
    if (label) {
      label.focus({ preventScroll: true });
      return;
    }
    comboInput.focus({ preventScroll: true });
  }

  function closeSuggestions(): void {
    suggestionPanel.classList.remove("show");
    comboInput.setAttribute("aria-expanded", "false");
  }

  function renderSuggestions(): HTMLButtonElement[] {
    const query = comboInput.value.trim();
    const options = filterAvailableComboOptions(getComboOptionValues(group), query, values);

    suggestionPanel.innerHTML = options.length
      ? options
          .map(
            (value) =>
              `<button type="button" class="suggestion-option" tabindex="-1" data-value="${value}" role="option" aria-label="${getSuggestionAriaLabel(value)}">${value}</button>`,
          )
          .join("")
      : '<div class="suggestion-empty">候補がありません</div>';

    closeOthers(suggestionPanel);
    suggestionPanel.classList.add("show");
    comboInput.setAttribute("aria-expanded", "true");
    return $$<HTMLButtonElement>(".suggestion-option", suggestionPanel);
  }

  function addValue(value: string, options: { refocusInput?: boolean } = {}): void {
    const text = value.trim();
    if (!text) {
      return;
    }
    if (!values.includes(text)) {
      values = [...values, text];
    }
    comboInput.value = "";
    renderPills();
    closeOthers(null);
    if (options.refocusInput) {
      focusInputAtEnd(comboInput);
    }
    notifyChange();
  }

  function removeValue(value: string): void {
    values = values.filter((item) => item !== value);
    if (editingValue === value) {
      editingValue = null;
    }
    renderPills();
    notifyChange();
    comboInput.focus({ preventScroll: true });
  }

  function startEditing(value: string): void {
    editingValue = value;
    renderPills();
    closeOthers(null);
    const editInput = safe$<HTMLInputElement>(
      `.pill[data-value="${CSS.escape(value)}"] .pill-edit-input`,
      root,
    );
    if (!editInput) {
      return;
    }
    editInput.focus({ preventScroll: true });
    editInput.select();
  }

  function finishEditing(
    oldValue: string,
    editInput: HTMLInputElement,
    options: { focusAfterSave?: boolean } = {},
  ): void {
    const nextValues = updateComboValues(values, oldValue, editInput.value);
    const nextValue = editInput.value.trim();
    const changed = nextValues !== values;
    values = nextValues;
    editingValue = null;
    renderPills();

    if (options.focusAfterSave) {
      focusComboValue(nextValues.includes(nextValue) ? nextValue : oldValue);
    }

    if (changed) {
      notifyChange();
    }
  }

  function cancelEditing(oldValue: string): void {
    editingValue = null;
    renderPills();
    focusComboValue(oldValue);
  }

  function createPill(value: string): HTMLElement {
    const pill = document.createElement("span");
    pill.className = "pill";
    pill.tabIndex = -1;
    (pill.dataset as DOMStringMap & { value?: string }).value = value;

    if (isEditing(value)) {
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
          finishEditing(value, editInput, { focusAfterSave: true });
          return;
        }
        if (keyboardEvent.key === "Escape") {
          keyboardEvent.preventDefault();
          dataset.suppressBlurCommit = "true";
          cancelEditing(value);
        }
      });

      editInput.addEventListener("compositionstart", () => {
        const nextDataset = editInput.dataset as ImeDataset;
        nextDataset.composing = "true";
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
          finishEditing(value, editInput);
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
        startEditing(value);
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
      removeValue(value);
    });

    pill.addEventListener("keydown", (event) => {
      const keyboardEvent = event as KeyboardEvent;
      if (keyboardEvent.key === "Enter" && !isEditing(value) && event.target === pill) {
        keyboardEvent.preventDefault();
        startEditing(value);
        return;
      }
      if (keyboardEvent.key !== "Backspace" && keyboardEvent.key !== "Delete") {
        return;
      }
      keyboardEvent.preventDefault();
      const dataset = pill.dataset as PendingDeleteDataset;
      if (dataset.armedDelete === "true") {
        return;
      }
      removeValue(value);
    });

    pill.appendChild(remove);
    return pill;
  }

  function focusAdjacentSuggestion(current: HTMLButtonElement, delta: number): boolean {
    const options = $$<HTMLButtonElement>(".suggestion-option", suggestionPanel);
    const index = options.indexOf(current);
    if (index < 0) {
      return false;
    }
    if (delta < 0 && index === 0) {
      focusInputAtEnd(comboInput);
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
    if (!next) {
      return false;
    }
    const dataset = comboInput.dataset as ImeDataset;
    dataset.skipBlurCommit = "true";
    next.focus({ preventScroll: true });
    window.requestAnimationFrame(() => {
      dataset.skipBlurCommit = "false";
    });
    return true;
  }

  function focusPreviousPill(): boolean {
    if (comboInput.value) {
      return false;
    }
    const pills = $$<HTMLElement>(".pill", root);
    const target = pills[pills.length - 1];
    if (!target) {
      return false;
    }
    for (const pill of pills) {
      pill.classList.remove("pending-delete");
    }
    target.classList.add("pending-delete");
    const dataset = target.dataset as PendingDeleteDataset;
    dataset.armedDelete = "true";
    window.setTimeout(() => {
      if (dataset.armedDelete === "true") {
        dataset.armedDelete = "false";
      }
    }, 120);
    target.focus();
    return true;
  }

  function commitInput(): void {
    addValue(comboInput.value);
    requestAnimationFrame(() => {
      comboInput.value = "";
    });
  }

  return {
    id: group,
    root,
    contains(node: Node | null): boolean {
      return Boolean(node && root.contains(node));
    },
    getInput(): HTMLInputElement {
      return comboInput;
    },
    getValues(): string[] {
      return [...values];
    },
    clearValues(): void {
      values = [];
      editingValue = null;
      renderPills();
      closeSuggestions();
    },
    clearEditing(): void {
      if (editingValue === null) {
        return;
      }
      editingValue = null;
      renderPills();
    },
    render(): void {
      renderPills();
    },
    closeSuggestions,
    openSuggestions(): HTMLButtonElement[] {
      comboInput.focus({ preventScroll: true });
      return renderSuggestions();
    },
    showSuggestions(): HTMLButtonElement[] {
      return renderSuggestions();
    },
    handleOptionKeydown(option: HTMLButtonElement, event: KeyboardEvent): boolean {
      if (event.key === "Enter") {
        event.preventDefault();
        const value = (option.dataset as DOMStringMap & { value?: string }).value;
        if (value) {
          addValue(value, { refocusInput: true });
        }
        return true;
      }
      if (event.key === "ArrowDown") {
        event.preventDefault();
        return focusAdjacentSuggestion(option, 1);
      }
      if (event.key === "ArrowUp") {
        event.preventDefault();
        return focusAdjacentSuggestion(option, -1);
      }
      if (event.key === "Escape") {
        event.preventDefault();
        closeSuggestions();
        comboInput.focus({ preventScroll: true });
        return true;
      }
      return false;
    },
    handleInputKeydown(event: KeyboardEvent): boolean {
      if (event.key === "Enter") {
        if (isImeComposing(comboInput, event)) {
          return true;
        }
        event.preventDefault();
        commitInput();
        return true;
      }
      if (event.key === "ArrowDown") {
        event.preventDefault();
        const options = renderSuggestions();
        if (options[0]) {
          options[0].focus({ preventScroll: true });
        }
        return true;
      }
      if (event.key === "Escape") {
        closeSuggestions();
        return true;
      }
      if ((event.key === "Backspace" || event.key === "Delete") && !comboInput.value) {
        if (focusPreviousPill()) {
          event.preventDefault();
          return true;
        }
      }
      return false;
    },
    handleOptionClick(option: HTMLElement): boolean {
      const value = (option.dataset as DOMStringMap & { value?: string }).value;
      if (!value) {
        return false;
      }
      addValue(value, { refocusInput: true });
      return true;
    },
    handleComboClick(target: Element): boolean {
      if (target.closest(".pill")) {
        return true;
      }
      comboInput.focus({ preventScroll: true });
      renderSuggestions();
      return true;
    },
    markCompositionStart(): void {
      const dataset = comboInput.dataset as ImeDataset;
      dataset.composing = "true";
    },
    markCompositionEnd(): void {
      markCompositionEnded(comboInput);
      renderSuggestions();
    },
    handleCompositionUpdate(): void {
      window.requestAnimationFrame(() => {
        renderSuggestions();
      });
    },
    handleFocusOut(relatedTarget: Node | null): void {
      if (relatedTarget && root.contains(relatedTarget)) {
        return;
      }
      window.setTimeout(() => {
        const dataset = comboInput.dataset as ImeDataset;
        if (dataset.skipBlurCommit === "true") {
          dataset.skipBlurCommit = "false";
          return;
        }
        if (!root.contains(document.activeElement)) {
          commitInput();
          closeSuggestions();
        }
      }, 120);
    },
    handleInput(): void {
      renderSuggestions();
    },
  };
}

export type ComboRegistry = ReturnType<typeof createComboRegistry>;

export function createComboRegistry(root: ParentNode, options: ComboRegistryOptions = {}) {
  let notifyChange = options.onChange ?? (() => {});
  const controllers = new Map<ComboId, ComboController>();

  const closeSuggestions = (except: HTMLElement | null = null): void => {
    for (const controller of controllers.values()) {
      const panel = safe$<HTMLElement>(".suggestions", controller.root);
      if (panel && panel === except) {
        continue;
      }
      controller.closeSuggestions();
    }
  };

  for (const element of $$<HTMLElement>(".combo[data-combo]", root)) {
    const id = (element.dataset as DOMStringMap & { combo?: ComboId }).combo;
    if (!id) {
      continue;
    }
    controllers.set(
      id,
      createComboController(element, id, () => notifyChange(), closeSuggestions),
    );
  }

  const controllerFromTarget = (target: EventTarget | null): ComboController | null => {
    const element = target as Element | null;
    const combo = element?.closest<HTMLElement>(".combo");
    const id = combo ? (combo.dataset as DOMStringMap & { combo?: ComboId }).combo : undefined;
    return id ? (controllers.get(id) ?? null) : null;
  };

  const handleKeydown = (event: KeyboardEvent): boolean => {
    const target = event.target as Element | null;
    const option = target?.closest<HTMLButtonElement>(".suggestion-option");
    const controller = controllerFromTarget(event.target);
    if (option && controller) {
      return controller.handleOptionKeydown(option, event);
    }
    if (!controller) {
      return false;
    }
    return controller.handleInputKeydown(event);
  };

  const handlePointerDown = (target: Element): boolean => {
    const button = target.closest<HTMLButtonElement>(".combo-picker");
    const controller = controllerFromTarget(button ?? target);
    if (!button || !controller) {
      return false;
    }
    controller.openSuggestions();
    return true;
  };

  const handleClick = (target: Element): boolean => {
    const option = target.closest<HTMLElement>(".suggestion-option");
    if (option) {
      const controller = controllerFromTarget(option);
      return controller ? controller.handleOptionClick(option) : false;
    }

    const button = target.closest<HTMLButtonElement>(".combo-picker");
    if (button) {
      const controller = controllerFromTarget(button);
      if (!controller) {
        return false;
      }
      controller.openSuggestions();
      return true;
    }

    const controller = controllerFromTarget(target);
    if (controller) {
      return controller.handleComboClick(target);
    }

    closeSuggestions();
    return false;
  };

  const handleCompositionStart = (target: EventTarget | null): boolean => {
    const controller = controllerFromTarget(target);
    if (!controller) {
      return false;
    }
    controller.markCompositionStart();
    return true;
  };

  const handleCompositionEnd = (target: EventTarget | null): boolean => {
    const controller = controllerFromTarget(target);
    if (!controller) {
      return false;
    }
    controller.markCompositionEnd();
    return true;
  };

  const handleCompositionUpdate = (target: EventTarget | null): boolean => {
    const controller = controllerFromTarget(target);
    if (!controller) {
      return false;
    }
    controller.handleCompositionUpdate();
    return true;
  };

  const handleFocusOut = (event: FocusEvent): boolean => {
    const controller = controllerFromTarget(event.target);
    if (!controller) {
      return false;
    }
    controller.handleFocusOut(event.relatedTarget as Node | null);
    return true;
  };

  const handleInput = (target: EventTarget | null): boolean => {
    const controller = controllerFromTarget(target);
    if (!controller) {
      return false;
    }
    controller.handleInput();
    return true;
  };

  return {
    setOnChange(handler: () => void): void {
      notifyChange = handler;
    },
    bind(form: HTMLElement): void {
      form.addEventListener("keydown", (event) => {
        const keyboardEvent = event as KeyboardEvent;
        const target = event.target as Element | null;
        if (!target?.closest(".combo, .suggestion-option")) {
          return;
        }
        handleKeydown(keyboardEvent);
      });

      form.addEventListener("pointerdown", (event) => {
        const target = event.target as Element;
        if (!target.closest(".combo-picker")) {
          return;
        }
        event.preventDefault();
        handlePointerDown(target);
      });

      form.addEventListener("click", (event) => {
        handleClick(event.target as Element);
      });

      form.addEventListener("compositionstart", (event) => {
        handleCompositionStart(event.target);
      });

      form.addEventListener("compositionend", (event) => {
        handleCompositionEnd(event.target);
      });

      form.addEventListener("compositionupdate", (event) => {
        handleCompositionUpdate(event.target);
      });

      form.addEventListener("focusout", (event) => {
        handleFocusOut(event as FocusEvent);
      });

      form.addEventListener("input", (event) => {
        handleInput(event.target);
      });
    },
    getValues(group: ComboId): string[] {
      return controllers.get(group)?.getValues() ?? [];
    },
    clear(group: ComboId): void {
      controllers.get(group)?.clearValues();
    },
  };
}
