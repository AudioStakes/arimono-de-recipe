# UX Test Matrix

Structure tests are mechanical guardrails. They are not proof of runtime behavior; runtime behavior belongs in unit and E2E tests.

| Behavior | Unit | E2E | Structure |
|---|---|---|---|
| 未指定項目をプロンプトに出力しない | required | smoke optional | source-of-truth guard |
| 指定値からレシピ依頼文を生成する | required | required for key user flow | source-of-truth guard |
| こだわり項目を開閉して入力できる | optional | required | stable hook guard |
| コピー対象の出力欄が更新される | optional | required | stable hook guard |
| モバイル用 bottom sheet / mobile output | optional | required where practical | stable hook guard |
| UI selector stability | no | yes | required |
| Static-only/no external transmission | optional | optional | required |

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
- `data-testid="mobile-prompt-panel"`
- `data-state="open|closed"` for collapsible panels and the mobile prompt panel.

E2E tests should prefer these hooks for behavior-critical selectors. CSS class names can still be asserted when the class is itself the behavior state, but they should not be the only way to locate key controls.
