import type {
  CookingViewTab,
  RecipeCandidate,
  RecipeDecisionCandidateListState,
  RecipeDecisionCandidateLoadingState,
  RecipeDecisionCandidateRequest,
  RecipeDecisionCookingViewState,
  RecipeDecisionErrorState,
  RecipeDecisionInputState,
  RecipeDecisionRecipeDetailState,
  RecipeDecisionState,
  RecipeDecisionView,
} from "./types";

export const recipeDecisionViews = [
  "input",
  "candidate-loading",
  "candidate-list",
  "recipe-detail",
  "cooking-view",
  "error",
] as const satisfies readonly RecipeDecisionView[];

export const cookingViewTabs = [
  "ingredients",
  "instructions",
  "taste",
] as const satisfies readonly CookingViewTab[];

export type RecipeDecisionRequestState = Extract<
  RecipeDecisionState,
  { request: RecipeDecisionCandidateRequest }
>;

export type RecipeDecisionCandidateState = Extract<
  RecipeDecisionState,
  { candidates: RecipeCandidate[] }
>;

export type RecipeDecisionSelectedCandidateState = Extract<
  RecipeDecisionState,
  { selectedCandidateId: string }
>;

export function createInitialRecipeDecisionState(): RecipeDecisionInputState {
  return {
    view: "input",
    requestId: 0,
  };
}

export function startCandidateLoading(
  request: RecipeDecisionCandidateRequest,
  requestId: number,
): RecipeDecisionCandidateLoadingState {
  return {
    view: "candidate-loading",
    requestId,
    request,
  };
}

export function showCandidateList(
  state: RecipeDecisionRequestState,
  candidates: RecipeCandidate[],
): RecipeDecisionCandidateListState {
  return {
    view: "candidate-list",
    requestId: state.requestId,
    request: state.request,
    candidates,
  };
}

export function showRecipeDetail(
  state: RecipeDecisionCandidateState,
  selectedCandidateId: string,
): RecipeDecisionRecipeDetailState {
  return {
    view: "recipe-detail",
    requestId: state.requestId,
    request: state.request,
    candidates: state.candidates,
    selectedCandidateId,
  };
}

export function showCookingView(
  state: RecipeDecisionSelectedCandidateState,
  cookingTab: CookingViewTab = "ingredients",
): RecipeDecisionCookingViewState {
  return {
    view: "cooking-view",
    requestId: state.requestId,
    request: state.request,
    candidates: state.candidates,
    selectedCandidateId: state.selectedCandidateId,
    cookingTab,
  };
}

export function showRecipeDecisionError(
  message: string,
  state: RecipeDecisionState = createInitialRecipeDecisionState(),
): RecipeDecisionErrorState {
  const errorMessage = message.trim() || "候補を作れませんでした。";
  if ("request" in state && state.request) {
    return {
      view: "error",
      requestId: state.requestId,
      request: state.request,
      message: errorMessage,
    };
  }

  return {
    view: "error",
    requestId: state.requestId,
    message: errorMessage,
  };
}
