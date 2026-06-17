import { getComboOptionValues, isImeComposing } from "./combo-registry";
import { cookTimeOptions } from "./data";

const safe$ = <T extends Element>(selector: string, root: ParentNode = document): T | null =>
  root.querySelector<T>(selector);

export { getComboOptionValues, isImeComposing };

export function getCookTimeValue(): string {
  const range = safe$<HTMLInputElement>("#cookTimeRange");
  const value = range ? (cookTimeOptions[Number(range.value)] ?? "") : "";
  return value === "指定なし" ? "" : value;
}

export function updateCookTimeDisplay(): void {
  const label = safe$<HTMLElement>("#cookTimeLabel");
  if (label) {
    const range = safe$<HTMLInputElement>("#cookTimeRange");
    label.textContent = range ? (cookTimeOptions[Number(range.value)] ?? "指定なし") : "指定なし";
  }
}
