import { generateRecipeFromPrompt } from "./ai-recipe-client";
import type { AppElements } from "./app-elements";
import { type PromptPanelServices, refreshPromptPanel } from "./output-panel";
import { buildPrompt } from "./prompt";
import type { AiRecipeSurface, AppState } from "./types";

export function renderAiPromptControls(surface: AiRecipeSurface): string {
  const mobile = surface === "mobile";
  const prefix = mobile ? "mobile-ai-prompt" : "ai-prompt";
  return `
    <div class="prompt-action-card">
      <h3>依頼文をこのアプリのAIへ送る</h3>
      <p id="${prefix}-notice" class="field-hint">下のボタンを押すと、表示中の依頼文全文をCloudflareのAIへ送信します。コピーだけでは送信しません。</p>
      <button id="${mobile ? "sendPromptMobile" : "sendPrompt"}" class="action-button button-primary" type="button" data-testid="${prefix}-send" aria-describedby="${prefix}-notice">この依頼文をAIへ送信</button>
      <div id="${mobile ? "aiPromptPanelMobile" : "aiPromptPanel"}" data-testid="${prefix}-panel" data-state="idle" hidden>
        <p data-testid="${prefix}-status"></p>
        <h3 id="${prefix}-reply-heading" hidden>この依頼文へのAIの回答</h3>
        <textarea class="output" data-testid="${prefix}-reply" aria-labelledby="${prefix}-reply-heading" readonly hidden></textarea>
        <p class="field-hint" data-testid="${prefix}-answer-notice" hidden>この回答は材料・NG条件の自動照合を行いません。実際に作る前に、材料・分量・NG条件と手順を確認してください。回答が途中で終わる場合もあります。</p>
      </div>
    </div>
  `;
}

export function renderAiPromptPanel(state: AppState, elements: AppElements): void {
  for (const surface of ["desktop", "mobile"] as const) {
    const button = surface === "desktop" ? elements.sendPrompt : elements.sendPromptMobile;
    const panel = surface === "desktop" ? elements.aiPromptPanel : elements.aiPromptPanelMobile;
    const prefix = surface === "desktop" ? "ai-prompt" : "mobile-ai-prompt";
    const status = panel.querySelector<HTMLElement>(`[data-testid="${prefix}-status"]`);
    const reply = panel.querySelector<HTMLTextAreaElement>(`[data-testid="${prefix}-reply"]`);
    const heading = panel.querySelector<HTMLElement>("h3");
    const notice = panel.querySelector<HTMLElement>(`[data-testid="${prefix}-answer-notice"]`);
    button.disabled = state.aiPrompt.status === "loading";
    button.textContent = button.disabled ? "AIの回答を待っています…" : "この依頼文をAIへ送信";
    panel.hidden = state.aiPrompt.status === "idle";
    panel.dataset["state"] = state.aiPrompt.status;
    if (status) {
      if (state.aiPrompt.activeSurface === surface) {
        status.setAttribute("role", state.aiPrompt.status === "error" ? "alert" : "status");
      } else {
        status.removeAttribute("role");
      }
      status.textContent =
        state.aiPrompt.status === "loading"
          ? "依頼文を送信しました。AIの回答を待っています。コピーは引き続き使えます。"
          : state.aiPrompt.status === "error"
            ? state.aiPrompt.errorMessage
            : state.aiPrompt.status === "success"
              ? "AIの回答を受け取りました。"
              : "";
    }
    const success = state.aiPrompt.status === "success";
    if (reply) {
      reply.hidden = !success;
      reply.value = state.aiPrompt.recipe;
    }
    if (heading) heading.hidden = !success;
    if (notice) notice.hidden = !success;
  }
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
    activeSurface: state.aiPrompt.activeSurface,
    submittedPrompt: "",
    recipe: "",
    errorMessage: "",
    requestId: state.aiPrompt.requestId + 1,
    controller: null,
  };
  renderAiPromptPanel(state, elements);
}

export async function sendPromptToAi(
  state: AppState,
  elements: AppElements,
  services: PromptPanelServices,
  surface: AiRecipeSurface,
): Promise<void> {
  if (state.aiPrompt.status === "loading") return;
  services.flushPendingInputs();
  refreshPromptPanel(state, elements, services);
  const data = services.readConditions();
  const prompt = buildPrompt(data);
  const requestId = state.aiPrompt.requestId + 1;
  const validAmounts = services.validateBeforeAiRecipe();
  const errorMessage = !validAmounts
    ? "使い切る材料の分量を入力してください。依頼文コピーは引き続き使えます。"
    : data.materials.length === 0
      ? "まずは家にある食材を入れてください。"
      : "";
  const controller = new AbortController();
  state.aiPrompt = {
    status: errorMessage ? "error" : "loading",
    activeSurface: surface,
    submittedPrompt: prompt,
    recipe: "",
    errorMessage,
    requestId,
    controller: errorMessage ? null : controller,
  };
  renderAiPromptPanel(state, elements);
  if (errorMessage) return;
  const result = await generateRecipeFromPrompt(prompt, fetch, controller.signal);
  if (state.aiPrompt.requestId !== requestId || buildPrompt(services.readConditions()) !== prompt)
    return;
  state.aiPrompt = {
    ...state.aiPrompt,
    status: result.ok ? "success" : "error",
    recipe: result.ok ? result.recipe : "",
    errorMessage: result.ok ? "" : result.error.message,
    controller: null,
  };
  renderAiPromptPanel(state, elements);
}
