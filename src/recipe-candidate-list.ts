import type {
  AiRecipeCandidate,
  AiRecipeCookingTab,
  AiRecipeMaterialInput,
  AiRecipeSurface,
} from "./types";

type RecipeCandidateListOptions = {
  surface: AiRecipeSurface;
  candidates: readonly AiRecipeCandidate[];
  materialInputs: readonly AiRecipeMaterialInput[];
  selectedCandidateId: string;
  onSelect: (candidateId: string) => void;
  onCook: (candidateId: string) => void;
  onBack: () => void;
};

type RecipeCookingViewOptions = {
  surface: AiRecipeSurface;
  candidate: AiRecipeCandidate;
  materialInputs: readonly AiRecipeMaterialInput[];
  activeTab: AiRecipeCookingTab;
  onTabChange: (tab: AiRecipeCookingTab) => void;
  onBack: () => void;
};

const cookingTabs = [
  { id: "materials", label: "材料" },
  { id: "instructions", label: "作り方" },
  { id: "taste", label: "味の調整" },
] as const satisfies readonly { id: AiRecipeCookingTab; label: string }[];

function getNonShoppingBadgeLabel(badge: AiRecipeCandidate["badges"][number]): string {
  switch (badge) {
    case "quick":
      return "時短";
    case "easy":
      return "かんたん";
    case "uses_up":
      return "使い切り";
    case "few_dishes":
      return "洗い物少なめ";
    case "kids":
      return "子ども向け";
    default:
      return "";
  }
}

export function getVisibleCandidateBadgeLabels(candidate: AiRecipeCandidate): string[] {
  const labels = candidate.miss.length > 0 ? ["買い足しあり"] : [];

  for (const badge of candidate.badges) {
    const label = getNonShoppingBadgeLabel(badge);
    if (label && !labels.includes(label)) {
      labels.push(label);
    }
  }

  return labels;
}

export function getMissingIngredientLabels(candidate: AiRecipeCandidate): string[] {
  return candidate.miss.map((ingredient) => `追加: ${ingredient}`);
}

function normalizeForComparison(value: string): string {
  return value.replace(/\s+/g, "").toLowerCase();
}

function findMaterialInput(
  materialName: string,
  materialInputs: readonly AiRecipeMaterialInput[],
): AiRecipeMaterialInput | undefined {
  const normalizedName = normalizeForComparison(materialName);
  return materialInputs.find(
    (material) => normalizeForComparison(material.name) === normalizedName,
  );
}

function getMaterialUsageLabel(usage: AiRecipeMaterialInput["usage"]): string {
  switch (usage) {
    case "required":
      return "必ず使う";
    case "use_up":
      return "使い切り";
    default:
      return "";
  }
}

export function getUsedMaterialLabels(
  candidate: AiRecipeCandidate,
  materialInputs: readonly AiRecipeMaterialInput[],
): string[] {
  return candidate.use.map((materialName) => {
    const material = findMaterialInput(materialName, materialInputs);
    if (!material) {
      return materialName;
    }

    const details = [material.amount, getMaterialUsageLabel(material.usage)].filter(Boolean);
    return details.length > 0 ? `${materialName}（${details.join("・")}）` : materialName;
  });
}

export function getSeasoningLabels(candidate: AiRecipeCandidate): string[] {
  const usedMaterials = candidate.use.map(normalizeForComparison);
  return candidate.ing.filter((ingredient) => {
    const normalizedIngredient = normalizeForComparison(ingredient);
    return !usedMaterials.some(
      (material) => normalizedIngredient === material || normalizedIngredient.includes(material),
    );
  });
}

export function getTasteAdjustmentLabels(): string[] {
  return ["塩・しょうゆは少量ずつ足す", "濃ければ水かだしでのばす"];
}

function getTestId(surface: AiRecipeSurface, testId: string): string {
  return surface === "mobile" ? `mobile-${testId}` : testId;
}

function renderTextElement<K extends keyof HTMLElementTagNameMap>(
  tagName: K,
  text: string,
  className = "",
): HTMLElementTagNameMap[K] {
  const element = document.createElement(tagName);
  element.textContent = text;
  if (className) {
    element.className = className;
  }
  return element;
}

function renderInlineList(items: readonly string[], className: string): HTMLUListElement {
  const list = document.createElement("ul");
  list.className = className;
  list.setAttribute("role", "list");

  for (const item of items) {
    const listItem = document.createElement("li");
    listItem.textContent = item;
    list.appendChild(listItem);
  }

  return list;
}

