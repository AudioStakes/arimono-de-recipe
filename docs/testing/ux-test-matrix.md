# UX Test Matrix

Structure tests are mechanical guardrails. They are not proof of runtime behavior; runtime behavior belongs in unit and E2E tests.

| Behavior | Unit | E2E | Structure |
|---|---|---|---|
| 未指定項目をプロンプトに出力しない | required | smoke optional | source-of-truth guard |
| 指定値からレシピ依頼文を生成する | required | required for key user flow | source-of-truth guard |
| こだわり項目を開閉して入力できる | optional | required | stable hook guard |
| コピー対象の出力欄が更新される | optional | required | stable hook guard |
| モバイル用 bottom sheet / mobile output | optional | required where practical | stable hook guard |
| AI候補カードから詳細表示する | parser/request required | required with `/api/recipe` mock and call count | stable hook guard |
| UI selector stability | no | yes | required |
| Approved `/api/recipe` transmission boundary | required | required with mock | required |

## Stable Hook Convention

- `data-testid="app-shell"`
- `data-testid="recipe-form"`
- `data-testid="basic-fields"`
- `data-testid="advanced-fields"`
- `data-testid="recipe-item-{itemId}"`
- `data-testid="recipe-item-toggle-{itemId}"`
- `data-testid="recipe-item-panel-{itemId}"`
- `data-testid="combo-{comboId}"`
- `data-testid="combo-input-{comboId}"`
- `data-testid="combo-suggestions-{comboId}"`
- `data-testid="serving-stepper-{servingId}"`
- `data-testid="cook-time-range"`
- `data-testid="supplemental-notes"`
- `data-testid="condition-chips"`
- `data-testid="sticky-condition-chips"`
- `data-testid="prompt-output"`
- `data-testid="mobile-prompt-output"`
- `data-testid="copy-prompt"`
- `data-testid="copy-prompt-sticky"`
- `data-testid="copy-prompt-mobile-panel"`
- `data-testid="generate-recipe"`
- `data-testid="generate-recipe-mobile"`
- `data-testid="ai-recipe-panel"`
- `data-testid="ai-recipe-status"`
- `data-testid="ai-recipe-content"`
- `data-testid="ai-recipe-error"`
- `data-testid="ai-recipe-model"`
- `data-testid="recipe-candidate-list"`
- `data-testid="recipe-candidate-{candidateId}"`
- `data-testid="recipe-candidate-select-{candidateId}"`
- `data-testid="recipe-candidate-detail"`
- `data-testid="recipe-candidate-back"`
- `data-testid="mobile-ai-recipe-panel"`
- `data-testid="mobile-ai-recipe-status"`
- `data-testid="mobile-ai-recipe-content"`
- `data-testid="mobile-ai-recipe-error"`
- `data-testid="mobile-ai-recipe-model"`
- `data-testid="mobile-recipe-candidate-list"`
- `data-testid="mobile-recipe-candidate-{candidateId}"`
- `data-testid="mobile-recipe-candidate-select-{candidateId}"`
- `data-testid="mobile-recipe-candidate-detail"`
- `data-testid="mobile-recipe-candidate-back"`
- `data-testid="mobile-prompt-panel"`
- `data-state="open|closed"` for collapsible panels and the mobile prompt panel.
- `data-state="selected|idle"` for AI候補カード.

E2E tests should prefer these hooks for behavior-critical selectors. CSS class names can still be asserted when the class is itself the behavior state, but they should not be the only way to locate key controls.
