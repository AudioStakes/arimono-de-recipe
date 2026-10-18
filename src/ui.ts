import { initializeAiModelPicker, renderAiModelPicker } from "./ai-model-picker";
import {
  renderAiPromptAnswer,
  renderAiPromptPanel,
  renderAiPromptSendButton,
} from "./ai-prompt-panel";
import { generateRecipeFromPrompt } from "./ai-recipe-client";
import type { AppElements } from "./app-elements";
import { bindAppEvents } from "./app-events";
import { updateCookTimeDisplay } from "./combo-field";
import { type ComboRegistry, createComboRegistry } from "./combo-registry";
import {
  advancedConditionOrder,
  combos,
  cookTimeOptions,
  materialUsageOptions,
  recipeCountOptions,
  requestIntentOptions,
  servingGroups,
  servingsModeOptions,
} from "./data";
import { icon } from "./icons";
import { focusInputWithFeedback, setMaterialInputError } from "./input-feedback";
import type { PromptPanelServices } from "./output-panel";
import { refreshPromptPanel as refreshPromptPanelPanel } from "./output-panel";
import {
  createRecipeApplication,
  type RecipeApplication,
  type RecipeSnapshot,
} from "./recipe-application";
import { USE_UP_AMOUNT_REQUIRED_MESSAGE } from "./recipe-decision";
import { updateServingSteppers } from "./serving-controls";
import type { AppState, ComboConfig, ComboId } from "./types";

const createInitialState = (): AppState => {
  return {
    hasUserInput: false,
    inlineVisible: false,
    nearBottom: false,
    ticking: false,
    mobileSheetOpen: false,
  };
};

const queryElement = <T extends Element>(selector: string, root: ParentNode = document): T => {
  const element = root.querySelector<T>(selector);
  if (!element) throw new Error(`Element not found: ${selector}`);
  return element;
};

const queryAllElements = <T extends Element>(
  selector: string,
  root: ParentNode = document,
): T[] => [...root.querySelectorAll<T>(selector)];

const queryMaybeElement = <T extends Element>(
  selector: string,
  root: ParentNode = document,
): T | null => root.querySelector<T>(selector);

const fieldLabelHtml = (text: string, iconName: ComboConfig["icon"]): string =>
  `<span class="field-icon" aria-hidden="true">${icon(iconName)}</span>${text}`;

let outputPanelServices: PromptPanelServices | null = null;
function renderRadioOptions<T extends string>(
  name: string,
  options: readonly { value: T; label: string }[],
  defaultValue: T,
  className = "choice-grid",
  testIdBase = "",
  optionTestIdBase = testIdBase ? `${testIdBase}-option` : "",
): string {
  const testId = testIdBase ? ` data-testid="${testIdBase}"` : "";
  return `
    <div class="${className}"${testId}>
      ${options
        .map(({ value, label }) => {
          const optionTestId = optionTestIdBase
            ? ` data-testid="${optionTestIdBase}-${value}"`
            : "";
          return `
            <label class="choice-option">
              <input type="radio" name="${name}" value="${value}"${value === defaultValue ? " checked" : ""}${optionTestId} />
              <span>${label}</span>
            </label>
          `;
        })
        .join("")}
    </div>
  `;
}

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function getMaterialRequestErrors(state: RecipeSnapshot): Map<string, string> {
  return new Map(state.materialErrors.map((error) => [error.requestId, error.message]));
}

function syncMaterialRequestValidationState(state: RecipeSnapshot): void {
  const errors = getMaterialRequestErrors(state);
  for (const request of state.materialRequests) {
    const input = queryMaybeElement<HTMLInputElement>(
      `[data-material-amount-for="${CSS.escape(request.id)}"]`,
    );
    const error = queryMaybeElement<HTMLElement>(
      `[data-material-amount-error-for="${CSS.escape(request.id)}"]`,
    );
    const message = errors.get(request.id) ?? "";

    if (input) {
      input.required = request.usage === "use-up";
      if (message) {
        input.setAttribute("aria-invalid", "true");
      } else {
        input.removeAttribute("aria-invalid");
      }
    }

    if (error) {
      error.hidden = !message;
      if (error.textContent !== message) error.textContent = message;
      if (message) {
        error.setAttribute("role", "alert");
      } else {
        error.removeAttribute("role");
      }
    }
  }
}

