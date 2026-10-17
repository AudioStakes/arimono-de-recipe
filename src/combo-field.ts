import { getComboOptionValues, isImeComposing } from "./combo-registry";

const safe$ = <T extends Element>(selector: string, root: ParentNode = document): T | null =>
  root.querySelector<T>(selector);

export { getComboOptionValues, isImeComposing };

export function updateCookTimeDisplay(cookTime: string): void {
  const label = safe$<HTMLElement>("#cookTimeLabel");
  const range = safe$<HTMLInputElement>("#cookTimeRange");
  const value = cookTime || "指定なし";
  range?.setAttribute("aria-valuetext", value);
  if (label) {
    label.textContent = value;
  }
}
