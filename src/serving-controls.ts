import { servingGroups } from "./data";
import { clampServingCount, formatServingsText, type ServingGroupId } from "./servings";

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

export function getServingsValue(): string {
  return formatServingsText(getServingCounts());
}

export function updateServingSteppers(): void {
  for (const { id } of servingGroups) {
    setStepperCount(id, getStepperCount(id));
  }
}

export function adjustServingValue(id: ServingGroupId, delta: number): void {
  setStepperCount(id, getStepperCount(id) + delta);
}
