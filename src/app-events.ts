import type { AppElements } from "./app-elements";
import type { PromptPanelServices } from "./output-panel";
import {
  copyPrompt as copyPromptPanel,
  markUserHasInput,
  scrollToPrompt as scrollToPromptPanel,
  syncStickyFooter as syncStickyFooterPanel,
} from "./output-panel";
import { adjustServingValue } from "./serving-controls";
import type { ServingGroupId } from "./servings";
import type { AppState } from "./types";

const $ = <T extends Element>(selector: string, root: ParentNode = document): T => {
  const element = root.querySelector<T>(selector);
  if (!element) throw new Error(`Element not found: ${selector}`);
  return element;
};

function syncAdvancedTitle(elements: AppElements): void {
  elements.advancedTitle.textContent = elements.advancedDetails.open
    ? "こだわり条件"
    : "こだわり条件を追加";
}

function syncStickyFooterState(
  state: AppState,
  elements: AppElements,
  services: PromptPanelServices,
): void {
  syncStickyFooterPanel(state, elements, {
    scrollY: window.scrollY,
    innerHeight: window.innerHeight,
    documentHeight: document.documentElement.scrollHeight,
  });
  void services;
}

function markUserInput(
  state: AppState,
  elements: AppElements,
  services: PromptPanelServices,
): void {
  markUserHasInput(state, elements, services);
}

export function bindAppEvents(
  state: AppState,
  elements: AppElements,
  services: PromptPanelServices,
): void {
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
        markUserInput(state, elements, services);
      }
      return;
    }
  });

  elements.form.addEventListener("change", () => {
    markUserInput(state, elements, services);
  });

  elements.form.addEventListener("input", (_event) => {
    markUserInput(state, elements, services);
  });

  window.addEventListener(
    "scroll",
    () => {
      if (state.ticking) return;
      state.ticking = true;
      requestAnimationFrame(() => {
        syncStickyFooterState(state, elements, services);
        state.ticking = false;
      });
    },
    { passive: true },
  );

  window.addEventListener("resize", () => syncStickyFooterState(state, elements, services));
  elements.advancedDetails.addEventListener("toggle", () => syncAdvancedTitle(elements));
  elements.inlineButton.addEventListener("click", () =>
    scrollToPromptPanel(state, elements, services),
  );
  elements.stickyButton.addEventListener("click", () =>
    scrollToPromptPanel(state, elements, services),
  );
  $("#copyPrompt").addEventListener(
    "click",
    (event) => void copyPromptPanel(state, elements, services, event),
  );
  $("#copyPromptSticky").addEventListener(
    "click",
    (event) => void copyPromptPanel(state, elements, services, event),
  );

  if ("IntersectionObserver" in window) {
    new IntersectionObserver(
      (entries) => {
        state.inlineVisible = entries.some((entry) => entry.isIntersecting);
        syncStickyFooterState(state, elements, services);
      },
      { threshold: 0.08 },
    ).observe(elements.inlineButton);
  }
}
