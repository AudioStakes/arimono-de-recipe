import type { AppElements } from "./app-elements";
import type { PromptPanelServices } from "./output-panel";
import {
  copyPrompt as copyPromptPanel,
  markUserHasInput,
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

function syncStickyFooterState(
  state: AppState,
  elements: AppElements,
  services: PromptPanelServices,
): void {
  syncStickyFooterPanel(state, elements, {
    scrollY: window.scrollY,
    innerHeight: window.innerHeight,
    documentHeight: document.documentElement.scrollHeight,
    innerWidth: window.innerWidth,
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

function setCollapsibleState(button: HTMLButtonElement, expanded: boolean): void {
  button.setAttribute("aria-expanded", String(expanded));
  const chevron = button.querySelector<HTMLElement>(".field-toggle-chevron");
  if (chevron) {
    chevron.textContent = expanded ? "⌃" : "⌄";
  }
  const panelId = button.getAttribute("aria-controls");
  if (!panelId) return;
  const panel = document.getElementById(panelId);
  if (panel) {
    panel.hidden = !expanded;
    panel.setAttribute("data-state", expanded ? "open" : "closed");
  }
  const field = button.closest<HTMLElement>(".field-collapsible");
  field?.classList.toggle("is-open", expanded);
  if (field) {
    field.setAttribute("data-state", expanded ? "open" : "closed");
  }
}

function setMobileSheetState(state: AppState, elements: AppElements, open: boolean): void {
  state.mobileSheetOpen = open;
  elements.bottom.classList.toggle("is-open", open);
  elements.bottom.setAttribute("data-state", open ? "open" : "closed");
  elements.bottomBackdrop.hidden = !open;
  elements.bottomBackdrop.classList.toggle("show", open);
  elements.sheetToggle.setAttribute("aria-expanded", String(open));
  elements.sheetExpand.setAttribute("aria-expanded", String(open));
  elements.sheetExpand.setAttribute(
    "aria-label",
    open ? "レシピ依頼文全文を閉じる" : "レシピ依頼文全文を表示",
  );
  const mobilePromptPanel = $("#mobilePromptPanel");
  mobilePromptPanel.setAttribute("aria-hidden", String(!open));
  mobilePromptPanel.setAttribute("data-state", open ? "open" : "closed");
}

function attachBottomSheetDrag(state: AppState, elements: AppElements): void {
  const dragTarget = elements.bottomInner;
  let startY = 0;
  let deltaY = 0;
  let dragging = false;

  dragTarget.addEventListener("pointerdown", (event) => {
    startY = event.clientY;
    deltaY = 0;
    dragging = true;
  });

  dragTarget.addEventListener("pointermove", (event) => {
    if (!dragging) return;
    deltaY = event.clientY - startY;
  });

  const finishDrag = (): void => {
    if (!dragging) return;
    dragging = false;
    if (deltaY < -36) {
      setMobileSheetState(state, elements, true);
      return;
    }
    if (deltaY > 36) {
      setMobileSheetState(state, elements, false);
    }
  };

  dragTarget.addEventListener("pointerup", finishDrag);
  dragTarget.addEventListener("pointercancel", finishDrag);
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

    const fieldToggle = target.closest<HTMLButtonElement>(".field-toggle");
    if (fieldToggle) {
      const expanded = fieldToggle.getAttribute("aria-expanded") === "true";
      setCollapsibleState(fieldToggle, !expanded);
    }
  });

  elements.form.addEventListener("change", () => {
    markUserInput(state, elements, services);
  });

  elements.form.addEventListener("input", () => {
    markUserInput(state, elements, services);
  });

  window.addEventListener("resize", () => {
    if (window.innerWidth >= 1024) {
      setMobileSheetState(state, elements, false);
    }
    syncStickyFooterState(state, elements, services);
  });

  elements.sheetToggle.addEventListener("click", () => setMobileSheetState(state, elements, true));
  elements.sheetExpand.addEventListener("click", () => setMobileSheetState(state, elements, true));
  elements.sheetClose.addEventListener("click", () => setMobileSheetState(state, elements, false));
  elements.bottomBackdrop.addEventListener("click", () =>
    setMobileSheetState(state, elements, false),
  );

  $("#copyPrompt").addEventListener(
    "click",
    (event) => void copyPromptPanel(state, elements, services, event),
  );
  $("#copyPromptSticky").addEventListener(
    "click",
    (event) => void copyPromptPanel(state, elements, services, event),
  );

  attachBottomSheetDrag(state, elements);
  syncStickyFooterState(state, elements, services);
}
