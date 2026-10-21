import { sendPromptToAi } from "./ai-prompt-panel";
import type { AppElements } from "./app-elements";
import type { PromptPanelServices } from "./output-panel";
import {
  copyPrompt as copyPromptPanel,
  syncStickyFooter as syncStickyFooterPanel,
} from "./output-panel";
import type { ServingGroupId } from "./servings";
import type { AppState } from "./types";

const $ = <T extends Element>(selector: string, root: ParentNode = document): T => {
  const element = root.querySelector<T>(selector);
  if (!element) throw new Error(`Element not found: ${selector}`);
  return element;
};

let mobileSheetOpener: HTMLElement | null = null;

function wrapFocusAtBoundary(event: KeyboardEvent, root: HTMLElement): void {
  if (event.key !== "Tab") return;
  const controls = Array.from(
    root.querySelectorAll<HTMLElement>("button, input, textarea, select, a[href], [tabindex]"),
  ).filter(
    (element) =>
      element.tabIndex >= 0 && !element.matches(":disabled") && element.getClientRects().length > 0,
  );
  const first = controls[0];
  const last = controls.at(-1);
  const active = document.activeElement;
  if (first && last && (event.shiftKey ? active === first : active === last)) {
    event.preventDefault();
    (event.shiftKey ? last : first).focus();
  }
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
    innerWidth: window.innerWidth,
  });
  void services;
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

function setMobileSheetState(
  state: AppState,
  elements: AppElements,
  open: boolean,
  opener: HTMLElement | null = null,
): void {
  const wasOpen = state.mobileSheetOpen;
  state.mobileSheetOpen = open;
  document.body.classList.toggle("has-open-mobile-sheet", open);
  if (open && opener) {
    mobileSheetOpener = opener;
  }
  elements.bottom.classList.toggle("is-open", open);
  elements.bottom.setAttribute("data-state", open ? "open" : "closed");
  for (const sibling of elements.bottom.parentElement?.children ?? []) {
    if (
      sibling instanceof HTMLElement &&
      sibling !== elements.bottom &&
      sibling !== elements.bottomBackdrop
    ) {
      sibling.inert = open;
    }
  }
  if (open) {
    elements.bottom.setAttribute("role", "dialog");
    elements.bottom.setAttribute("aria-modal", "true");
    elements.bottom.setAttribute("aria-labelledby", "mobilePromptHeading");
  } else {
    elements.bottom.removeAttribute("role");
    elements.bottom.removeAttribute("aria-modal");
    elements.bottom.removeAttribute("aria-labelledby");
  }
  elements.bottomBackdrop.hidden = !open;
  elements.bottomBackdrop.classList.toggle("show", open);
  const mobilePromptPanel = $("#mobilePromptPanel");
  mobilePromptPanel.setAttribute("aria-hidden", String(!open));
  mobilePromptPanel.setAttribute("data-state", open ? "open" : "closed");

  if (open && !wasOpen) {
    elements.sheetClose.focus();
  } else if (!open && wasOpen) {
    mobileSheetOpener?.focus({ preventScroll: true });
    mobileSheetOpener = null;
  }
}

