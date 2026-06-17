export type MaterialUsage = "auto" | "required" | "use_up";

export type CookingViewTab = "ingredients" | "instructions" | "taste";

export type RecipeDecisionView =
  | "input"
  | "candidate-loading"
  | "candidate-list"
  | "recipe-detail"
  | "cooking-view"
  | "error";

export type RecipeMaterialInput = {
  id: string;
  name: string;
  usage: MaterialUsage;
  amount?: string;
};

export type RecipeDecisionCandidateRequest = {
  materials: RecipeMaterialInput[];
  allowShopping?: boolean;
  directions: string[];
  tools: string[];
  avoid: string[];
  servings?: string;
  time?: string;
  notes?: string;
};

export type RecipeCandidateBadge =
  | "no_shop"
  | "miss_optional"
  | "quick"
  | "easy"
  | "uses_up"
  | "few_dishes"
  | "kids";

export type RecipeDetail = {
  candidateId: string;
  title: string;
  ingredients: string[];
  instructions: string[];
  tasteAdjustments: string[];
};

export type RecipeCandidate = {
  id: string;
  title: string;
  timeMinutes: number;
  badges: RecipeCandidateBadge[];
  usedMaterials: string[];
  missingIngredients: string[];
  reason: string;
  detail: RecipeDetail;
};

export type RecipeDecisionInputState = {
  view: "input";
  requestId: number;
};

export type RecipeDecisionCandidateLoadingState = {
  view: "candidate-loading";
  requestId: number;
  request: RecipeDecisionCandidateRequest;
};

export type RecipeDecisionCandidateListState = {
  view: "candidate-list";
  requestId: number;
  request: RecipeDecisionCandidateRequest;
  candidates: RecipeCandidate[];
};

export type RecipeDecisionRecipeDetailState = {
  view: "recipe-detail";
  requestId: number;
  request: RecipeDecisionCandidateRequest;
  candidates: RecipeCandidate[];
  selectedCandidateId: string;
};

export type RecipeDecisionCookingViewState = {
  view: "cooking-view";
  requestId: number;
  request: RecipeDecisionCandidateRequest;
  candidates: RecipeCandidate[];
  selectedCandidateId: string;
  cookingTab: CookingViewTab;
};

export type RecipeDecisionErrorState = {
  view: "error";
  requestId: number;
  message: string;
  request?: RecipeDecisionCandidateRequest;
};

export type RecipeDecisionState =
  | RecipeDecisionInputState
  | RecipeDecisionCandidateLoadingState
  | RecipeDecisionCandidateListState
  | RecipeDecisionRecipeDetailState
  | RecipeDecisionCookingViewState
  | RecipeDecisionErrorState;
