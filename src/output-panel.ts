import { buildConditionChipSpecs } from "./chips";
import type { RecipeApplication } from "./recipe-application";
import type { ServingGroupId } from "./servings";
import { getStickyFooterView } from "./sticky-footer";
import type { ChipItem, ComboId, PromptData } from "./types";

type PromptPanelElements = {
  output: HTMLTextAreaElement;
  mobileOutput: HTMLTextAreaElement;
  bottom: HTMLElement;
  chips: Element;
  copyPromptSticky: HTMLElement;
  copyPromptMobile: HTMLElement;
};

type PromptPanelState = {
  hasUserInput: boolean;
  inlineVisible: boolean;
  nearBottom: boolean;
};

type ViewportMetrics = {
  scrollY: number;
  innerHeight: number;
  documentHeight: number;
  innerWidth: number;
};

type ChipTone = NonNullable<ChipItem["tone"]>;

export type PromptPanelServices = {
  application: RecipeApplication;
  getPrompt: () => string;
  adjustServings: (id: ServingGroupId, delta: number) => void;
  readConditions: () => PromptData;
  flushPendingInputs: () => void;
  setHasUserInput: (value: boolean) => void;
  setNearBottom: (value: boolean) => void;
  removeComboValue: (group: ComboId, value: string) => void;
  clearCombo: (group: ComboId) => void;
  clearCookTime: () => void;
  clearSupplementalNotes: () => void;
  validateBeforeAiRecipe: () => boolean;
  openMobilePromptForCopy?: (opener: HTMLElement) => void;
  onChange: () => void;
};

const renderChips = (container: Element, items: ChipItem[]): void => {
  container.innerHTML = "";
  container.classList.toggle("show", items.length > 0);

  for (const item of items) {
    const chip = document.createElement("span");
    chip.className = "chip";
    chip.setAttribute("data-kind", item.tone ?? "condition");
    chip.appendChild(document.createTextNode(item.label));
    if (item.removable && item.action) {
      const remove = document.createElement("button");
      remove.type = "button";
      remove.className = "chip-remove";
      remove.textContent = "×";
      remove.setAttribute("aria-label", `${item.label}を削除`);
      remove.addEventListener("click", item.action);
      chip.appendChild(remove);
    }
    container.appendChild(chip);
  }
};

const prefersReducedMotion = (): boolean =>
  window.matchMedia("(prefers-reduced-motion: reduce)").matches;

async function copyText(text: string): Promise<void> {
  if (navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(text);
    return;
  }

  const fallback = document.createElement("textarea");
  fallback.value = text;
  fallback.setAttribute("readonly", "");
  fallback.className = "clipboard-fallback";
  document.body.appendChild(fallback);
  const previousFocus = document.activeElement;
  let copied = false;
  try {
    fallback.focus();
    fallback.select();
    copied = document.execCommand("copy");
  } finally {
    fallback.remove();
    if (previousFocus instanceof HTMLElement && previousFocus.isConnected) {
      previousFocus.focus({ preventScroll: true });
    }
  }

  if (!copied) {
    throw new Error("Clipboard copy failed.");
  }
}

function buildChips(data: PromptData, services: PromptPanelServices): ChipItem[] {
  const specs = buildConditionChipSpecs(data);

  return specs.map((spec) => {
    const tone = getChipTone(spec);
    if (spec.kind === "combo") {
      return {
        label: spec.label,
        tone,
        removable: spec.removable,
        action: () => {
          services.clearCombo(spec.id);
          services.onChange();
          focusConditionControl(spec.id);
        },
      };
    }

    if (spec.kind === "supplementalNotes") {
      return {
        label: spec.label,
        tone,
        removable: spec.removable,
        action: () => {
          services.clearSupplementalNotes();
          services.onChange();
          focusConditionControl("supplementalNotes");
        },
      };
    }

    return {
      label: spec.label,
      tone,
      removable: spec.removable,
    };
  });
}

function focusConditionControl(id: ComboId | "supplementalNotes"): void {
  const inputId = id === "supplementalNotes" ? id : `${id}Input`;
  const controls = [
    document.getElementById(inputId),
    document.querySelector(`[data-testid="recipe-item-toggle-${id}"]`),
  ];
  const target = controls.find(
    (control): control is HTMLElement =>
      control instanceof HTMLElement && control.getClientRects().length > 0,
  );
  target?.focus();
}

function getChipTone(spec: ReturnType<typeof buildConditionChipSpecs>[number]): ChipTone {
  if (spec.kind === "combo") {
    if (spec.id === "materials" || spec.id === "ngFoodsAndSeasonings") {
      return "ingredient";
    }
    if (spec.id === "recipeDirections") {
      return "workspace";
    }
  }

  return "condition";
}

