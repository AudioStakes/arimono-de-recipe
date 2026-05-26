import { adjustServingValue } from "./serving-controls";
import {
  addComboValue,
  closeSuggestions,
  commitComboInput,
  focusAdjacentSuggestion,
  focusPreviousPill,
  isImeComposing,
  markComboCompositionEnded,
  setComboChangeHandler,
  showSuggestions,
} from "./combo-field";
import {
  copyPrompt as copyPromptPanel,
  markPromptHasInput,
  scrollToPrompt as scrollToPromptPanel,
  syncStickyFooter as syncStickyFooterPanel,
} from "./output-panel";
import type { PromptPanelServices } from "./output-panel";
import type { AppState, ComboId } from "./types";
import type { AppElements } from "./app-elements";
import type { ServingGroupId } from "./servings";

type ImeDataset = DOMStringMap & {
  composing?: string;
  skipBlurCommit?: string;
};

const safe$ = <T extends Element>(selector: string, root: ParentNode = document): T | null =>
  root.querySelector<T>(selector);

const $ = <T extends Element>(selector: string, root: ParentNode = document): T => {
  const element = root.querySelector<T>(selector);
  if (!element) throw new Error(`Element not found: ${selector}`);
  return element;
};

function getMainComboInput(box: HTMLElement): HTMLInputElement | null {
  return safe$<HTMLInputElement>(".combo-input", box);
}

function openSuggestions(state: AppState, input: HTMLInputElement): void {
  input.focus({ preventScroll: true });
  showSuggestions(state, input);
}

function updateAdvancedTitle(elements: AppElements): void {
  elements.advancedTitle.textContent = elements.advancedDetails.open
    ? "こだわり条件"
    : "こだわり条件を追加";
}

function updateStickyState(state: AppState, elements: AppElements, services: PromptPanelServices): void {
  syncStickyFooterPanel(state, elements, {
    scrollY: window.scrollY,
    innerHeight: window.innerHeight,
    documentHeight: document.documentElement.scrollHeight,
  });
  void services;
}

function markHasInput(
  state: AppState,
  elements: AppElements,
  services: PromptPanelServices,
): void {
  markPromptHasInput(state, elements, services);
}

export function bindAppEvents(
  state: AppState,
  elements: AppElements,
  services: PromptPanelServices,
): void {
  setComboChangeHandler(() => markHasInput(state, elements, services));

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
        input.focus({ preventScroll: true });
        return;
      }
    }

    if (!input) return;

    if (keyboardEvent.key === "Enter") {
      if (isImeComposing(input, keyboardEvent)) {
        return;
      }
      keyboardEvent.preventDefault();
      commitComboInput(state, input);
      return;
    }
    if (keyboardEvent.key === "ArrowDown") {
      keyboardEvent.preventDefault();
      const options = showSuggestions(state, input);
      if (options[0]) {
        options[0].focus({ preventScroll: true });
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
        markHasInput(state, elements, services);
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
    markHasInput(state, elements, services);
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

    markComboCompositionEnded(input);
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
        commitComboInput(state, input);
        closeSuggestions();
      }
    }, 120);
  });

  elements.form.addEventListener("input", (event) => {
    const input = (event.target as Element).closest<HTMLInputElement>(".combo-input");
    if (input) showSuggestions(state, input);
    markHasInput(state, elements, services);
  });

  window.addEventListener(
    "scroll",
    () => {
      if (state.ticking) return;
      state.ticking = true;
      requestAnimationFrame(() => {
        updateStickyState(state, elements, services);
        state.ticking = false;
      });
    },
    { passive: true },
  );

  window.addEventListener("resize", () => updateStickyState(state, elements, services));
  elements.advancedDetails.addEventListener("toggle", () => updateAdvancedTitle(elements));
  elements.inlineButton.addEventListener("click", () => scrollToPromptPanel(state, elements, services));
  elements.stickyButton.addEventListener("click", () => scrollToPromptPanel(state, elements, services));
  $("#copyPrompt").addEventListener("click", (event) => void copyPromptPanel(state, elements, services, event));
  $("#copyPromptSticky").addEventListener(
    "click",
    (event) => void copyPromptPanel(state, elements, services, event),
  );

  if ("IntersectionObserver" in window) {
    new IntersectionObserver(
      (entries) => {
        state.inlineVisible = entries.some((entry) => entry.isIntersecting);
        updateStickyState(state, elements, services);
      },
      { threshold: 0.08 },
    ).observe(elements.inlineButton);
  }
}
