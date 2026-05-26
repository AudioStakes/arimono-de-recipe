import { servingGroups } from "./data";

export type ServingGroupId = (typeof servingGroups)[number]["id"];

export type ServingCounts = Partial<Record<ServingGroupId, number>>;

export const clampServingCount = (count: number): number =>
  Math.max(0, Math.min(10, Number(count) || 0));

export function formatServings(counts: ServingCounts): string {
  return servingGroups
    .map(({ id, label }) => [label, counts[id] ?? 0] as const)
    .filter(([, count]) => count > 0)
    .map(([label, count]) => `${label}${count}人`)
    .join("、");
}

export const buildServingsText = formatServings;
