export type ComboId =
  | "materials"
  | "dishTypes"
  | "cookingTools"
  | "pairingTargets"
  | "difficulty"
  | "health"
  | "flavors"
  | "genres"
  | "scenes"
  | "ngMaterials"
  | "ngSeasonings";

export type OptionSetKey =
  | "materials"
  | "dishTypes"
  | "cookingTools"
  | "pairingTargets"
  | "difficulty"
  | "health"
  | "flavors"
  | "genres"
  | "scenes"
  | "ngSeasonings";

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
};

export type ServingGroup = {
  id: string;
  label: string;
  icon: IconName;
};

export type PromptData = Record<ComboId, string[]> & {
  servings: string;
  cookTime: string;
  supplementalNotes: string;
};

export type ChipItem = {
  label: string;
  removable?: boolean;
  action?: () => void;
};

export type AppState = {
  combos: Record<ComboId, string[]>;
  hasUserInput: boolean;
  inlineVisible: boolean;
  nearBottom: boolean;
  ticking: boolean;
};
