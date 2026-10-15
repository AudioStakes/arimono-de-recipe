# UX Test Matrix

## Browser Coverage

ChromiumとPixel 7相当では全E2Eを実行する。Firefox、WebKit、iPhone 13相当、iPad Pro 11相当では`app`、`input`、`assets`、`browser-compatibility`、`browser-interaction-regressions`を実行する。入力、材料名・分量の保持、キーボード、コピーと失敗時の回復、AIの2経路、候補選択と調理タブをカバーする。

端末名はPlaywrightのエミュレーション設定で、実機OS・ソフトウェアキーボード・Safariアプリの動作保証ではない。モバイルWebKitの背景スクロールはCSSロックと開閉・Escape・resizeの解除を検証し、実際のwheel抑止はdesktopの3エンジンとmobile Chromiumで確認する。

Structure tests are mechanical guardrails. They are not proof of runtime behavior; runtime behavior belongs in unit and E2E tests.

| Behavior | Unit | E2E | Structure |
| --- | --- | --- | --- |
| 未指定項目をプロンプトに出力しない | required | smoke optional | source-of-truth guard |
| 指定値からレシピ依頼文を生成する | required | required for key user flow | source-of-truth guard |
| こだわり項目を開閉して入力できる | optional | required | stable hook guard |
| 材料の使い方を指定できる | required for validation | required | stable hook guard |
| コピー対象の出力欄が更新される | optional | required | stable hook guard |
| モバイル用 bottom sheet / mobile output | optional | required where practical | stable hook guard |
| AI候補カードから詳細表示する | parser/request required | required with `/api/recipe` mock and call count | stable hook guard |
| 買い足しなしをdefaultにする | schema/function required | required with `/api/recipe` mock | stable hook guard |
| 調理ビューのtabsを切り替える | optional | required | stable hook guard |
| AI入力上限の超過で条件を黙って落とさず、コピーを残す | required | required with no API calls | no |
| 表示・コピーと同じ依頼文全文を明示操作だけで送信する | required for client contract | required desktop/mobile, pending input and native copy | no |
| 全文送信の文字数・JSON全体UTF-8上限を超えてもコピー本文を保持する | required boundary cases | required with no API calls | no |
| 全文回答の型・空応答・timeout・入力変更によるabortと古い応答を検査する | required client lifecycle | required retry and stale-response flows | no |
| 全文回答を文字列として表示し、確認画面を閉じた後もfocusを奪わない | no | required desktop/mobile, accessible name and status | no |
| AI候補ではNG食材を料理名・理由・手順・味の調整でも勧めない（既知の調味料表記を含む） | required | required for taste display | no |
| 調理ビューに受理した材料の分量と入力の使い方指定を保持する | parser required | required on desktop/mobile | no |
| Clipboard API未対応時の代替コピーでfocusを保持する | no | required with native copy | no |
| モバイル展開パネルのTab循環・背景操作禁止・Escape/resizeでの解除 | no | required | no |
| 調理tabsのArrow/Home/End操作とpanelへのfocus | optional | required on desktop/mobile | no |
| AI通信のtimeoutとtimer解放 | required | mocked errors covered | no |
| empty/loading/error/retry/fallback states | validation required | required | stable hook guard |
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
- `data-testid="material-card-{materialRequestId}"`
- `data-testid="material-usage-control-{materialRequestId}"`
- `data-testid="material-usage-option-{materialRequestId}-{usage}"`
- `data-testid="material-amount-{materialRequestId}"`
- `data-testid="material-use-up-error-{materialRequestId}"`
- `data-testid="ai-recipe-panel"`
- `data-testid="ai-recipe-status"`
- `data-testid="ai-recipe-content"`
- `data-testid="ai-recipe-error"`
- `data-testid="ai-recipe-retry"`
- `data-testid="ai-recipe-adjust-input"`
- `data-testid="recipe-candidate-list"`
- `data-testid="recipe-candidate-{candidateId}"`
- `data-testid="recipe-candidate-select-{candidateId}"`
- `data-testid="recipe-candidate-detail"`
- `data-testid="recipe-candidate-cook"`
- `data-testid="recipe-candidate-back"`
- `data-testid="recipe-cooking-view"`
- `data-testid="recipe-cooking-tab-{tabId}"`
- `data-testid="recipe-cooking-panel"`
- `data-testid="recipe-cooking-back"`
- `data-testid="mobile-ai-recipe-panel"`
- `data-testid="mobile-ai-recipe-status"`
- `data-testid="mobile-ai-recipe-content"`
- `data-testid="mobile-ai-recipe-error"`
- `data-testid="mobile-ai-recipe-retry"`
- `data-testid="mobile-ai-recipe-adjust-input"`
- `data-testid="mobile-recipe-candidate-list"`
- `data-testid="mobile-recipe-candidate-{candidateId}"`
- `data-testid="mobile-recipe-candidate-select-{candidateId}"`
- `data-testid="mobile-recipe-candidate-detail"`
- `data-testid="mobile-recipe-candidate-cook"`
- `data-testid="mobile-recipe-candidate-back"`
- `data-testid="mobile-recipe-cooking-view"`
- `data-testid="mobile-recipe-cooking-tab-{tabId}"`
- `data-testid="mobile-recipe-cooking-panel"`
- `data-testid="mobile-recipe-cooking-back"`
- `data-testid="mobile-prompt-panel"`
- `data-state="open|closed"` for collapsible panels and the mobile prompt panel.
- `data-state="selected|idle"` for AI候補カード.

E2E tests should prefer these hooks for behavior-critical selectors. CSS class names can still be asserted when the class is itself the behavior state, but they should not be the only way to locate key controls.