function validateMaterialRequestPanel(state: RecipeSnapshot): boolean {
  const errors = state.materialErrors;
  syncMaterialRequestValidationState(state);

  const firstError = errors[0];
  if (!firstError) {
    return true;
  }

  const input = queryMaybeElement<HTMLInputElement>(
    `[data-material-amount-for="${CSS.escape(firstError.requestId)}"]`,
  );
  if (input) {
    focusInputWithFeedback(
      input,
      queryMaybeElement<HTMLElement>(
        `[data-material-amount-error-for="${CSS.escape(firstError.requestId)}"]`,
      ),
      queryElement<HTMLElement>("#bottomActions"),
    );
  }
  return false;
}

function renderMaterialUsePanel(state: RecipeSnapshot): void {
  const panel = queryMaybeElement<HTMLElement>("#materialUsePanel");
  if (!panel) return;
  const activeElement = document.activeElement;
  const focusedRadio =
    activeElement instanceof HTMLInputElement &&
    activeElement.type === "radio" &&
    panel.contains(activeElement)
      ? { name: activeElement.name, value: activeElement.value }
      : null;
  const focusedAmount =
    activeElement instanceof HTMLInputElement &&
    activeElement.dataset["materialAmountFor"] &&
    panel.contains(activeElement)
      ? {
          id: activeElement.id,
          start: activeElement.selectionStart,
          end: activeElement.selectionEnd,
        }
      : null;

  panel.hidden = false;

  if (state.materialRequests.length === 0) {
    panel.innerHTML =
      '<p class="field-hint">先に「家にある食材・材料」を追加すると、材料ごとの使い方を選べます。</p>';
    return;
  }

  const errors = getMaterialRequestErrors(state);

  panel.innerHTML = `
    <div class="material-request-list">
      ${[...state.materialRequests]
        .reverse()
        .map((request) => {
          const amountLabel = request.usage === "use-up" ? "量（必須）" : "量（任意）";
          const amountId = `materialAmount-${request.id}`;
          const errorId = `materialAmountError-${request.id}`;
          const errorMessage = errors.get(request.id) ?? "";
          const invalidAttributes = errorMessage ? ' aria-invalid="true"' : "";
          const describedBy = errorMessage ? ` aria-describedby="${errorId}"` : "";

          return `
            <fieldset class="material-request-row" data-material-request-id="${request.id}" data-testid="material-card-${request.id}">
              <legend class="visually-hidden">${escapeHtml(request.name)}</legend>
              <div class="material-card-top">
                <div class="material-name-host" data-material-name-for="${request.id}"></div>
                <label class="text-input-label material-amount-field underlined-field" for="${amountId}">
                  <span>${amountLabel}</span>
                  <input
                    id="${amountId}"
                    class="material-amount-input"
                    type="text"
                    value="${escapeHtml(request.useUpAmount)}"
                    data-material-amount-for="${request.id}"
                    data-testid="material-amount-${request.id}"
                    placeholder="例: 150g、1/2個"
                    autocomplete="off"
                    ${request.usage === "use-up" ? "required" : ""}
                    aria-errormessage="${errorId}"
                    ${describedBy}
                    ${invalidAttributes}
                  />
                </label>
              </div>
              ${renderRadioOptions(
                `materialUsage-${request.id}`,
                materialUsageOptions,
                request.usage,
                "segmented-control",
                `material-usage-control-${request.id}`,
                `material-usage-option-${request.id}`,
              )}
                <p
                  id="${errorId}"
                  class="field-error material-amount-error"
                  data-material-amount-error-for="${request.id}"
                  data-testid="material-use-up-error-${request.id}"
                  ${errorMessage ? 'role="alert"' : "hidden"}
                >${escapeHtml(errorMessage || USE_UP_AMOUNT_REQUIRED_MESSAGE)}</p>
            </fieldset>
          `;
        })
        .join("")}
    </div>
  `;
  if (focusedRadio) {
    panel
      .querySelector<HTMLInputElement>(
        `input[name="${CSS.escape(focusedRadio.name)}"][value="${CSS.escape(focusedRadio.value)}"]`,
      )
      ?.focus({ preventScroll: true });
  }
  if (focusedAmount) {
    const input = panel.querySelector<HTMLInputElement>(`#${CSS.escape(focusedAmount.id)}`);
    input?.focus({ preventScroll: true });
    if (focusedAmount.start !== null && focusedAmount.end !== null) {
      input?.setSelectionRange(focusedAmount.start, focusedAmount.end);
    }
  }
}

