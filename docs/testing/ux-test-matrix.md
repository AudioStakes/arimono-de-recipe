# UX Test Matrix

## Browser Coverage

ChromiumとPixel 7相当では全E2Eを実行する。Firefox、WebKit、iPhone 13相当、iPad Pro 11相当では`form-layout`、`ai-model-selection`、`app`、`input`、`assets`、`direct-ai-flow`、`browser-interaction-regressions`を実行する。入力、材料名・分量の保持、キーボード、コピーと失敗時の回復、依頼文全文送信とMarkdown回答をカバーする。全文送信・Markdown表示とモデル選択も6構成で実行する。実行対象の基準は`playwright.config.ts`とする。

端末名はPlaywrightのエミュレーション設定で、実機OS・ソフトウェアキーボード・Safariアプリの動作保証ではない。モバイルWebKitの背景スクロールはCSSロックと開閉・Escape・resizeの解除を検証し、実際のwheel抑止はdesktopの3エンジンとmobile Chromiumで確認する。

Structure tests are mechanical guardrails. They are not proof of runtime behavior; runtime behavior belongs in unit and E2E tests.

| Behavior | Unit | E2E | Structure |
| --- | --- | --- | --- |
| 未指定項目をプロンプトに出力しない | required | smoke optional | source-of-truth guard |
| 指定値からレシピ依頼文を生成する | required | required for key user flow | source-of-truth guard |
| こだわり項目を開閉して入力できる | optional | required | stable hook guard |
| 材料の使い方を指定できる | required for validation | required | stable hook guard |
| 材料名と量が揃い、未入力時の量例が見切れず、カードがコンパクト | no | required all 6 profiles, 320/390/1280px, 16/20/32px text, scrollbar gutter/card width273px, placeholder width, normal card height <=180px, top-right delete target, rename | associated labels and error help |
| 文字拡大時に人数・モデル・主操作が欠けず、最終footerを固定操作が隠さない | no | required all 6 profiles, 320/360/1280px and 200% text | no |
| 作りたい料理と単一役割の確定後に指定値の編集へfocusを渡す | no | required all 6 profiles, Enter then edit | no |
| 作者リンクとプライバシーを狭い画面でも操作でき、モーダル内のTab循環・背景操作禁止・閉じた後のfocusと位置を保持する | no | required all 6 profiles, 320/390/1280px footer clearance | stable hooks |
| Cloudflare解析は本番originだけで一度読み込み、遮断時も入力とプライバシーを操作できる | no | required all 6 profiles, production CSP, local/Preview exclusion, stubbed beacon | existing application fetch restrictions retained |
| 材料は未入力時に日常向け20件を表示し、検索時は一致する初期候補を優先して全候補から絞り込む | required priority, full catalog and no mutation | required initial order, selection exclusion and keyboard on all 6 profiles | no |
| コピー対象の出力欄が更新される | optional | required | stable hook guard |
| 条件サマリーの削除後、表示中の入力または最も近い開閉ボタンへfocusを戻す | no | required all 6 profiles, materials/time/closed NG/closed parent | no |
| モバイル用 bottom sheet / mobile output | optional | required where practical | stable hook guard |
| 表示・コピーと同じ依頼文全文を明示操作だけで送信する | required for client contract | required desktop/mobile, pending input and native copy | no |
| 全文送信の文字数・JSON全体UTF-8上限を超えてもコピー本文を保持する | required boundary cases | required with no API calls | no |
| 全文回答の型・空応答・timeout・入力変更によるabortと古い応答を検査する | required client lifecycle | required retry and stale-response flows | no |
| Markdown回答を依頼文とは別に表示し、回答到着時にfocusを奪わない | parser required | required desktop/mobile, headings/lists/emphasis/table, accessible name and status | stable hook guard |
| raw HTML・危険URL・Markdown/HTML画像を無効化する | parser required | required, dangerous DOM and third-party requests are zero | no |
| AI回答の文字数上限をserver/clientで一致させ、超過時にコピーを残す | required boundary cases | mocked oversized response | no |
| AI送信を主操作、依頼文コピーを副操作として両方使える | no | required desktop/mobile, preview remains optional | stable hook guard |
| 材料なし・分量不足の原因を入力付近で示し、入力とエラーを固定footerの上へ表示する | no | required narrow and landscape viewports, API calls zero | no |
| Clipboard API未対応時の代替コピーでfocusを保持する | no | required with native copy | no |
| モバイル展開パネルのTab循環・背景操作禁止・Escape/resizeでの解除 | no | required | no |
| AI通信のtimeoutとtimer解放 | required | mocked errors covered | no |
| empty/loading/error/retry/fallback states | validation required | required | stable hook guard |
| UI selector stability | no | yes | required |
| Approved `/api/recipe` transmission boundary | required | required with mock | required |
| モデル変更だけでは送信せず、選択モデルと送信先を明示し、無効な提供元へ自動切替しない | required lifecycle and catalog | required all 6 profiles | fixed provider/endpoint guard |
| 接続元・全体・提供元の制限をD1で原子的に予約し、全AI停止設定がGroqにも効く | required real SQLite, missing/false master flag, upstream calls zero | model disabled and copy retained | aggregate-only persistence boundary |

## Stable Hook Convention

The Node-only `recipe-application.test.ts` covers public operations, material IDs,
hidden input retention, detached snapshots, subscriptions, input errors, retry,
copyable text and request generations. Existing client tests own timeout and size
validation. New UI entry points are `recipe-item-toggle-servings` and
`recipe-item-toggle-requestOptions`; nested options are opened through the latter.
Material cards display latest first while prompt order remains insertion order.
The fixed send/copy bar is available at desktop widths as well as mobile widths.

- `data-testid="app-shell"`
- `data-testid="site-footer"`
- `data-testid="creator-link"`
- `data-testid="privacy-open"`
- `data-testid="privacy-dialog"`
- `data-testid="privacy-close"`
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
- `data-testid="materials-error"`
- `data-testid="mobile-action-footer"`
- `data-testid="prompt-preview-toggle"`
- `data-testid="mobile-prompt-preview-toggle"`
- `data-testid="mobile-ai-transmission-notice"`
- `data-testid="prompt-output"`
- `data-testid="mobile-prompt-output"`
- `data-testid="copy-prompt"`
- `data-testid="copy-prompt-sticky"`
- `data-testid="copy-prompt-mobile-panel"`
- `data-testid="material-card-{materialRequestId}"`
- `data-testid="material-usage-control-{materialRequestId}"`
- `data-testid="material-usage-option-{materialRequestId}-{usage}"`
- `data-testid="material-amount-{materialRequestId}"`
- `data-testid="material-use-up-error-{materialRequestId}"`
- `data-testid="mobile-prompt-panel"`
- `data-state="open|closed"` for collapsible panels and the mobile prompt panel.
- `data-testid="ai-prompt-send"`
- `data-testid="ai-model-select"`
- `data-testid="ai-model-info"`
- `data-testid="ai-model-status"`
- `data-testid="mobile-ai-prompt-send"`
- `data-testid="ai-prompt-panel"`
- `data-testid="ai-prompt-heading"`
- `data-testid="ai-prompt-status"`
- `data-testid="ai-prompt-reply"`
- `data-state="idle|loading|success|error"` for the shared AI answer.

E2E tests should prefer these hooks for behavior-critical selectors. CSS class names can still be asserted when the class is itself the behavior state, but they should not be the only way to locate key controls.
