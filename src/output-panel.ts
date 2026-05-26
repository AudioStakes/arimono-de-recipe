import { buildConditionChipSpecs } from "./chips";
import { buildPrompt } from "./prompt";
import { getStickyFooterView } from "./sticky-footer";
import { getCookTimeValue } from "./combo-field";
import type { AppState, ChipItem, ComboId, PromptData } from "./types";

type Elements = {
  output: HTMLTextAreaElement;
  bottom: HTMLElement;
  chips: Element;
  stickyChips: Element;
  advancedDetails: HTMLDetailsElement;
  advancedTitle: HTMLElement;
  advancedCount: HTMLElement;
};

type StateReader = {
  combos: AppState["combos"];
  editingCombo: AppState["editingCombo"];
  hasUserInput: boolean;
  inlineVisible: boolean;
  nearBottom: boolean;
};

type Runtime = {
  scrollY: number;
  innerHeight: number;
  documentHeight: number;
};

export type PromptPanelServices = {
  getServingsText: () => string;
  getSupplementalNotes: () => string;
  getComboValues: (group: ComboId) => string[];
  setHasUserInput: (value: boolean) => void;
  setNearBottom: (value: boolean) => void;
  clearEditingCombo: (group: ComboId) => void;
  clearComboValues: (group: ComboId) => void;
  clearCookTime: () => void;
  clearSupplementalNotes: () => void;
  renderCombo: (group: ComboId) => void;
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

function buildPromptData(services: PromptPanelServices): PromptData {
  return {
    materials: services.getComboValues("materials"),
    dishTypes: services.getComboValues("dishTypes"),
    cookingTools: services.getComboValues("cookingTools"),
    pairingTargets: services.getComboValues("pairingTargets"),
    difficulty: services.getComboValues("difficulty"),
    health: services.getComboValues("health"),
    flavors: services.getComboValues("flavors"),
    genres: services.getComboValues("genres"),
    scenes: services.getComboValues("scenes"),
    ngMaterials: services.getComboValues("ngMaterials"),
    ngSeasonings: services.getComboValues("ngSeasonings"),
    servings: services.getServingsText(),
    cookTime: getCookTimeValue(),
    supplementalNotes: services.getSupplementalNotes(),
  };
}

function buildChips(data: PromptData, services: PromptPanelServices): ChipItem[] {
  const specs = buildConditionChipSpecs(data);

  return specs.map((spec) => {
    if (spec.kind === "combo") {
      return {
        label: spec.label,
        removable: spec.removable,
        action: () => {
          services.clearEditingCombo(spec.id);
          services.clearComboValues(spec.id);
          services.renderCombo(spec.id);
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
  state: StateReader,
  elements: Elements,
  services: PromptPanelServices,
): void {
  const data = buildPromptData(services);
  elements.output.value = buildPrompt(data);

  const chips = buildChips(data, services);
  renderChips(elements.chips, chips);
  renderChips(elements.stickyChips, chips.slice(0, 8), true);

  const advancedCount =
    services.getComboValues("difficulty").length +
    services.getComboValues("health").length +
    services.getComboValues("flavors").length +
    services.getComboValues("genres").length +
    services.getComboValues("scenes").length +
    services.getComboValues("ngMaterials").length +
    services.getComboValues("ngSeasonings").length +
    (getCookTimeValue() ? 1 : 0) +
    (services.getSupplementalNotes() ? 1 : 0);

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
  state: StateReader,
  elements: Elements,
  viewport: Runtime,
): void {
  const sticky = getStickyFooterView(state, viewport);
  state.nearBottom = sticky.nearBottom;
  elements.bottom.classList.toggle("show", sticky.show);
  elements.bottom.classList.toggle("suppress", sticky.suppress);
}

export function markPromptHasInput(
  state: StateReader,
  elements: Elements,
  services: PromptPanelServices,
): void {
  services.setHasUserInput(true);
  refreshPromptPanel(state, elements, services);
}

export function scrollToPrompt(
  state: StateReader,
  elements: Elements,
  services: PromptPanelServices,
): void {
  refreshPromptPanel(state, elements, services);
  elements.output.scrollIntoView({ behavior: "smooth", block: "start" });
  elements.output.focus();
  elements.output.setSelectionRange(0, 0);
  markPromptHasInput(state, elements, services);
}

export async function copyPrompt(
  state: StateReader,
  elements: Elements,
  services: PromptPanelServices,
  event: Event,
): Promise<void> {
  const button = event.currentTarget as HTMLElement | null;
  if (!elements.output.value.trim()) refreshPromptPanel(state, elements, services);
  try {
    await navigator.clipboard.writeText(String(elements.output.value || ""));
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
