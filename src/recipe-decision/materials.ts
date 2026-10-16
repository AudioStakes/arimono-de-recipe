import type { MaterialRequest } from "../types";

export const USE_UP_AMOUNT_REQUIRED_MESSAGE = "使い切る場合は量を入力してください。";

export type MaterialInputValidationError = {
  requestId: string;
  message: string;
};

function normalizeText(value: string): string {
  return value.replace(/\s+/g, " ").trim();
}

export function validateMaterialRequestAmounts(
  requests: readonly MaterialRequest[],
): MaterialInputValidationError[] {
  return requests.flatMap((request) => {
    if (request.usage !== "use-up" || normalizeText(request.useUpAmount)) {
      return [];
    }

    return [
      {
        requestId: request.id,
        message: USE_UP_AMOUNT_REQUIRED_MESSAGE,
      },
    ];
  });
}