function setCollapsibleStateForField(field: HTMLElement, expanded: boolean): void {
  const button = field.querySelector<HTMLButtonElement>(".field-toggle");
  if (!button) return;

  button.setAttribute("aria-expanded", String(expanded));
  const chevron = button.querySelector<HTMLElement>(".field-toggle-chevron");
  if (chevron) {
    chevron.textContent = expanded ? "⌃" : "⌄";
  }

  const panelId = button.getAttribute("aria-controls");
  const panel = panelId ? document.getElementById(panelId) : null;
  if (panel) {
    panel.hidden = !expanded;
    panel.setAttribute("data-state", expanded ? "open" : "closed");
  }

  field.classList.toggle("is-open", expanded);
  field.setAttribute("data-state", expanded ? "open" : "closed");
}

function syncIntentSections(application: RecipeApplication): void {
  const intent = application.getSnapshot().requestIntent;
  const targetDishField = queryMaybeElement<HTMLElement>("#targetDishField");
  const pairingField = queryMaybeElement<HTMLElement>("#pairingTargetsField");
  const recipeCountField = queryMaybeElement<HTMLElement>('[data-collapsible="recipeCount"]');
  const recipeRoleField = queryMaybeElement<HTMLElement>("#recipeRolesField");

  if (targetDishField) {
    targetDishField.hidden = intent !== "target-dish";
  }

  if (pairingField) {
    pairingField.hidden = intent !== "pairing";
  }

  if (recipeCountField) {
    recipeCountField.hidden = intent === "target-dish";
    if (intent === "pairing") {
      setCollapsibleStateForField(recipeCountField, true);
    } else if (intent === "target-dish") {
      setCollapsibleStateForField(recipeCountField, false);
    }
  }

  const recipeCount = application.getSnapshot().effectiveRecipeCount;
  if (recipeRoleField) {
    recipeRoleField.hidden = intent === "target-dish" || recipeCount === "auto";
  }
}

function syncServingModeVisibility(application: RecipeApplication): void {
  const customPanel = queryMaybeElement<HTMLElement>("#customServingsPanel");
  if (customPanel) {
    customPanel.hidden = application.getSnapshot().servingsMode !== "custom";
  }
}

function syncRecipeRoleOrder(application: RecipeApplication): void {
  const intent = application.getSnapshot().requestIntent;
  const input = queryMaybeElement<HTMLInputElement>("#recipeRolesInput");
  if (input) {
    input.placeholder = intent === "pairing" ? "例: 副菜・一品" : "例: 主菜・しっかり";
  }
}

export function initializeApp(root: HTMLElement): void {
  document.title = "ありもの de レシピ";
  root.setAttribute("data-testid", "app-shell");
  root.innerHTML = renderAppShell();

  const state = createInitialState();
  const elements = getAppElements();
  renderFields();
  const application = createRecipeApplication({
    sendRecipe: (prompt, signal, model) => generateRecipeFromPrompt(prompt, fetch, signal, model),
  });
  const comboRegistry = createComboRegistry(elements.form, { application });
  comboRegistry.bind(elements.form);
  outputPanelServices = createOutputPanelServices(state, elements, comboRegistry, application);
  const outputPanel = outputPanelServices;
  if (!outputPanel) {
    throw new Error("Output panel was not initialized.");
  }

  bindAppEvents(state, elements, outputPanel);
  updateCookTimeDisplay(application.getSnapshot().cookTime);
  updateServingSteppers(application.getSnapshot().servingCounts);
  refreshPromptPanelPanel(state, elements, outputPanel);
  renderAiPromptPanel(application.getSnapshot().aiPrompt, elements);
  initializeAiModelPicker(application);
}

function renderCopyButton(id: string, testId: string, classes = ""): string {
  return `
    <button id="${id}" class="copy-icon-button copy-button button-secondary ${classes}" type="button" aria-label="AI向けレシピ依頼文をコピー" data-testid="${testId}" data-default-label="依頼文をコピー" data-success-label="コピーしました。普段使っているAIに貼り付けてください。">
      <span class="copy-button-icon" aria-hidden="true" data-icon="copy"></span>
      <span class="copy-label">依頼文をコピー</span>
      <span class="copy-status" aria-live="polite"></span>
    </button>
  `;
}

