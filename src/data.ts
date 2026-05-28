import {
  candidateValuesToStrings,
  cookingMethodAndToolCandidates,
  cookTimeCandidates,
  dishTypeCandidates,
  easeCandidates,
  foodMaterialCandidates,
  ngFoodAndSeasoningCandidates,
  pairingTargetCandidates,
  recipeDirectionCandidates,
} from "./candidate-values";
import type { ComboConfig, OptionSetKey, ServingGroup } from "./types";

export const cookTimeOptions = cookTimeCandidates;

export const servingGroups = [
  { id: "adultCount", label: "大人", icon: "adult" },
  { id: "seniorCount", label: "シニア", icon: "senior" },
  { id: "childCount", label: "子供", icon: "child" },
  { id: "toddlerCount", label: "幼児", icon: "baby" },
] as const satisfies readonly ServingGroup[];

export const comboOptionSets: Record<OptionSetKey, string[]> = {
  materials: candidateValuesToStrings(foodMaterialCandidates),
  dishTypes: candidateValuesToStrings(dishTypeCandidates),
  cookingTools: candidateValuesToStrings(cookingMethodAndToolCandidates),
  pairingTargets: candidateValuesToStrings(pairingTargetCandidates),
  difficulty: candidateValuesToStrings(easeCandidates),
  recipeDirections: candidateValuesToStrings(recipeDirectionCandidates),
  ngFoodsAndSeasonings: candidateValuesToStrings(ngFoodAndSeasoningCandidates),
};

export const combos: ComboConfig[] = [
  {
    id: "materials",
    label: "家にある食材",
    icon: "leaf",
    optionSet: "materials",
    placeholder: "例: 卵、豆腐、もやし",
    prompt: "材料",
    bullets: true,
    basic: true,
  },
  {
    id: "dishTypes",
    label: "料理区分・作りたいもの",
    icon: "bowl",
    optionSet: "dishTypes",
    placeholder: "例: 副菜",
    prompt: "料理区分・作りたいもの",
    basic: true,
  },
  {
    id: "cookingTools",
    label: "使いたい調理器具・調理方法",
    icon: "pot",
    optionSet: "cookingTools",
    placeholder: "例: 電子レンジ",
    prompt: "使いたい調理器具・調理方法",
  },
  {
    id: "pairingTargets",
    label: "合わせたい料理・一緒に出す料理",
    icon: "link",
    optionSet: "pairingTargets",
    placeholder: "例: カレー",
    prompt: "合わせたい料理・一緒に出す料理",
    chip: "一緒に出す",
  },
  {
    id: "difficulty",
    label: "作りやすさ・手軽さ",
    icon: "zap",
    optionSet: "difficulty",
    placeholder: "例: 時短",
    prompt: "作りやすさ・手軽さ",
  },
  {
    id: "recipeDirections",
    label: "味や雰囲気",
    icon: "heart",
    optionSet: "recipeDirections",
    placeholder: "例: あっさり",
    prompt: "味や雰囲気",
  },
  {
    id: "ngFoodsAndSeasonings",
    label: "NG食材・調味料",
    icon: "ban",
    optionSet: "ngFoodsAndSeasonings",
    placeholder: "例: にんじん",
    prompt: "NG食材・調味料",
  },
];

export const advancedConditionOrder = [
  "difficulty",
  "recipeDirections",
  "ngFoodsAndSeasonings",
] as const;

export const conditionChipOrder = [
  "materials",
  "dishTypes",
  "cookingTools",
  "pairingTargets",
  "difficulty",
  "recipeDirections",
  "ngFoodsAndSeasonings",
] as const;