function renderCandidate(
  candidate: AiRecipeCandidate,
  options: RecipeCandidateListOptions,
): HTMLLIElement {
  const selected = candidate.id === options.selectedCandidateId;
  const detailId = getTestId(options.surface, "recipe-candidate-detail");
  const listItem = document.createElement("li");
  listItem.className = "recipe-candidate-item";
  listItem.setAttribute(
    "data-testid",
    getTestId(options.surface, `recipe-candidate-${candidate.id}`),
  );
  listItem.setAttribute("data-state", selected ? "selected" : "idle");

  const article = document.createElement("article");
  article.className = "recipe-candidate-card";
  article.setAttribute(
    "aria-labelledby",
    `${getTestId(options.surface, "recipe-candidate-title")}-${candidate.id}`,
  );

  const heading = renderTextElement("h4", candidate.title, "recipe-candidate-title");
  heading.id = `${getTestId(options.surface, "recipe-candidate-title")}-${candidate.id}`;

  const meta = document.createElement("p");
  meta.className = "recipe-candidate-meta";
  meta.textContent = `${candidate.time}分`;

  const badges = renderInlineList(
    getVisibleCandidateBadgeLabels(candidate),
    "recipe-candidate-badges",
  );

  const use = renderInlineList(
    getUsedMaterialLabels(candidate, options.materialInputs),
    "recipe-candidate-use",
  );
  use.setAttribute("aria-label", "使う材料と使い方");

  const missing = renderInlineList(getMissingIngredientLabels(candidate), "recipe-candidate-miss");
  missing.setAttribute("aria-label", "追加材料");

  const why = renderTextElement("p", candidate.why, "recipe-candidate-why");

  const button = document.createElement("button");
  button.type = "button";
  button.className = "recipe-candidate-select";
  button.textContent = selected ? "選択中" : "これにする";
  button.setAttribute("aria-pressed", String(selected));
  if (selected) {
    button.setAttribute("aria-controls", detailId);
  }
  button.setAttribute("aria-label", `「${candidate.title}」の詳細を表示`);
  button.setAttribute(
    "data-testid",
    getTestId(options.surface, `recipe-candidate-select-${candidate.id}`),
  );
  button.addEventListener("click", () => options.onSelect(candidate.id));

  article.append(heading, meta, badges, use);
  if (candidate.miss.length > 0) {
    article.appendChild(missing);
  }
  article.append(why, button);
  listItem.appendChild(article);
  return listItem;
}

function renderCandidateDetail(
  candidate: AiRecipeCandidate,
  options: RecipeCandidateListOptions,
): HTMLElement {
  const section = document.createElement("section");
  section.className = "recipe-candidate-detail";
  section.setAttribute("data-testid", getTestId(options.surface, "recipe-candidate-detail"));
  section.id = getTestId(options.surface, "recipe-candidate-detail");
  section.setAttribute(
    "aria-labelledby",
    `${getTestId(options.surface, "recipe-candidate-detail-title")}`,
  );
  section.tabIndex = -1;

  const heading = renderTextElement("h4", candidate.title, "recipe-candidate-detail-title");
  heading.id = getTestId(options.surface, "recipe-candidate-detail-title");

  const materialContextHeading = renderTextElement("h5", "使う材料", "recipe-candidate-subheading");
  const materialContext = renderInlineList(
    getUsedMaterialLabels(candidate, options.materialInputs),
    "recipe-candidate-detail-list",
  );

  const ingredientsHeading = renderTextElement("h5", "使うもの", "recipe-candidate-subheading");
  const ingredients = renderInlineList(candidate.ing, "recipe-candidate-detail-list");

  const missingHeading = renderTextElement("h5", "追加する材料", "recipe-candidate-subheading");
  const missing = renderInlineList(
    getMissingIngredientLabels(candidate),
    "recipe-candidate-detail-list",
  );

  const stepsHeading = renderTextElement("h5", "作り方", "recipe-candidate-subheading");
  const steps = document.createElement("ol");
  steps.className = "recipe-candidate-detail-list";
  for (const step of candidate.steps) {
    const item = document.createElement("li");
    item.textContent = step;
    steps.appendChild(item);
  }

  const tasteHeading = renderTextElement("h5", "味の調整", "recipe-candidate-subheading");
  const taste = renderInlineList(getTasteAdjustmentLabels(), "recipe-candidate-detail-list");

  const cook = document.createElement("button");
  cook.type = "button";
  cook.className = "recipe-candidate-select recipe-candidate-cook";
  cook.textContent = "この料理を作る";
  cook.setAttribute("data-testid", getTestId(options.surface, "recipe-candidate-cook"));
  cook.addEventListener("click", () => options.onCook(candidate.id));

  const back = document.createElement("button");
  back.type = "button";
  back.className = "button-secondary recipe-candidate-back";
  back.textContent = "候補に戻る";
  back.setAttribute("data-testid", getTestId(options.surface, "recipe-candidate-back"));
  back.addEventListener("click", options.onBack);

  section.append(heading, materialContextHeading, materialContext, ingredientsHeading, ingredients);
  if (candidate.miss.length > 0) {
    section.append(missingHeading, missing);
  }
  section.append(stepsHeading, steps, tasteHeading, taste, cook, back);
  return section;
}

