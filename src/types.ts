export type ComboId =
  | "materials"
  | "targetDish"
  | "recipeRoles"
  | "cookingTools"
  | "pairingTargets"
  | "recipeDirections"
  | "ngFoodsAndSeasonings";

export type OptionSetKey =
  | "materials"
  | "targetDishes"
  | "recipeRoles"
  | "cookingTools"
  | "pairingTargets"
  | "recipeDirections"
  | "ngFoodsAndSeasonings";

export type RequestIntent = "auto" | "target-dish" | "pairing";

export type MaterialUseMode = "auto" | "specified";

export type MaterialUsage = "auto" | "required" | "use-up";

export type UseUpAmountMode = "as-written" | "custom";

export type RecipeCount = "auto" | "one" | "multiple";

export type ServingsMode =
  | "unspecified"
  | "one"
  | "two"
  | "three-to-four"
  | "make-ahead"
  | "custom";

export type MaterialRequest = {
  id: string;
  name: string;
  usage: MaterialUsage;
  useUpAmountMode: UseUpAmountMode;
  useUpAmount: string;
};

export type IconName =
  | "leaf"
  | "users"
  | "bowl"
  | "pot"
  | "link"
  | "clock"
  | "zap"
  | "heart"
  | "salt"
  | "globe"
  | "bag"
  | "ban"
  | "alert"
  | "note"
  | "copy"
  | "adult"
  | "senior"
  | "child"
  | "baby";

export type ComboConfig = {
  id: ComboId;
  label: string;
  icon: IconName;
  optionSet: OptionSetKey;
  placeholder: string;
  prompt: string;
  bullets?: boolean;
  basic?: boolean;
  chip?: string;
  single?: boolean;
};

export type ServingGroup = {
  id: string;
  label: string;
  icon: IconName;
};

export type PromptData = Record<ComboId, string[]> & {
  requestIntent: RequestIntent;
  materialUseMode: MaterialUseMode;
  materialRequests: MaterialRequest[];
  servings: string;
  servingsMode: ServingsMode;
  recipeCount: RecipeCount;
  cookTime: string;
  supplementalNotes: string;
};

export type ChipItem = {
  label: string;
  removable?: boolean;
  action?: () => void;
};

export type AppState = {
  hasUserInput: boolean;
  inlineVisible: boolean;
  nearBottom: boolean;
  ticking: boolean;
  mobileSheetOpen: boolean;
  materialRequests: MaterialRequest[];
};