function renderAppShell(): string {
  return `
    <header class="site-header">
      <h1 class="site-title"><img class="brand-logo" src="/brand/arimono-title-logo.png" alt="ありもの de レシピ" width="2172" height="724" fetchpriority="high" /></h1>
      <p class="lead">冷蔵庫にあるもので、今日のごはんを。</p>
    </header>
    <div class="workspace">
      <form id="recipeForm" class="form" data-testid="recipe-form" autocomplete="off">
        <div id="basicFields" class="basic-fields" data-testid="basic-fields"></div>
        <div id="advancedFields" class="advanced-fields" data-testid="advanced-fields"></div>
        <div id="conditionChips" class="chips secondary-condition-chips" data-testid="condition-chips"></div>
        <section class="prompt-section" aria-labelledby="promptHeading">
          <div class="prompt-heading"><h2 id="promptHeading">ありもので、何を作る？</h2><p id="promptDescription">材料と要望をまとめた依頼文を送ります。</p></div>
          ${renderAiModelPicker()}
          <p class="ai-transmission-notice" data-testid="ai-transmission-notice"><span aria-hidden="true">${icon("info")}</span><span data-model-recipient>Cloudflare AIへ送信</span></p>
          <p class="visually-hidden" id="aiPrivacyNotice">「AIへ送信」を押すと、依頼文全文をCloudflareのAIへ送信します。依頼文は入力やコピーだけでは送信しません。</p>
          <div class="prompt-main-actions" role="group" aria-label="実行方法">
            ${renderAiPromptSendButton()}
            ${renderCopyButton("copyPrompt", "copy-prompt")}
          </div>
          ${renderAiPromptAnswer()}
          <details class="prompt-preview-details">
            <summary data-testid="prompt-preview-toggle">依頼文を見る</summary>
            <div class="output-shell"><textarea id="output" class="output" data-testid="prompt-output" aria-label="コピーするレシピ依頼文" aria-describedby="promptDescription" readonly></textarea></div>
          </details>
        </section>
      </form>
    </div>
    <footer class="site-footer" data-testid="site-footer" aria-label="サイト情報">
      <span>created by <a href="https://x.com/AudioStakes" target="_blank" rel="noopener noreferrer" data-testid="creator-link">@AudioStakes<span class="visually-hidden">（X・別タブで開く）</span></a></span>
      <span aria-hidden="true">·</span>
      <button id="privacyOpen" type="button" aria-haspopup="dialog" aria-controls="privacyDialog" data-testid="privacy-open">プライバシー</button>
    </footer>
    <dialog id="privacyDialog" class="privacy-dialog" aria-labelledby="privacyHeading" data-testid="privacy-dialog">
      <div class="privacy-heading">
        <h2 id="privacyHeading">プライバシー</h2>
        <button id="privacyClose" type="button" class="privacy-close" aria-label="プライバシーを閉じる" data-testid="privacy-close">×</button>
      </div>
      <div class="privacy-body">
        <h3>入力内容とAIへの送信</h3>
        <p>このアプリは入力内容を保存しません。食材・要望・依頼文の作成とコピーはブラウザ内で行います。「AIへ送信」を押したときだけ、依頼文全文を選択した送信先（Cloudflare Workers AIまたはGroq）へ送信します。モデル一覧の確認には入力内容を含めません。</p>
        <p>Cloudflareは標準推論を学習に使わないと説明しています。Groqは障害・不正利用の調査のため、入力や回答を通常最大30日保持する場合があります（法令でより長い保持が必要な場合を除きます）。送信先のデータの扱いをご確認ください。</p>
        <h3>AIの利用制限</h3>
        <p>過剰利用と無料枠の超過を防ぐため、Cloudflareが処理する接続元IPから日替わりのハッシュを作り、回数と使用量の集計だけをCloudflare D1に一時保存します。元のIP・食材・依頼文・回答はこの集計に保存しません。期限切れの集計は次の送信時に削除します。同じネットワークの利用者は枠を共有する場合があります。</p>
        <h3>アクセス解析</h3>
        <p>改善のため、Cloudflare Web Analyticsで閲覧ページ・参照元・端末・ブラウザ・表示速度などを集計します。食材・要望・依頼文・AI回答はアクセス解析へ送信しません。</p>
        <h3>Cookieなどの利用</h3>
        <p>アクセス解析にCookieやlocalStorage、個人を識別するフィンガープリントを使いません。通信に伴うIPアドレスはCloudflareで処理されます。</p>
        <p>詳しくは<a href="https://developers.cloudflare.com/web-analytics/data-metrics/core-web-vitals/#information-collected" target="_blank" rel="noopener noreferrer">解析データの説明<span class="visually-hidden">（別タブで開く）</span></a>、<a href="https://www.cloudflare.com/privacypolicy/" target="_blank" rel="noopener noreferrer">Cloudflareのプライバシーポリシー<span class="visually-hidden">（別タブで開く）</span></a>、<a href="https://console.groq.com/docs/your-data" target="_blank" rel="noopener noreferrer">Groqのデータの扱い<span class="visually-hidden">（別タブで開く）</span></a>をご確認ください。</p>
      </div>
    </dialog>
    <div class="bottom-sheet-backdrop" id="bottomSheetBackdrop" data-testid="bottom-sheet-backdrop" hidden></div>
    <div class="bottom-actions" id="bottomActions" data-testid="mobile-action-footer" data-state="closed">
      <div class="bottom-actions-inner" id="bottomActionsInner">
        <div class="sheet-summary-row">
          <p id="footerTransmissionNotice" class="ai-transmission-notice" data-testid="mobile-ai-transmission-notice"><span aria-hidden="true">${icon("info")}</span><span data-model-recipient>Cloudflare AIへ送信</span></p>
          <button id="sheetToggle" data-testid="mobile-prompt-preview-toggle" class="sheet-preview-button" type="button" aria-expanded="false" aria-controls="mobilePromptPanel">依頼文を見る</button>
        </div>
        <div class="sheet-actions">
          ${renderAiPromptSendButton(true)}
          ${renderCopyButton("copyPromptSticky", "copy-prompt-sticky", "copy-request-button")}
        </div>
        <div id="mobilePromptPanel" class="mobile-prompt-panel" data-testid="mobile-prompt-panel" data-state="closed" role="region" aria-labelledby="mobilePromptHeading" aria-hidden="true" tabindex="-1">
          <div class="mobile-prompt-head"><h2 id="mobilePromptHeading">AIに渡す依頼文</h2><button id="sheetClose" class="sheet-close" type="button" aria-label="閉じる">×</button></div>
          ${renderCopyButton("copyPromptMobile", "copy-prompt-mobile-panel")}
          <textarea id="mobileOutput" class="output mobile-output" data-testid="mobile-prompt-output" aria-label="コピーするレシピ依頼文" readonly></textarea>
        </div>
      </div>
    </div>
  `;
}

