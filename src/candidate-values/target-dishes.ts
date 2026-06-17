import type { CandidateValue } from "./types";

export const targetDishCandidates = [
  { value: "カレー", romaji: ["curry"] },
  { value: "オムライス", romaji: ["omurice"] },
  { value: "ハンバーグ", romaji: ["hamburg"] },
  { value: "肉じゃが", aliases: ["にくじゃが"], romaji: ["nikujaga"] },
  { value: "唐揚げ", aliases: ["から揚げ", "からあげ"], romaji: ["karaage"] },
  { value: "生姜焼き", aliases: ["しょうが焼き"], romaji: ["shogayaki"] },
  { value: "鶏の照り焼き", aliases: ["鶏照り焼き"], romaji: ["teriyaki chicken"] },
  { value: "さばの味噌煮", aliases: ["サバの味噌煮"], romaji: ["saba misoni"] },
  { value: "親子丼", aliases: ["おやこどん"], romaji: ["oyakodon"] },
  { value: "味噌汁", aliases: ["みそ汁", "みそしる"], romaji: ["misoshiru"] },
] as const satisfies readonly CandidateValue[];
