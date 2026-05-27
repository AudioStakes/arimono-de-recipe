export type CandidateValue = {
  readonly value: string;
  readonly aliases?: readonly string[];
  readonly romaji?: readonly string[];
  readonly priority?: number;
};

export const candidateValuesToStrings = (candidates: readonly CandidateValue[]): string[] =>
  candidates.map((candidate) => candidate.value);

export const buildCandidateSearchSynonyms = (
  candidates: readonly CandidateValue[],
): Record<string, string> =>
  Object.fromEntries(
    candidates
      .map(
        (candidate) =>
          [
            candidate.value,
            [...(candidate.aliases ?? []), ...(candidate.romaji ?? [])].join(" "),
          ] as const,
      )
      .filter(([, searchText]) => searchText.length > 0),
  );

export const mergeCandidateValues = (
  ...candidateLists: readonly (readonly CandidateValue[])[]
): CandidateValue[] => {
  const seen = new Set<string>();
  const merged: CandidateValue[] = [];

  for (const candidate of candidateLists.flat()) {
    if (seen.has(candidate.value)) continue;
    seen.add(candidate.value);
    merged.push(candidate);
  }

  return merged;
};
