import { servingGroups } from "./data";
import type { ServingCounts } from "./servings";

export function updateServingSteppers(counts: Readonly<ServingCounts>): void {
  for (const { id } of servingGroups) {
    const stepper = document.querySelector<HTMLElement>(`[data-serving-id="${id}"]`);
    if (!stepper) continue;
    const count = counts[id] ?? 0;
    const label = stepper.querySelector<HTMLElement>(".serving-count");
    if (label && label.textContent !== `${count}人`) label.textContent = `${count}人`;
    const minus = stepper.querySelector<HTMLButtonElement>(".serving-minus");
    const plus = stepper.querySelector<HTMLButtonElement>(".serving-plus");
    if (minus) minus.disabled = count <= 0;
    if (plus) plus.disabled = count >= 10;
  }
}