export function refreshPromptPanel(
  state: PromptPanelState,
  elements: PromptPanelElements,
  services: PromptPanelServices,
): void {
  const data = services.readConditions();
  const prompt = services.getPrompt();
  elements.output.value = prompt;
  elements.mobileOutput.value = prompt;

  const chips = buildChips(data, services);
  renderChips(elements.chips, chips);

  syncStickyFooter(state, elements, {
    scrollY: window.scrollY,
    innerHeight: window.innerHeight,
    documentHeight: document.documentElement.scrollHeight,
    innerWidth: window.innerWidth,
  });
}

export function syncStickyFooter(
  state: PromptPanelState,
  elements: PromptPanelElements,
  viewport: ViewportMetrics,
): void {
  const sticky = getStickyFooterView(state, viewport);
  state.nearBottom = sticky.nearBottom;
  elements.bottom.classList.toggle("show", sticky.show);
  elements.bottom.classList.toggle("suppress", sticky.suppress);
}

export function markUserHasInput(
  state: PromptPanelState,
  elements: PromptPanelElements,
  services: PromptPanelServices,
): void {
  services.setHasUserInput(true);
  refreshPromptPanel(state, elements, services);
}

export function scrollToPrompt(
  state: PromptPanelState,
  elements: PromptPanelElements,
  services: PromptPanelServices,
): void {
  refreshPromptPanel(state, elements, services);
  elements.output.scrollIntoView({
    behavior: prefersReducedMotion() ? "auto" : "smooth",
    block: "start",
  });
  elements.output.focus();
  elements.output.setSelectionRange(0, 0);
  markUserHasInput(state, elements, services);
}

export async function copyPrompt(
  state: PromptPanelState,
  elements: PromptPanelElements,
  services: PromptPanelServices,
  event: Event,
): Promise<void> {
  const button = event.currentTarget as HTMLElement | null;
  let feedbackButton = button;
  services.flushPendingInputs();
  services.onChange();
  if (!services.application.getSnapshot().materialRequests.length) return;
  refreshPromptPanel(state, elements, services);
  let copied = false;
  try {
    await copyText(services.getPrompt());
    copied = true;
  } catch {
    const useMobileFallback =
      window.innerWidth < 1024 &&
      (button === elements.copyPromptMobile || button === elements.copyPromptSticky);
    if (useMobileFallback && button === elements.copyPromptSticky) {
      services.openMobilePromptForCopy?.(elements.copyPromptSticky);
      feedbackButton = elements.copyPromptMobile;
    }
    const fallbackTarget = useMobileFallback ? elements.mobileOutput : elements.output;
    const preview = fallbackTarget.closest("details");
    if (preview) {
      preview.open = true;
    }
    try {
      fallbackTarget.focus({ preventScroll: true });
      fallbackTarget.select();
      if (!useMobileFallback) fallbackTarget.scrollIntoView({ block: "nearest" });
      copied = document.execCommand("copy");
    } catch {
      copied = false;
    }
  }

  if (copied) {
    showCopyFeedback(feedbackButton);
    return;
  }

  showCopyError(feedbackButton);
}

function showCopyFeedback(button: HTMLElement | null): void {
  if (!button) return;

  const label = button.querySelector<HTMLElement>(".copy-label");
  const status = button.querySelector<HTMLElement>(".copy-status");
  const dataset = button.dataset as DOMStringMap & {
    defaultLabel?: string;
    successLabel?: string;
  };
  const defaultLabel = dataset.defaultLabel ?? label?.textContent ?? "";
  const successLabel = dataset.successLabel ?? "コピーしました。AIへ渡してください";

  button.classList.add("is-copied");
  if (label) label.textContent = "コピーしました";
  if (status) status.textContent = successLabel;

  window.setTimeout(() => {
    button.classList.remove("is-copied");
    if (label) label.textContent = defaultLabel;
    if (status) status.textContent = "";
  }, 1800);
}

function showCopyError(button: HTMLElement | null): void {
  if (!button) return;

  const label = button.querySelector<HTMLElement>(".copy-label");
  const status = button.querySelector<HTMLElement>(".copy-status");
  const dataset = button.dataset as DOMStringMap & {
    defaultLabel?: string;
  };
  const defaultLabel = dataset.defaultLabel ?? label?.textContent ?? "";
  const errorLabel = "コピーできませんでした。本文を選択してコピーしてください。";

  button.classList.add("is-copy-error");
  if (label) label.textContent = errorLabel;
  if (status) status.textContent = errorLabel;

  window.setTimeout(() => {
    button.classList.remove("is-copy-error");
    if (label) label.textContent = defaultLabel;
    if (status) status.textContent = "";
  }, 2600);
}
