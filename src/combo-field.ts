import { cookTimeOptions } from "./data";
import { comboOptionValues, isImeComposing } from "./combo-registry";

const safe$ = <T extends Element>(selector: string, root: ParentNode = document): T | null =>
  root.querySelector<T>(selector);

export { isImeComposing };
export { comboOptionValues };

export function getCookTimeValue(): string {
  const range = safe$<HTMLInputElement>("#cookTimeRange");
  return range ? (cookTimeOptions[Number(range.value)] ?? "") : "";
}

export function updateCookTimeDisplay(): void {
  const label = safe$<HTMLElement>("#cookTimeLabel");
  if (label) {
    label.textContent = getCookTimeValue() || "指定なし";
  }
}
