import { buildConditionChipSpecs } from "./chips";
import { buildPrompt } from "./prompt";
import { getStickyFooterView } from "./sticky-footer";
import type { ChipItem, ComboId, PromptData } from "./types";

type PromptPanelElements = {
  output: HTMLTextAreaElement;
  mobileOutput: HTMLTextAreaElement;
  bottom: HTMLElement;
  chips: Element;
  stickyChips: Element;
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

export type PromptPanelServices = {
  readConditions: () => PromptData;
  setHasUserInput: (value: boolean) => void;
  setNearBottom: (value: boolean) => void;
  clearCombo: (group: ComboId) => void;
  clearCookTime: () => void;
  clearSupplementalNotes: () => void;
  onChange: () => void;
};

const renderChips = (container: Element, items: ChipItem[], readOnly = false): void => {
  container.innerHTML = "";
  container.classList.toggle("show", items.length > 0);

  for (const item of items) {
    const chip = document.createElement("span");
    chip.className = "chip";
    chip.appendChild(document.createTextNode(item.label));
    if (item.removable && !readOnly && item.action) {
      const remove = document.createElement("button");
      remove.type = "button";
      remove.className = "chip-remove";
      remove.textContent = "×";
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
  fallback.style.position = "fixed";
  fallback.style.inset = "0";
  fallback.style.opacity = "0";
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
    if (spec.kind === "combo") {
      return {
        label: spec.label,
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
        removable: spec.removable,
        action: () => {
          services.clearSupplementalNotes();
          services.onChange();
        },
      };
    }

    return {
      label: spec.label,
      removable: spec.removable,
    };
  });
}

function buildMobileSummaryChips(data: PromptData): ChipItem[] {
  const summaries = [
    data.materials.length ? data.materials.slice(0, 3).join("・") : "",
    data.servings,
    data.dishTypes[0] ?? "",
    data.cookingTools[0] ?? "",
    data.pairingTargets[0] ?? "",
    data.cookTime || "",
    data.difficulty[0] ?? "",
    data.recipeDirections[0] ?? "",
    data.ngFoodsAndSeasonings[0] ? `NG: ${data.ngFoodsAndSeasonings[0]}` : "",
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
  if (!elements.output.value.trim()) refreshPromptPanel(state, elements, services);
  try {
    await copyText(String(elements.output.value || ""));
  } catch {
    elements.output.select();
    document.execCommand("copy");
  }
  showCopyFeedback(button);
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
