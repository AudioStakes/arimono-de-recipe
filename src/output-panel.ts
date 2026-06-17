import { buildConditionChipSpecs } from "./chips";
import { requestIntentOptions } from "./data";
import { buildPrompt } from "./prompt";
import { getStickyFooterView } from "./sticky-footer";
import type { ChipItem, ComboId, PromptData } from "./types";

type PromptPanelElements = {
  output: HTMLTextAreaElement;
  mobileOutput: HTMLTextAreaElement;
  bottom: HTMLElement;
  chips: Element;
  stickyChips: Element;
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
  readConditions: () => PromptData;
  flushPendingInputs: () => void;
  setHasUserInput: (value: boolean) => void;
  setNearBottom: (value: boolean) => void;
  clearCombo: (group: ComboId) => void;
  clearCookTime: () => void;
  clearSupplementalNotes: () => void;
  openMobilePromptForCopy?: (opener: HTMLElement) => void;
  onChange: () => void;
};

const renderChips = (container: Element, items: ChipItem[], readOnly = false): void => {
  container.innerHTML = "";
  container.classList.toggle("show", items.length > 0);

  for (const item of items) {
    const chip = document.createElement("span");
    chip.className = "chip";
    chip.setAttribute("data-kind", item.tone ?? "condition");
    chip.appendChild(document.createTextNode(item.label));
    if (item.removable && !readOnly && item.action) {
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
  fallback.focus();
  fallback.select();
  const copied = document.execCommand("copy");
  fallback.remove();

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
        },
      };
    }

    if (spec.kind === "cookTime") {
      return {
        label: spec.label,
        tone,
        removable: spec.removable,
        action: () => {
          services.clearCookTime();
          services.onChange();
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

function buildMobileSummaryChips(data: PromptData): ChipItem[] {
  const intentLabel = requestIntentOptions.find(
    (option) => option.value === data.requestIntent,
  )?.label;
  const summaries = [
    intentLabel ?? "",
    data.materials.length ? data.materials.slice(0, 3).join("・") : "",
    data.servings,
    data.targetDish[0] ?? "",
    data.recipeCount === "multiple" ? "複数品" : "",
    data.recipeRoles[0] ?? "",
    data.cookingTools[0] ?? "",
    data.pairingTargets[0] ?? "",
    data.cookTime || "",
    data.recipeDirections[0] ?? "",
    data.ngFoodsAndSeasonings[0] ? `使えない: ${data.ngFoodsAndSeasonings[0]}` : "",
    data.supplementalNotes ? "その他の要望あり" : "",
  ].filter(Boolean);

  const visible = summaries.slice(0, 5).map((label) => ({ label }));
  const remaining = summaries.length - visible.length;

  if (remaining > 0) {
    visible.push({ label: `+${remaining}項目` });
  }

  return visible;
}

export function refreshPromptPanel(
  state: PromptPanelState,
  elements: PromptPanelElements,
  services: PromptPanelServices,
): void {
  const data = services.readConditions();
  const prompt = buildPrompt(data);
  elements.output.value = prompt;
  elements.mobileOutput.value = prompt;

  const chips = buildChips(data, services);
  renderChips(elements.chips, chips);
  renderChips(elements.stickyChips, buildMobileSummaryChips(data), true);

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
  refreshPromptPanel(state, elements, services);
  let copied = false;
  try {
    await copyText(String(elements.output.value || ""));
    copied = true;
  } catch {
    const useMobileFallback =
      button === elements.copyPromptMobile || button === elements.copyPromptSticky;
    if (button === elements.copyPromptSticky) {
      services.openMobilePromptForCopy?.(elements.copyPromptSticky);
      feedbackButton = elements.copyPromptMobile;
    }
    const fallbackTarget = useMobileFallback ? elements.mobileOutput : elements.output;
    fallbackTarget.select();
    copied = document.execCommand("copy");
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
  if (label) label.textContent = successLabel;
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