function getAppElements(): AppElements {
  return {
    form: queryElement("#recipeForm"),
    output: queryElement("#output"),
    mobileOutput: queryElement("#mobileOutput"),
    bottom: queryElement("#bottomActions"),
    bottomInner: queryElement("#bottomActionsInner"),
    bottomBackdrop: queryElement("#bottomSheetBackdrop"),
    sheetToggle: queryElement("#sheetToggle"),
    sheetClose: queryElement("#sheetClose"),
    chips: queryElement("#conditionChips"),
    copyPromptSticky: queryElement("#copyPromptSticky"),
    copyPromptMobile: queryElement("#copyPromptMobile"),
    sendPrompt: queryElement("#sendPrompt"),
    sendPromptMobile: queryElement("#sendPromptMobile"),
    aiPromptPanel: queryElement("#aiPromptPanel"),
    aiPromptHeading: queryElement("#ai-prompt-reply-heading"),
    privacyOpen: queryElement("#privacyOpen"),
    privacyDialog: queryElement("#privacyDialog"),
    privacyClose: queryElement("#privacyClose"),
  };
}

function renderFields(): void {
  queryElement("#basicFields").innerHTML = [renderComboField(getCombo("materials"))].join("");

  queryElement("#advancedFields").innerHTML = `
    <h2 class="section-title">今日のリクエスト<span class="section-hint">必要なところだけ</span></h2>
    <div class="request-settings">
      ${renderServingsField()}
      ${renderCollapsibleComboField(getCombo("cookingTools"))}
      ${renderCollapsibleField(
        "requestOptions",
        "作りたいもの・時間・こだわり",
        "heart",
        [
          renderRequestIntentField(),
          `<div id="targetDishField" hidden>${renderComboField(getCombo("targetDish"), "targetDishHint")}<p id="targetDishHint" class="field-hint">作りたい料理名を自由に入力できます。候補は入力補助です。</p></div>`,
          `<div id="pairingTargetsField" hidden>${renderComboField(getCombo("pairingTargets"))}</div>`,
          renderRecipeCountField(),
          renderCollapsibleCookTimeField(),
          ...advancedConditionOrder.map((id) => renderCollapsibleComboField(getCombo(id))),
          renderCollapsibleNotesField(),
        ].join(""),
      )}
    </div>
  `;

  queryAllElements<HTMLElement>("[data-icon]").forEach((element) => {
    const iconName = (element.dataset as DOMStringMap & { icon?: ComboConfig["icon"] }).icon;
    if (iconName) element.innerHTML = icon(iconName as ComboConfig["icon"]);
  });
}

function renderRequestIntentField(): string {
  return `
    <fieldset class="field fieldset intent-field" data-testid="recipe-item-requestIntent">
      <legend class="field-title">${fieldLabelHtml("今回やりたいこと", "heart")}</legend>
      ${renderRadioOptions("requestIntent", requestIntentOptions, "auto")}
    </fieldset>
  `;
}

