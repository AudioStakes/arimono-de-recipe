import { generateRecipeFromPrompt } from "./ai-recipe-client";
import type { AppElements } from "./app-elements";
import { icon } from "./icons";
import { focusInputWithFeedback, setMaterialInputError } from "./input-feedback";
import { type PromptPanelServices, refreshPromptPanel } from "./output-panel";
import { buildPrompt } from "./prompt";
import { renderRecipeMarkdown } from "./recipe-markdown";
import type { AppState } from "./types";

export function renderAiPromptSendButton(sticky = false): string {
  return `
    <button id="${sticky ? "sendPromptMobile" : "sendPrompt"}" class="action-button button-primary" type="button" data-testid="${sticky ? "mobile-ai-prompt-send" : "ai-prompt-send"}" aria-label="この依頼文をAIへ送信" aria-describedby="aiPrivacyNotice">
      <span class="action-button-icon" aria-hidden="true" data-icon="send"></span>
      <span data-send-label>AIへ送信</span>
    </button>
  `;
}

export function renderAiPromptAnswer(): string {
  return `
    <article id="aiPromptPanel" class="ai-prompt-panel" data-testid="ai-prompt-panel" data-state="idle" aria-labelledby="ai-prompt-reply-heading">
      <h3 id="ai-prompt-reply-heading" data-testid="ai-prompt-heading" tabindex="-1">AIの回答</h3>
      <p class="ai-prompt-empty" data-testid="ai-prompt-empty"><span aria-hidden="true">${icon("send")}</span>材料を入れて、AIへ送信してください。</p>
      <p data-testid="ai-prompt-status" role="status" aria-live="polite"></p>
      <div class="ai-recipe-answer" data-testid="ai-prompt-reply" hidden></div>
      <p class="field-hint ai-answer-notice" data-testid="ai-prompt-answer-notice" hidden><span aria-hidden="true">${icon("alert")}</span>材料・分量・NG食材・加熱条件を確認してください。</p>
    </article>
  `;
}

export function renderAiPromptPanel(state: AppState, elements: AppElements): void {
  for (const button of [elements.sendPrompt, elements.sendPromptMobile]) {
    button.disabled = state.aiPrompt.status === "loading";
    const label = button.querySelector<HTMLElement>("[data-send-label]");
    if (label) label.textContent = button.disabled ? "送信中…" : "AIへ送信";
  }
  const panel = elements.aiPromptPanel;
  const status = panel.querySelector<HTMLElement>('[data-testid="ai-prompt-status"]');
  const reply = panel.querySelector<HTMLElement>('[data-testid="ai-prompt-reply"]');
  const empty = panel.querySelector<HTMLElement>('[data-testid="ai-prompt-empty"]');
  const notice = panel.querySelector<HTMLElement>('[data-testid="ai-prompt-answer-notice"]');
  if (
    reply &&
    state.aiPrompt.status === "success" &&
    !renderRecipeMarkdown(reply, state.aiPrompt.recipe)
  ) {
    state.aiPrompt.status = "error";
    state.aiPrompt.recipe = "";
    state.aiPrompt.errorSource = "request";
    state.aiPrompt.errorMessage =
      "AIの回答を表示できませんでした。もう一度送信するか、依頼文をコピーしてください。";
  }
  panel.dataset["state"] = state.aiPrompt.status;
  reply?.setAttribute("aria-busy", String(state.aiPrompt.status === "loading"));
  if (status) {
    status.setAttribute("role", state.aiPrompt.status === "error" ? "alert" : "status");
    status.setAttribute("aria-live", state.aiPrompt.status === "error" ? "assertive" : "polite");
    status.textContent =
      state.aiPrompt.status === "loading"
        ? "AIの回答を待っています。依頼文はコピーできます。"
        : state.aiPrompt.status === "error"
          ? state.aiPrompt.errorSource === "input"
            ? state.aiPrompt.errorMessage
            : `${state.aiPrompt.errorMessage} 再試行するには「AIへ送信」を押してください。`
          : state.aiPrompt.status === "success"
            ? "AIの回答を受け取りました。"
            : "";
  }
  const success = state.aiPrompt.status === "success";
  if (empty) empty.hidden = state.aiPrompt.status !== "idle";
  if (reply) {
    reply.hidden = !success;
    if (!success) reply.replaceChildren();
  }
  if (notice) notice.hidden = !success;
}

export function resetAiPromptForInputChange(
  state: AppState,
  elements: AppElements,
  prompt: string,
): void {
  if (state.aiPrompt.status === "idle" || state.aiPrompt.submittedPrompt === prompt) return;
  state.aiPrompt.controller?.abort();
  state.aiPrompt = {
    status: "idle",
    submittedPrompt: "",
    recipe: "",
    errorMessage: "",
    errorSource: null,
    requestId: state.aiPrompt.requestId + 1,
    controller: null,
  };
  renderAiPromptPanel(state, elements);
}

export async function sendPromptToAi(
  state: AppState,
  elements: AppElements,
  services: PromptPanelServices,
): Promise<void> {
  if (state.aiPrompt.status === "loading") return;
  services.flushPendingInputs();
  refreshPromptPanel(state, elements, services);
  const data = services.readConditions();
  const prompt = buildPrompt(data);
  const requestId = state.aiPrompt.requestId + 1;
  const validAmounts = services.validateBeforeAiRecipe();
  const errorMessage = !validAmounts
    ? "使い切る材料の分量を入力してください。依頼文はコピーできます。"
    : data.materials.length === 0
      ? "まずは家にある食材を入れてください。"
      : "";
  const controller = new AbortController();
  state.aiPrompt = {
    status: errorMessage ? "error" : "loading",
    submittedPrompt: prompt,
    recipe: "",
    errorMessage,
    errorSource: errorMessage ? "input" : null,
    requestId,
    controller: errorMessage ? null : controller,
  };
  renderAiPromptPanel(state, elements);
  if (errorMessage) {
    if (!data.materials.length) {
      setMaterialInputError(elements.form, true);
      const input = elements.form.querySelector<HTMLInputElement>(
        '[data-testid="combo-input-materials"]',
      );
      if (input)
        focusInputWithFeedback(
          input,
          elements.form.querySelector<HTMLElement>('[data-testid="materials-error"]'),
          elements.bottom,
        );
    }
    return;
  }
  if (window.innerWidth < 1024) {
    elements.aiPromptHeading.focus({ preventScroll: true });
    elements.aiPromptHeading.scrollIntoView({
      block: "start",
      behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth",
    });
  }
  const result = await generateRecipeFromPrompt(prompt, fetch, controller.signal);
  if (state.aiPrompt.requestId !== requestId) return;
  const currentPrompt = buildPrompt(services.readConditions());
  if (currentPrompt !== prompt) {
    resetAiPromptForInputChange(state, elements, currentPrompt);
    return;
  }
  state.aiPrompt = {
    ...state.aiPrompt,
    status: result.ok ? "success" : "error",
    recipe: result.ok ? result.recipe : "",
    errorMessage: result.ok ? "" : result.error.message,
    errorSource: result.ok ? null : "request",
    controller: null,
  };
  renderAiPromptPanel(state, elements);
}
