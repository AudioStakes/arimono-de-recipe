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
  state: StickyFooterState,
  viewport: StickyViewport,
): StickyFooterView {
  if ((viewport.innerWidth ?? window.innerWidth) < 1024) {
    return {
      show: true,
      suppress: false,
      nearBottom: false,
    };
  }

  const nearBottom = isNearBottom(viewport);
  const show = state.hasUserInput && !state.inlineVisible && !nearBottom;

  return {
    show,
    suppress: !show,
    nearBottom,
  };
}
