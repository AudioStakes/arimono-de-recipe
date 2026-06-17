import {
  candidateValuesToStrings,
  cookingMethodAndToolCandidates,
  cookTimeCandidates,
  foodMaterialCandidates,
  ngFoodAndSeasoningCandidates,
  pairingTargetCandidates,
  recipeDirectionCandidates,
  targetDishCandidates,
} from "./candidate-values";
import type {
  ComboConfig,
  MaterialUsage,
  MaterialUseMode,
  OptionSetKey,
  RecipeCount,
  RequestIntent,
  ServingGroup,
  ServingsMode,
  UseUpAmountMode,
} from "./types";

export const requestIntentOptions = [
  { value: "auto", label: "ありものでおまかせ" },
  { value: "target-dish", label: "作りたい料理がある" },
  { value: "pairing", label: "一緒に出す料理に合わせたい" },
] as const satisfies readonly { value: RequestIntent; label: string }[];

export const materialUseModeOptions = [
  { value: "auto", label: "おまかせ" },
  { value: "specified", label: "必ず使う・使い切りたい食材・材料がある" },
] as const satisfies readonly { value: MaterialUseMode; label: string }[];

export const materialUsageOptions = [
  { value: "auto", label: "おまかせ" },
  { value: "required", label: "必ず使う" },
  { value: "use-up", label: "使い切る" },
] as const satisfies readonly { value: MaterialUsage; label: string }[];

export const useUpAmountModeOptions = [
  { value: "as-written", label: "家にある食材・材料に書いた量を使う" },
  { value: "custom", label: "量を別で指定する" },
] as const satisfies readonly { value: UseUpAmountMode; label: string }[];

export const servingsModeOptions = [
  { value: "unspecified", label: "指定なし" },
  { value: "one", label: "1人分" },
  { value: "two", label: "2人分" },
  { value: "three-to-four", label: "3〜4人分" },
  { value: "make-ahead", label: "作り置き多め" },
  { value: "custom", label: "詳しく指定" },
] as const satisfies readonly { value: ServingsMode; label: string }[];

export const recipeCountOptions = [
  { value: "auto", label: "おまかせ" },
  { value: "one", label: "1品だけ" },
  { value: "multiple", label: "複数品を指定" },
] as const satisfies readonly { value: RecipeCount; label: string }[];

export const cookTimeOptions = cookTimeCandidates;

export const recipeRoleOptions = [
  "主菜・しっかり",
  "副菜・一品",
  "小鉢・少量",
  "汁物",
  "ご飯もの",
  "麺もの",
  "お弁当おかず",
] as const;

export const pairingRecipeRoleOptions = [
  "副菜・一品",
  "小鉢・少量",
  "汁物",
  "主菜・しっかり",
  "ご飯もの",
  "麺もの",
  "お弁当おかず",
] as const;

export const featuredRecipeDirectionOptions = [
  "あっさり",
  "こってり",
  "やさしい味",
  "ご飯が進む",
  "甘辛",
  "ピリ辛",
  "味噌味",
  "ごま風味",
  "和風",
  "洋風",
  "中華風",
  "韓国風",
] as const;

export const featuredCookingToolOptions = [
  "電子レンジ",
  "フライパン",
  "鍋",
  "トースター",
  "ヘルシオ ホットクック",
  "炊飯器",
  "オーブン",
  "火を使わない",
] as const;

export const servingGroups = [
  { id: "adultCount", label: "大人", icon: "adult" },
  { id: "seniorCount", label: "シニア", icon: "senior" },
  { id: "childCount", label: "子供", icon: "child" },
  { id: "toddlerCount", label: "幼児", icon: "baby" },
] as const satisfies readonly ServingGroup[];

export const comboOptionSets: Record<OptionSetKey, string[]> = {
  materials: candidateValuesToStrings(foodMaterialCandidates),
  targetDishes: candidateValuesToStrings(targetDishCandidates),
  recipeRoles: [...recipeRoleOptions],
  cookingTools: candidateValuesToStrings(cookingMethodAndToolCandidates),
  pairingTargets: candidateValuesToStrings(pairingTargetCandidates),
  recipeDirections: candidateValuesToStrings(recipeDirectionCandidates),
  ngFoodsAndSeasonings: candidateValuesToStrings(ngFoodAndSeasoningCandidates),
};

export const featuredComboOptions: Partial<Record<OptionSetKey, readonly string[]>> = {
  cookingTools: featuredCookingToolOptions,
  recipeDirections: featuredRecipeDirectionOptions,
};

export const combos: ComboConfig[] = [
  {
    id: "materials",
    label: "家にある食材・材料",
    icon: "leaf",
    optionSet: "materials",
    placeholder: "例: 卵2個、豆腐150g、もやし",
    prompt: "家にある食材・材料",
    bullets: true,
    basic: true,
  },
  {
    id: "targetDish",
    label: "作りたい料理",
    icon: "bowl",
    optionSet: "targetDishes",
    placeholder: "例: カレー",
    prompt: "作りたい料理",
    single: true,
  },
  {
    id: "recipeRoles",
    label: "料理の役割・量感",
    icon: "bowl",
    optionSet: "recipeRoles",
    placeholder: "例: 副菜・一品",
    prompt: "料理の役割・量感",
  },
  {
    id: "cookingTools",
    label: "調理方法・調理器具",
    icon: "pot",
    optionSet: "cookingTools",
    placeholder: "例: 電子レンジ",
    prompt: "調理方法・調理器具",
  },
  {
    id: "pairingTargets",
    label: "一緒に出す料理",
    icon: "link",
    optionSet: "pairingTargets",
    placeholder: "例: カレー",
    prompt: "一緒に出す料理",
    chip: "一緒に出す料理",
  },
  {
    id: "recipeDirections",
    label: "レシピの方向性",
    icon: "heart",
    optionSet: "recipeDirections",
    placeholder: "例: あっさり",
    prompt: "レシピの方向性",
  },
  {
    id: "ngFoodsAndSeasonings",
    label: "使えない・持っていない食材・調味料",
    icon: "ban",
    optionSet: "ngFoodsAndSeasonings",
    placeholder: "例: にんじん",
    prompt: "使えない・持っていない食材・調味料",
    chip: "使えない・持っていない",
  },
];

export const advancedConditionOrder = ["recipeDirections", "ngFoodsAndSeasonings"] as const;

export const conditionChipOrder = [
  "materials",
  "targetDish",
  "recipeRoles",
  "pairingTargets",
  "cookingTools",
  "recipeDirections",
  "ngFoodsAndSeasonings",
] as const;
