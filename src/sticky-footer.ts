import type { AppState } from "./types";

export type StickyViewport = {
  scrollY: number;
  innerHeight: number;
  documentHeight: number;
  innerWidth?: number;
  threshold?: number;
};

export type StickyFooterView = {
  show: boolean;
  suppress: boolean;
  nearBottom: boolean;
};

type StickyFooterState = Pick<AppState, "hasUserInput" | "inlineVisible" | "nearBottom">;

export function isNearBottom(viewport: StickyViewport): boolean {
  const threshold = viewport.threshold ?? 160;
  return viewport.scrollY + viewport.innerHeight >= viewport.documentHeight - threshold;
}

export function getStickyFooterView(
  _state: StickyFooterState,
  _viewport: StickyViewport,
): StickyFooterView {
  return { show: true, suppress: false, nearBottom: false };
}