function renderRecipeCountField(): string {
  return renderCollapsibleField(
    "recipeCount",
    "作りたい品数",
    "bowl",
    `
      <fieldset class="panel-fieldset">
        <legend class="visually-hidden">作りたい品数</legend>
        ${renderRadioOptions("recipeCount", recipeCountOptions, "auto")}
      </fieldset>
      <div id="recipeRolesField" class="recipe-role-subfield" data-testid="recipe-item-recipeRoles" hidden>
        <label class="subfield-label" for="recipeRolesInput">料理の役割・量感</label>
        ${renderComboFieldControl(getCombo("recipeRoles"), "", true)}
      </div>
    `,
  );
}

function renderComboField(combo: ComboConfig, describedBy = ""): string {
  return `
    <div class="field" data-testid="recipe-item-${combo.id}">
      ${combo.id === "materials" ? `<div class="section-heading"><h2><label class="field-title" for="${combo.id}Input">${combo.label}</label></h2><span id="materialCount" class="material-count">0件</span></div>` : `<label class="field-title" for="${combo.id}Input">${fieldLabelHtml(combo.label, combo.icon)}</label>`}
      ${renderComboFieldControl(combo, describedBy, true)}
      ${combo.id === "materials" ? '<p id="materialsError" class="field-error" data-testid="materials-error" hidden>家にある食材を入れてください。</p>' : ""}
    </div>
  `;
}

function renderComboFieldControl(
  combo: ComboConfig,
  describedBy = "",
  hasVisibleLabel = false,
): string {
  const inputId = `${combo.id}Input`;
  const suggestionsId = `${combo.id}Suggestions`;
  const describedByAttribute = describedBy ? ` aria-describedby="${describedBy}"` : "";
  const accessibleLabelAttribute = hasVisibleLabel ? "" : ` aria-label="${combo.label}"`;
  return `
    <div class="combo" data-combo="${combo.id}" data-testid="combo-${combo.id}">
      <div class="underlined-field">
        <input
          id="${inputId}"
          class="combo-input"
          data-testid="combo-input-${combo.id}"
          type="text"
          placeholder="${combo.placeholder}"
          autocomplete="off"
          autocapitalize="off"
          spellcheck="false"
          enterkeyhint="done"
          ${accessibleLabelAttribute}
          role="combobox"
          aria-autocomplete="list"
          aria-controls="${suggestionsId}"
          aria-expanded="false"
          ${describedByAttribute}
        />
        <button class="combo-picker" data-testid="combo-picker-${combo.id}" type="button" aria-label="${combo.label}の候補を表示" aria-controls="${suggestionsId}"></button>
        <div id="${suggestionsId}" class="suggestions" data-testid="combo-suggestions-${combo.id}" role="listbox" aria-label="${combo.label}の候補" aria-hidden="true"></div>
      </div>
      <div class="floating-chip-row" aria-live="polite"></div>
      ${combo.id === "materials" ? '<div data-testid="recipe-item-materialUse"><span class="visually-hidden">材料の使い方</span><div id="materialUsePanel" class="material-use-panel" data-testid="material-use-panel"></div></div>' : ""}
    </div>
  `;
}

function renderCollapsibleComboField(combo: ComboConfig): string {
  return renderCollapsibleField(combo.id, combo.label, combo.icon, renderComboFieldControl(combo));
}

function renderCollapsibleCookTimeField(): string {
  return renderCollapsibleField(
    "cookTime",
    "調理時間",
    "clock",
    `
      <div class="range-card">
        <div class="range-meta"><span>指定なし</span><span id="cookTimeLabel" class="range-value">指定なし</span><span>60分以内</span></div>
        <input id="cookTimeRange" data-testid="cook-time-range" type="range" min="0" max="${cookTimeOptions.length - 1}" step="1" value="0" aria-label="調理時間" />
      </div>
    `,
  );
}

function renderCollapsibleNotesField(): string {
  return renderCollapsibleField(
    "supplementalNotes",
    "その他の要望",
    "note",
    `
      <div class="textarea-field">
        <textarea id="supplementalNotes" data-testid="supplemental-notes" aria-label="その他の要望" placeholder="例: 子ども用に辛くしない。冷蔵庫で3日間保存したい。"></textarea>
      </div>
    `,
  );
}