export function renderRecipeCookingView(options: RecipeCookingViewOptions): HTMLElement {
  const section = document.createElement("section");
  section.className = "recipe-cooking-view";
  section.setAttribute("data-testid", getTestId(options.surface, "recipe-cooking-view"));
  section.setAttribute("aria-labelledby", getTestId(options.surface, "recipe-cooking-view-title"));
  section.tabIndex = -1;

  const heading = renderTextElement("h4", "調理ビュー", "recipe-candidate-detail-title");
  heading.id = getTestId(options.surface, "recipe-cooking-view-title");
  const title = renderTextElement("p", options.candidate.title, "recipe-candidate-why");
  const tabList = document.createElement("div");
  tabList.className = "recipe-cooking-tabs";
  tabList.setAttribute("role", "tablist");
  tabList.setAttribute("aria-label", "調理内容");

  const panelId = getTestId(options.surface, "recipe-cooking-panel");
  for (const tab of cookingTabs) {
    const selected = tab.id === options.activeTab;
    const button = document.createElement("button");
    button.type = "button";
    button.className = "recipe-cooking-tab";
    button.textContent = tab.label;
    button.id = getTestId(options.surface, `recipe-cooking-tab-${tab.id}`);
    button.setAttribute("role", "tab");
    button.setAttribute("aria-selected", String(selected));
    button.setAttribute("aria-controls", panelId);
    button.tabIndex = selected ? 0 : -1;
    button.setAttribute("data-testid", getTestId(options.surface, `recipe-cooking-tab-${tab.id}`));
    button.addEventListener("click", () => options.onTabChange(tab.id));
    tabList.appendChild(button);
  }

  const panel = document.createElement("section");
  panel.className = "recipe-cooking-panel";
  panel.id = panelId;
  panel.setAttribute("role", "tabpanel");
  panel.setAttribute(
    "aria-labelledby",
    getTestId(options.surface, `recipe-cooking-tab-${options.activeTab}`),
  );
  panel.setAttribute("data-testid", panelId);

  if (options.activeTab === "materials") {
    const materialsHeading = renderTextElement("h5", "使う材料", "recipe-candidate-subheading");
    const materials = renderInlineList(
      getUsedMaterialLabels(options.candidate, options.materialInputs),
      "recipe-candidate-detail-list",
    );
    const seasoningsHeading = renderTextElement(
      "h5",
      "調味料・その他",
      "recipe-candidate-subheading",
    );
    const seasonings = renderInlineList(
      getSeasoningLabels(options.candidate),
      "recipe-candidate-detail-list",
    );
    panel.append(materialsHeading, materials, seasoningsHeading, seasonings);
  }

  if (options.activeTab === "instructions") {
    const stepsHeading = renderTextElement("h5", "作り方", "recipe-candidate-subheading");
    const steps = document.createElement("ol");
    steps.className = "recipe-candidate-detail-list";
    for (const step of options.candidate.steps) {
      const item = document.createElement("li");
      item.textContent = step;
      steps.appendChild(item);
    }
    panel.append(stepsHeading, steps);
  }

  if (options.activeTab === "taste") {
    const tasteHeading = renderTextElement("h5", "味の調整", "recipe-candidate-subheading");
    const taste = renderInlineList(getTasteAdjustmentLabels(), "recipe-candidate-detail-list");
    panel.append(tasteHeading, taste);
  }

  const back = document.createElement("button");
  back.type = "button";
  back.className = "button-secondary recipe-candidate-back";
  back.textContent = "候補に戻る";
  back.setAttribute("data-testid", getTestId(options.surface, "recipe-cooking-back"));
  back.addEventListener("click", options.onBack);

  section.append(heading, title, tabList, panel, back);
  return section;
}

export function renderRecipeCandidateList(options: RecipeCandidateListOptions): HTMLElement {
  const section = document.createElement("section");
  section.className = "recipe-candidate-section";
  section.setAttribute(
    "aria-labelledby",
    getTestId(options.surface, "recipe-candidate-list-heading"),
  );

  const heading = renderTextElement("h3", "AIの料理候補", "recipe-candidate-list-heading");
  heading.id = getTestId(options.surface, "recipe-candidate-list-heading");

  const list = document.createElement("ul");
  list.className = "recipe-candidate-list";
  list.setAttribute("role", "list");
  list.setAttribute("data-testid", getTestId(options.surface, "recipe-candidate-list"));
  list.tabIndex = -1;
  for (const candidate of options.candidates) {
    list.appendChild(renderCandidate(candidate, options));
  }

  section.append(heading, list);

  const selected = options.candidates.find(
    (candidate) => candidate.id === options.selectedCandidateId,
  );
  if (selected) {
    section.appendChild(renderCandidateDetail(selected, options));
  }

  return section;
}
