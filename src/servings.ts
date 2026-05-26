import { servingGroups } from "./data";

export type ServingGroupId = (typeof servingGroups)[number]["id"];

export type ServingCounts = Partial<Record<ServingGroupId, number>>;

export function buildServingsText(counts: ServingCounts): string {
  return servingGroups
    .map(({ id, label }) => [label, counts[id] ?? 0] as const)
    .filter(([, count]) => count > 0)
    .map(([label, count]) => `${label}${count}人`)
    .join("、");
}
