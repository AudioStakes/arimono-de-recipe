import { servingGroups, servingsModeOptions } from "./data";
import { clampServingCount, formatServingsText, type ServingGroupId } from "./servings";
import type { ServingsMode } from "./types";

const safe$ = <T extends Element>(selector: string, root: ParentNode = document): T | null =>
  root.querySelector<T>(selector);

function getStepperCount(id: string): number {
  const stepper = safe$<HTMLElement>(`[data-serving-id="${id}"]`);
  const dataset = stepper?.dataset as DOMStringMap & { count?: string };
  return Number(dataset?.count ?? 0);
}

function setStepperCount(id: ServingGroupId, value: number): void {
  const stepper = safe$<HTMLElement>(`[data-serving-id="${id}"]`);
  if (!stepper) return;

  const count = clampServingCount(value);
  const dataset = stepper.dataset as DOMStringMap & { count?: string };
  dataset.count = String(count);

  const countLabel = safe$<HTMLElement>(".serving-count", stepper);
  if (countLabel) countLabel.textContent = `${count}人`;

  const minus = safe$<HTMLButtonElement>(".serving-minus", stepper);
  const plus = safe$<HTMLButtonElement>(".serving-plus", stepper);
  if (minus) minus.disabled = count <= 0;
  if (plus) plus.disabled = count >= 10;
}

export function getServingCounts(): Partial<Record<ServingGroupId, number>> {
  const counts: Partial<Record<ServingGroupId, number>> = {};
  for (const { id } of servingGroups) {
    counts[id] = getStepperCount(id);
  }
  return counts;
}

export function getServingsMode(): ServingsMode {
  const checked = safe$<HTMLInputElement>('input[name="servingsMode"]:checked');
  const value = checked?.value;
  return servingsModeOptions.some((option) => option.value === value)
    ? (value as ServingsMode)
    : "unspecified";
}

export function getServingsValue(): string {
  const mode = getServingsMode();
  if (mode === "unspecified") {
    return "";
  }
  if (mode === "custom") {
    return formatServingsText(getServingCounts());
  }
  return servingsModeOptions.find((option) => option.value === mode)?.label ?? "";
}

export function updateServingSteppers(): void {
  for (const { id } of servingGroups) {
    setStepperCount(id, getStepperCount(id));
  }
}

export function adjustServingValue(id: ServingGroupId, delta: number): void {
  setStepperCount(id, getStepperCount(id) + delta);
}
