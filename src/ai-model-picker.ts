import { aiModels, findAiModel } from "./ai-models";
import { loadAiModelCatalog } from "./ai-recipe-client";
import type { RecipeApplication } from "./recipe-application";

export function renderAiModelPicker(): string {
  return `<div class="ai-model-picker">
    <label for="aiModel">利用するAI</label>
    <select id="aiModel" name="aiModel" data-testid="ai-model-select" aria-describedby="aiModelInfo aiModelStatus">
      ${aiModels.map((model) => `<option value="${model.id}"${model.provider === "groq" ? " disabled" : ""}>${model.label}（${model.provider === "cloudflare" ? "Cloudflare" : "Groq"}）</option>`).join("")}
    </select>
    <p class="field-hint" id="aiModelInfo" data-testid="ai-model-info"></p>
    <p class="field-hint" id="aiModelStatus" data-testid="ai-model-status" role="status">利用できるAIを確認しています。</p>
    <p class="field-hint">1分3回・1日10回まで（同じ接続元で共有、毎朝9時更新）。全体の無料枠で停止した場合も依頼文はコピーできます。</p>
  </div>`;
}

export function initializeAiModelPicker(application: RecipeApplication): void {
  const select = document.querySelector<HTMLSelectElement>('[data-testid="ai-model-select"]');
  const info = document.querySelector<HTMLElement>("#aiModelInfo");
  const status = document.querySelector<HTMLElement>("#aiModelStatus");
  const privacy = document.querySelector<HTMLElement>("#aiPrivacyNotice");
  if (!select || !info || !status || !privacy) throw new Error("AI model picker is missing");
  const refresh = (): void => {
    const snapshot = application.getSnapshot();
    const model = findAiModel(snapshot.selectedAiModel);
    if (!model) return;
    select.value = model.id;
    for (const option of select.options) {
      const entry = findAiModel(option.value);
      option.disabled = !entry || !snapshot.availableAiModels.includes(entry.id);
    }
    info.textContent = snapshot.availableAiModels.includes(model.id)
      ? `${model.label} / ${model.recipient}へ依頼文を送信します。`
      : "このモデルは現在利用できません。別のモデルを選ぶか、依頼文をコピーしてください。";
    privacy.textContent = `「AIへ送信」を押すと、依頼文全文を${model.recipient}へ送信します。依頼文は入力やコピーだけでは送信しません。`;
    for (const recipient of document.querySelectorAll<HTMLElement>("[data-model-recipient]")) {
      const text = `${model.provider === "cloudflare" ? "Cloudflare AI" : "Groq AI"}へ送信`;
      if (recipient.textContent !== text) recipient.textContent = text;
    }
  };
  select.addEventListener("change", () => {
    const model = findAiModel(select.value);
    if (model) application.setAiModel(model.id);
  });
  application.subscribe(refresh);
  refresh();
  void loadAiModelCatalog()
    .then((catalog) => {
      application.setAvailableAiModels(
        catalog.models.filter((entry) => entry.enabled).map((entry) => entry.id),
      );
      status.textContent = !application.getSnapshot().availableAiModels.length
        ? "現在利用できるAIがありません。依頼文はコピーできます。"
        : catalog.confirmed
          ? "選択したAIにだけ送信します。"
          : "利用状況を確認できませんでした。Cloudflareのモデルを試すか、依頼文をコピーできます。";
    })
    .catch(() => {
      status.textContent = "利用状況を確認できませんでした。依頼文はコピーできます。";
    });
}