function attachBottomSheetDrag(state: AppState, elements: AppElements): void {
  const dragTarget = elements.bottomInner;
  let startY = 0;
  let deltaY = 0;
  let dragging = false;

  dragTarget.addEventListener("pointerdown", (event) => {
    dragging = false;
    const target = event.target;
    if (
      !(target instanceof Element) ||
      target.closest("input, textarea, button, select, a[href], [contenteditable]") ||
      !target.closest("#mobilePromptHeading")
    ) {
      return;
    }
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
  dragTarget.addEventListener("pointercancel", () => {
    dragging = false;
    deltaY = 0;
  });
}

export function bindAppEvents(
  state: AppState,
  elements: AppElements,
  services: PromptPanelServices,
): void {
  elements.privacyOpen.addEventListener("click", () => {
    if (state.mobileSheetOpen) setMobileSheetState(state, elements, false);
    elements.privacyDialog.showModal();
    elements.privacyClose.focus();
  });
  elements.privacyClose.addEventListener("click", () => elements.privacyDialog.close());
  elements.privacyDialog.addEventListener("keydown", (event) => {
    wrapFocusAtBoundary(event, elements.privacyDialog);
  });
  elements.privacyDialog.addEventListener("close", () => {
    elements.privacyOpen.focus({ preventScroll: true });
  });
  const isPrivacyBackdrop = (event: MouseEvent): boolean => {
    if (event.target !== elements.privacyDialog) return false;
    const bounds = elements.privacyDialog.getBoundingClientRect();
    return (
      event.clientX < bounds.left ||
      event.clientX > bounds.right ||
      event.clientY < bounds.top ||
      event.clientY > bounds.bottom
    );
  };
  let pressedPrivacyBackdrop = false;
  elements.privacyDialog.addEventListener("pointerdown", (event) => {
    pressedPrivacyBackdrop = isPrivacyBackdrop(event);
  });
  elements.privacyDialog.addEventListener("click", (event) => {
    if (pressedPrivacyBackdrop && isPrivacyBackdrop(event)) {
      elements.privacyDialog.close();
    }
    pressedPrivacyBackdrop = false;
  });

  services.openMobilePromptForCopy = (opener) => {
    setMobileSheetState(state, elements, true, opener);
  };

  const removeMaterialFromButton = (button: HTMLButtonElement): void => {
    const materialName = button.dataset["removeMaterial"];
    if (materialName) {
      services.removeComboValue("materials", materialName);
    }
  };

  elements.form.addEventListener("pointerdown", (event) => {
    const target = event.target as Element;
    const materialRemoveButton = target.closest<HTMLButtonElement>("[data-remove-material]");
    if (!materialRemoveButton) {
      return;
    }

    event.preventDefault();
    removeMaterialFromButton(materialRemoveButton);
  });

  elements.form.addEventListener("click", (event) => {
    const target = event.target as Element;
    if (target.closest(".pill")) {
      return;
    }

    const materialRemoveButton = target.closest<HTMLButtonElement>("[data-remove-material]");
    if (materialRemoveButton) {
      removeMaterialFromButton(materialRemoveButton);
      return;
    }

    const servingButton = target.closest<HTMLButtonElement>(".serving-adjust");
    if (servingButton) {
      const stepper = servingButton.closest<HTMLElement>(".serving-stepper");
      const id = (stepper?.dataset as DOMStringMap & { servingId?: ServingGroupId })?.servingId;
      const delta = servingButton.classList.contains("serving-plus") ? 1 : -1;
      if (id) {
        services.adjustServings(id, delta);
        services.onChange();
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
    services.onChange();
  });

  elements.form.addEventListener("input", () => {
    services.onChange();
  });

  window.addEventListener("resize", () => {
    if (window.innerWidth >= 1024) {
      setMobileSheetState(state, elements, false);
    }
    syncStickyFooterState(state, elements, services);
  });

  elements.sheetClose.addEventListener("click", () => setMobileSheetState(state, elements, false));
  elements.bottomBackdrop.addEventListener("click", () =>
    setMobileSheetState(state, elements, false),
  );
  window.addEventListener("keydown", (event) => {
    if (!state.mobileSheetOpen) return;
    if (event.key === "Escape") {
      setMobileSheetState(state, elements, false);
      return;
    }
    wrapFocusAtBoundary(event, elements.bottom);
  });

  for (const button of [
    elements.copyPromptSticky,
    elements.copyPromptMobile,
    elements.sendPromptMobile,
  ]) {
    button.addEventListener("pointerdown", (event) => {
      const input = document.activeElement;
      if (
        event.button === 0 &&
        input instanceof HTMLInputElement &&
        input.closest(".combo") &&
        input.dataset["composing"] !== "true"
      ) {
        // Keep the button still until click commits the draft; let active IME composition finish normally.
        event.preventDefault();
      }
    });
  }

  elements.copyPromptSticky.addEventListener(
    "click",
    (event) => void copyPromptPanel(state, elements, services, event),
  );
  elements.copyPromptMobile.addEventListener(
    "click",
    (event) => void copyPromptPanel(state, elements, services, event),
  );
  attachBottomSheetDrag(state, elements);
  const send = (): void => {
    if (state.mobileSheetOpen) setMobileSheetState(state, elements, false);
    void sendPromptToAi(elements, services);
  };
  elements.sendPromptMobile.addEventListener("click", send);
  syncStickyFooterState(state, elements, services);
}