function renderCollapsibleField(
  id: string,
  label: string,
  iconName: ComboConfig["icon"],
  body: string,
): string {
  const panelId = `${id}Panel`;
  return `
    <section class="field field-collapsible" data-collapsible="${id}" data-testid="recipe-item-${id}" data-state="closed">
      <button
        class="field-toggle"
        type="button"
        data-testid="recipe-item-toggle-${id}"
        aria-expanded="false"
        aria-controls="${panelId}"
      >
        <span class="field-toggle-main">
          <span class="field-icon" aria-hidden="true">${icon(iconName)}</span>
          <span class="field-toggle-copy"><span class="field-toggle-label">${label}</span><span class="field-toggle-value" data-summary-for="${id}">指定なし</span></span>
        </span>
        <span class="field-toggle-chevron" aria-hidden="true">⌄</span>
      </button>
      <div id="${panelId}" class="field-panel" data-testid="recipe-item-panel-${id}" data-state="closed" hidden>
        ${body}
      </div>
    </section>
  `;
}

function renderServingsField(): string {
  const controls = servingGroups
    .map(
      ({ id, label, icon: iconName }) => `
        <div class="serving-card">
          <div class="serving-label" id="${id}Label" data-testid="serving-label-${id}"><span aria-hidden="true">${icon(iconName)}</span>${label}</div>
          <div class="serving-stepper" role="group" data-serving-id="${id}" data-testid="serving-stepper-${id}" aria-labelledby="${id}Label">
            <button class="serving-adjust serving-minus" data-testid="serving-minus-${id}" type="button" aria-label="${label}を1人減らす">−</button>
            <span class="serving-count" data-testid="serving-count-${id}" aria-live="polite">0人</span>
            <button class="serving-adjust serving-plus" data-testid="serving-plus-${id}" type="button" aria-label="${label}を1人増やす">+</button>
          </div>
        </div>
      `,
    )
    .join("");

  return renderCollapsibleField(
    "servings",
    "人数・分量",
    "users",
    `
    <fieldset class="panel-fieldset"><legend class="visually-hidden">人数・分量</legend>
      ${renderRadioOptions("servingsMode", servingsModeOptions, "unspecified")}
      <div id="customServingsPanel" class="custom-servings-panel" data-testid="custom-servings-panel" hidden>
        <div class="serving-grid" role="group" aria-label="詳しい人数">${controls}</div>
      </div>
    </fieldset>`,
  );
}

function getCombo(id: ComboId): ComboConfig {
  const combo = combos.find((item) => item.id === id);
  if (!combo) throw new Error(`Combo not found: ${id}`);
  return combo;
}

