import type { MaterialRequest, PromptData, MaterialUsage as PromptMaterialUsage } from "../types";
import type { MaterialUsage, RecipeMaterialInput } from "./types";

function normalizeText(value: string): string {
  return value.replace(/\s+/g, " ").trim();
}

export function toRecipeDecisionMaterialUsage(usage: PromptMaterialUsage): MaterialUsage {
  return usage === "use-up" ? "use_up" : usage;
}

function getRequestAmount(request: MaterialRequest): string {
  if (request.useUpAmountMode !== "custom") {
    return "";
  }

  return normalizeText(request.useUpAmount);
}

function createMaterialInput(
  name: string,
  index: number,
  request?: MaterialRequest,
): RecipeMaterialInput {
  const amount = request ? getRequestAmount(request) : "";
  const material: RecipeMaterialInput = {
    id: request?.id ?? `material-${index + 1}`,
    name,
    usage: request ? toRecipeDecisionMaterialUsage(request.usage) : "auto",
  };

  if (amount) {
    material.amount = amount;
  }

  return material;
}

export function getRecipeMaterialInputs(
  data: PromptData,
  retainedMaterialNames: readonly string[] = data.materials,
): RecipeMaterialInput[] {
  const requestByName = new Map<string, MaterialRequest>();
  if (data.materialUseMode === "specified") {
    for (const request of data.materialRequests) {
      const name = normalizeText(request.name);
      if (name && !requestByName.has(name)) {
        requestByName.set(name, request);
      }
    }
  }

  const seen = new Set<string>();
  return retainedMaterialNames.flatMap((materialName, index) => {
    const name = normalizeText(materialName);
    if (!name || seen.has(name)) {
      return [];
    }

    seen.add(name);
    return [createMaterialInput(name, index, requestByName.get(name))];
  });
}
