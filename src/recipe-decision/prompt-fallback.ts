import { buildPrompt } from "../prompt";
import type { PromptData } from "../types";

export function buildPromptCopyFallback(data: PromptData): string {
  return buildPrompt(data);
}