function createOutputPanelServices(
  state: AppState,
  elements: ReturnType<typeof getAppElements>,
  comboRegistry: ComboRegistry,
  application: RecipeApplication,
): PromptPanelServices {
  let materialControlsStructure = "";
  let aiPresentation = "";
  const refresh = (): void => {
    const snapshot = application.getSnapshot();
    if (snapshot.materialRequests.length) setMaterialInputError(elements.form, false);
    const structure = JSON.stringify(
      snapshot.materialRequests.map(({ id, name, usage }) => [id, name, usage]),
    );
    if (structure !== materialControlsStructure) {
      renderMaterialUsePanel(snapshot);
      comboRegistry.renderValues("materials");
      materialControlsStructure = structure;
    }
    syncMaterialRequestValidationState(snapshot);
    queryElement("#materialCount").textContent = `${snapshot.materialRequests.length}件`;
    const effectiveData = application.readPromptData();
    const countLabel =
      recipeCountOptions.find((option) => option.value === snapshot.effectiveRecipeCount)?.label ??
      "おまかせ";
    const roleSummary = effectiveData.recipeRoles.join("、");
    const summaryValues: Record<string, string> = {
      servings: effectiveData.servings || "指定なし",
      cookingTools: snapshot.values.cookingTools.join("、") || "指定なし",
      requestOptions: [
        requestIntentOptions.find((option) => option.value === snapshot.requestIntent)?.label,
        ...effectiveData.targetDish,
        ...effectiveData.pairingTargets,
        snapshot.effectiveRecipeCount !== "auto" ? countLabel : "",
        roleSummary,
        snapshot.cookTime,
        snapshot.values.recipeDirections.length
          ? `方向性 ${snapshot.values.recipeDirections.length}件`
          : "",
        snapshot.values.ngFoodsAndSeasonings.length
          ? `NG ${snapshot.values.ngFoodsAndSeasonings.length}件`
          : "",
        snapshot.supplementalNotes.trim() ? "その他の要望あり" : "",
      ]
        .filter(Boolean)
        .join("・"),
      recipeCount: [countLabel, roleSummary].filter(Boolean).join("・"),
      cookTime: snapshot.cookTime || "指定なし",
      recipeDirections: snapshot.values.recipeDirections.join("、") || "指定なし",
      ngFoodsAndSeasonings: snapshot.values.ngFoodsAndSeasonings.join("、") || "指定なし",
      supplementalNotes: snapshot.supplementalNotes.trim() ? "入力あり" : "指定なし",
    };
    for (const element of queryAllElements<HTMLElement>("[data-summary-for]")) {
      const text = summaryValues[element.dataset["summaryFor"] ?? ""] ?? "指定なし";
      if (element.textContent !== text) element.textContent = text;
    }
    syncIntentSections(application);
    syncServingModeVisibility(application);
    // Only role mode changes need to rebuild pills; leave active editors alone.
    syncRecipeRoleOrder(application);
    updateCookTimeDisplay(snapshot.cookTime);
    updateServingSteppers(snapshot.servingCounts);
    if (outputPanelServices) refreshPromptPanelPanel(state, elements, outputPanelServices);
    const nextAiPresentation = JSON.stringify([
      snapshot.aiPrompt,
      snapshot.selectedAiModel,
      snapshot.availableAiModels,
    ]);
    if (nextAiPresentation !== aiPresentation) {
      aiPresentation = nextAiPresentation;
      if (
        !renderAiPromptPanel(
          snapshot.aiPrompt,
          elements,
          snapshot.availableAiModels.includes(snapshot.selectedAiModel),
        )
      )
        application.reportRenderFailure();
    }
  };
  let roleMode = application.isSingle("recipeRoles");
  application.subscribe(() => {
    const nextRoleMode = application.isSingle("recipeRoles");
    if (nextRoleMode !== roleMode) {
      roleMode = nextRoleMode;
      comboRegistry.renderValues("recipeRoles");
    }
    refresh();
  });
  const notifyOutputChange = (): void => {
    state.hasUserInput = true;
    refresh();
  };
  comboRegistry.setOnChange(notifyOutputChange);
  const updateInput = (event: Event): void => {
    const input = event.target;
    if (!(input instanceof HTMLInputElement || input instanceof HTMLTextAreaElement)) return;
    state.hasUserInput = true;
    if (input.dataset["materialAmountFor"]) {
      application.setMaterialAmount(input.dataset["materialAmountFor"], input.value);
    } else if (
      input.name.startsWith("materialUsage-") &&
      input instanceof HTMLInputElement &&
      input.checked
    ) {
      const usage = materialUsageOptions.find((option) => option.value === input.value)?.value;
      if (usage) application.updateMaterial(input.name.slice("materialUsage-".length), { usage });
    } else if (
      input.name === "requestIntent" &&
      input instanceof HTMLInputElement &&
      input.checked
    ) {
      const value = requestIntentOptions.find((option) => option.value === input.value)?.value;
      if (value) application.setRequestIntent(value);
    } else if (input.name === "recipeCount" && input instanceof HTMLInputElement && input.checked) {
      const value = recipeCountOptions.find((option) => option.value === input.value)?.value;
      if (value) application.setRecipeCount(value);
    } else if (
      input.name === "servingsMode" &&
      input instanceof HTMLInputElement &&
      input.checked
    ) {
      const value = servingsModeOptions.find((option) => option.value === input.value)?.value;
      if (value) application.setServingsMode(value);
    } else if (input.id === "cookTimeRange") {
      const value = cookTimeOptions[Number(input.value)] ?? "指定なし";
      application.setCookTime(value === "指定なし" ? "" : value);
    } else if (input.id === "supplementalNotes") {
      application.setSupplementalNotes(input.value);
    }
  };
  elements.form.addEventListener("input", updateInput);
  elements.form.addEventListener("change", updateInput);
  refresh();
  return {
    application,
    readConditions: application.readPromptData,
    getPrompt: () => application.getSnapshot().prompt,
    flushPendingInputs: () => comboRegistry.flushPendingInputs(),
    setHasUserInput: (value) => {
      state.hasUserInput = value;
    },
    setNearBottom: (value) => {
      state.nearBottom = value;
    },
    removeComboValue: (group, value) => comboRegistry.removeValue(group, value),
    clearCombo: (group) => comboRegistry.clear(group),
    clearCookTime: () => {
      application.setCookTime("");
      queryElement<HTMLInputElement>("#cookTimeRange").value = "0";
    },
    clearSupplementalNotes: () => {
      application.setSupplementalNotes("");
      queryElement<HTMLTextAreaElement>("#supplementalNotes").value = "";
    },
    adjustServings: (id, delta) => {
      state.hasUserInput = true;
      application.adjustServings(id, delta);
    },
    validateBeforeAiRecipe: () => validateMaterialRequestPanel(application.getSnapshot()),
    onChange: notifyOutputChange,
  };
}
