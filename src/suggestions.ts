export const searchSynonyms: Record<string, string> = {
  卵: "たまご 玉子 タマゴ",
  豆腐: "とうふ",
  厚揚げ: "あつあげ",
  油揚げ: "あぶらあげ",
  納豆: "なっとう",
  高野豆腐: "こうやどうふ こうや 豆腐",
  玉ねぎ: "たまねぎ タマネギ",
  長ねぎ: "ながねぎ ネギ",
  餃子: "ぎょうざ ギョウザ",
  焼き魚: "やきざかな",
  肉じゃが: "にくじゃが",
  電子レンジ: "でんしれんじ レンジ",
  炊飯器: "すいはんき",
  主菜: "しゅさい",
  副菜: "ふくさい",
  汁物: "しるもの",
  和食: "わしょく",
  中華: "ちゅうか",
  洋食: "ようしょく",
  時短: "じたん",
  節約: "せつやく",
  味噌汁: "みそしる",
};

export function normalizeSearchText(text: string): string {
  return text
    .normalize("NFKC")
    .toLowerCase()
    .replace(/[ぁ-ゖ]/g, (char) => String.fromCharCode(char.charCodeAt(0) + 96));
}

export function getOptionSearchText(value: string): string {
  return normalizeSearchText(`${value} ${searchSynonyms[value] ?? ""}`);
}

export function filterAvailableComboOptions(
  options: readonly string[],
  query: string,
  selected: Iterable<string> = [],
  limit = 40,
): string[] {
  const normalizedQuery = normalizeSearchText(query).trim();
  const excluded = new Set(selected);

  return options
    .filter((value) => !excluded.has(value))
    .filter((value) => !normalizedQuery || getOptionSearchText(value).includes(normalizedQuery))
    .slice(0, limit);
}
