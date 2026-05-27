import { buildConditionChipSpecs } from "./chips";
import { countAdvancedConditions } from "./conditions";
import { buildPrompt } from "./prompt";
import { getStickyFooterView } from "./sticky-footer";
import type { ChipItem, ComboId, PromptData } from "./types";

type PromptPanelElements = {
  output: HTMLTextAreaElement;
  bottom: HTMLElement;
  chips: Element;
  stickyChips: Element;
  advancedDetails: HTMLDetailsElement;
  advancedTitle: HTMLElement;
  advancedCount: HTMLElement;
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

export function refreshPromptPanel(
  state: PromptPanelState,
  elements: PromptPanelElements,
  services: PromptPanelServices,
): void {
  const data = services.readConditions();
  elements.output.value = buildPrompt(data);

  const chips = buildChips(data, services);
  renderChips(elements.chips, chips);
  renderChips(elements.stickyChips, chips.slice(0, 8), true);

  const advancedCount = countAdvancedConditions(data);

  elements.advancedCount.textContent = advancedCount ? `(${advancedCount}件指定中)` : "";
  elements.advancedTitle.textContent = elements.advancedDetails.open
    ? "こだわり条件"
    : "こだわり条件を追加";

  syncStickyFooter(state, elements, {
    scrollY: window.scrollY,
    innerHeight: window.innerHeight,
    documentHeight: document.documentElement.scrollHeight,
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
  showCopyToast(button);
}

function showCopyToast(button: HTMLElement | null): void {
  const toast = button?.querySelector<HTMLElement>(".copy-toast");
  if (!toast) return;
  toast.classList.remove("show");
  void toast.offsetWidth;
  toast.classList.add("show");
  window.setTimeout(() => toast.classList.remove("show"), 1500);
}
