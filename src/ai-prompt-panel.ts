import type { AppElements } from "./app-elements";
import { icon } from "./icons";
import { focusInputWithFeedback, setMaterialInputError } from "./input-feedback";
import type { PromptPanelServices } from "./output-panel";
import type { RecipeSnapshot } from "./recipe-application";
import { renderRecipeMarkdown } from "./recipe-markdown";

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

export function renderAiPromptPanel(
  aiPrompt: RecipeSnapshot["aiPrompt"],
  elements: AppElements,
): boolean {
  for (const button of [elements.sendPrompt, elements.sendPromptMobile]) {
    button.disabled = aiPrompt.status === "loading";
    const label = button.querySelector<HTMLElement>("[data-send-label]");
    if (label) label.textContent = button.disabled ? "送信中…" : "AIへ送信";
  }
  const panel = elements.aiPromptPanel;
  const status = panel.querySelector<HTMLElement>('[data-testid="ai-prompt-status"]');
  const reply = panel.querySelector<HTMLElement>('[data-testid="ai-prompt-reply"]');
  const empty = panel.querySelector<HTMLElement>('[data-testid="ai-prompt-empty"]');
  const notice = panel.querySelector<HTMLElement>('[data-testid="ai-prompt-answer-notice"]');
  if (reply && aiPrompt.status === "success" && !renderRecipeMarkdown(reply, aiPrompt.recipe)) {
    return false;
  }
  panel.dataset["state"] = aiPrompt.status;
  reply?.setAttribute("aria-busy", String(aiPrompt.status === "loading"));
  if (status) {
    if (aiPrompt.errorSource === "input") status.removeAttribute("role");
    else status.setAttribute("role", aiPrompt.status === "error" ? "alert" : "status");
    status.setAttribute(
      "aria-live",
      aiPrompt.errorSource === "input"
        ? "off"
        : aiPrompt.status === "error"
          ? "assertive"
          : "polite",
    );
    status.textContent =
      aiPrompt.status === "loading"
        ? "AIの回答を待っています。依頼文はコピーできます。"
        : aiPrompt.status === "error"
          ? aiPrompt.errorSource === "input"
            ? aiPrompt.errorMessage
            : `${aiPrompt.errorMessage} 再試行するには「AIへ送信」を押してください。`
          : aiPrompt.status === "success"
            ? "AIの回答を受け取りました。"
            : "";
  }
  const success = aiPrompt.status === "success";
  if (empty) empty.hidden = aiPrompt.status !== "idle";
  if (reply) {
    reply.hidden = !success;
    if (!success) reply.replaceChildren();
  }
  if (notice) notice.hidden = !success;
  return true;
}

export async function sendPromptToAi(
  elements: AppElements,
  services: PromptPanelServices,
): Promise<void> {
  if (services.application.getSnapshot().aiPrompt.status === "loading") return;
  services.flushPendingInputs();
  services.onChange();
  services.validateBeforeAiRecipe();
  const request = services.application.send();
  const snapshot = services.application.getSnapshot();
  if (!snapshot.materialRequests.length) {
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
  } else if (snapshot.aiPrompt.status === "loading" && window.innerWidth < 1024) {
    elements.aiPromptHeading.focus({ preventScroll: true });
    elements.aiPromptHeading.scrollIntoView({
      block: "start",
      behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth",
    });
  }
  await request;
}
