# Cloudflare運用点検 2026-10-28

調査日: 2026-10-28 JST。
対象は `https://arimono-de-recipe.pages.dev/` と、このリポジトリのCloudflare Pages構成である。
Cloudflare公式ドキュメント、公開URLへの読み取り専用GET、ソースコード、Dashboardの読み取り専用表示を照合した。
本番へのデプロイ、AI推論を伴うPOST、Dashboardの設定変更、契約変更は行っていない。

作業checkoutは `codex/public-release-audit-20261018` の `122e742`、調査時点の `origin/main` は `1d37999` だった。
本番設定の判断では最新mainも確認した。
mainにはProduction用のD1、AI、Freeフラグの設定が既にあり、古いcheckoutとの差を新しい本番の不足として数えない。
配信は既存方針どおり、レビュー済みの最新mainから行う。

PR準備では `origin/main@9307d38` を基点とする `codex/cloudflare-404-readiness` のworktreeへ変更を引き継いだ。
この基点は[PR #60](https://github.com/AudioStakes/arimono-de-recipe/pull/60)のWrangler 4.153.0とworkerd 1.20261023.1への更新を取り込み済みである。
後段の4.149.0と一時的な4.151.3の記録は初回調査時の履歴であり、現在の依存更新待ちを意味しない。
`/tmp/` などのローカル保存先も当時の実行履歴として残しており、PRには含めず、GitHub上で参照できる証拠とは扱わない。

確認できた配信上の不足は、存在しないパスにもトップページを200で返すことと、通常のViteプレビューではPages固有のHTTP応答を検証できないことだった。
このターンではルートの404ページと配信確認手順を追加した。
APIにはD1の永続的な利用制限と設定不足時の停止が既にある。
Cloudflare WorkersのFree契約、ProductionのD1とAI binding、暗号化されたsecretの存在は当日のDashboardで確認した。
RuntimeのFail open設定とPreviewの既定公開も確認した。
PreviewはAI bindingだけを持ち、D1、secret、Freeフラグを持たない設定だった。
旧deploymentごとの保護やD1 migrationなど、確認できていない事項は「未設定」ではなく「本番確認が必要」とした。

判断の前提は[ADR 0011](adr/0011-add-optional-cloudflare-workers-ai-generation.md)、[ADR 0015](adr/0015-add-cloudflare-web-analytics-and-privacy-dialog.md)、[ADR 0016](adr/0016-add-free-model-selection-and-durable-usage-limits.md)である。
レシピ依頼文の作成とコピーを維持し、承認済みの `/api/recipe` 以外にFunction、AI送信先、保存先を追加しない。

## 公開URLで確認した事実

404追加前の本番へGETした結果は次のとおりだった。
HTTPステータスだけでなく、本文を保存して比較した。

| URLのパス | 応答 | 確認できること |
| --- | --- | --- |
| `/` | 200、HTML、1,907 bytes | トップページを配信している。 |
| `/wp-login.php` | 200、HTML、1,907 bytes | 本文は `/` と同一。WordPressのログイン画面ではない。 |
| `/.git/config` | 200、HTML、1,907 bytes | 本文は `/` と同一。このGETではGit設定の漏えいは確認されなかった。 |
| `/api/does-not-exist` | 200、HTML、1,907 bytes | 本文は `/` と同一。存在しないAPIパスも静的なフォールバックへ到達している。 |
| `/api/recipe?models` | 200、JSON | レシピ入力や推論を伴わない公開モデル設定を取得できる。`Cache-Control: no-store` と `X-Content-Type-Options: nosniff` を確認した。 |

トップページのCSP、`Referrer-Policy: no-referrer`、`X-Frame-Options: DENY`、`X-Content-Type-Options: nosniff` は[public/_headers:1](../public/_headers#L1)の定義と一致した。
モデル設定APIには `Access-Control-Allow-Origin` がなく、HEADは405を返した。
HEAD非対応だけをAPI障害と判定せず、モデル設定確認にはGETを使う。

Pagesはトップレベルに `404.html` がない場合、SPAとして未知のパスをルートへ返す。
今回の本文比較はこの挙動と一致する。[Serving Pages][cf-serving]
ログに `/.git/config` や `/wp-login.php` があっても、その名前のファイルが存在することや漏えいしたことは、この記録からは導けない。
このGET結果は、他の全ファイルや過去のdeploymentの非公開性まで保証するものではない。

同日のDashboardのWorkers plans画面では、Free欄に `$0` と `Current plan`、Paid欄に `Upgrade` が表示されていた。
この観察により、Cloudflare Workersの現在のFreeプランは確認済みとする。
Groqの契約や他アプリとの利用枠共有状況まで確認したことにはならない。
アカウント識別子、請求情報、secretの値はこの文書に保存しない。

PagesのProduction設定では、D1の `AI_USAGE` とWorkers AIの `AI` binding、`AI_USAGE_SECRET` のSecret型と暗号化表示、`CLOUDFLARE_FREE_ONLY=true`、`compatibility_date=2026-10-15` を確認した。
secretの値は開いていない。
Runtimeは **Fail open**、Preview accessは既定の公開状態を示し、`Restrict previews` ボタンが表示されていた。
Preview環境の変数とsecret一覧は空で、bindingはWorkers AIの `AI` だけだった。
D1、HMAC secret、共通Freeフラグがないため、現行コードのAIを停止する設計と整合する。
Preview deploymentは一覧で確認しておらず、Preview runtimeへGETして検証したという意味ではない。

確認したdeployment一覧の7件はいずれもProductionで、過去のhash付きURLも表示されていた。
各URLへ推論を伴わない `GET /api/recipe?models` を行い、次を確認した。

| deployment hash | GETの結果 | 判断できる範囲 |
| --- | --- | --- |
| `63ab1891`、`336f2efd` | 200、JSON、4モデル中Cloudflareの3モデルが有効 | 公開モデル設定を取得できる。実推論、D1 migration、請求の検証ではない。 |
| `6a0547e2`、`fbf7dad0`、`f3ce1dc2`、`0ac0e675`、`35dc53c4` | 405、JSON | モデル設定GETに対応しないAPI handlerへ到達する。推論の可否と旧版の利用制限は未検証。 |

旧URLやhandlerの到達可能性だけでは、無制限のAI推論や濫用を確定できない。
旧URLの棚卸しはP1とし、安全を確認できない旧版を無効化するかは所有者が判断する。
今回POSTやdeployment削除は行っていない。

## 優先度と状態

- **P1**: AI利用枠、公開入口、秘密情報など、本番の有効化や継続運用の前提になる事項。
- **P2**: HTTPの正確さ、配信手順、障害時の回復など、次回リリースで確認する事項。
- **P3**: 現状の不足が確定していない追加防御、将来の構成変更、任意の改善。

状態は次の5種類に固定する。
「実装済み」はリポジトリの実装があることを示し、Dashboardや本番の設定完了を含意しない。

| 表記 | 意味 |
| --- | --- |
| 実装済み (`implemented`) | 現行コードまたは既存手順で対応している。 |
| 今回変更 (`repo change this turn`) | このターンでコード、検証、手順を変更した。本番配信とは別である。 |
| 本番確認が必要 (`production verification needed`) | 公開GETだけでは判断できず、運営者の読み取り専用確認や配信後の照合が必要。 |
| 人の判断が必要 (`human decision needed`) | 契約、保護方式、追加製品、プライバシーなどの選択を伴う。 |
| 対象外 (`not applicable`) | 現行のPages構成では適用しない、または追加する根拠がない。 |

## 配信とブラウザの点検表

| ID | 優先度 | 状態 | 現状と次の行動 | リポジトリと一次資料 |
| --- | --- | --- | --- | --- |
| CF01 | P2 | 今回変更 | ルートに404ページを追加した。ソースはViteのHTML entryとして共通CSSを使う。公開済みの本文比較は変更前の記録なので、次回配信後に未知のパスが404となることを同じGETで確認する。 | [404.html](../404.html)、[Serving Pages][cf-serving] |
| CF02 | P2 | 今回変更 | 404ファイルとビルド出力の検証、Pagesランタイムでのステータス確認手順を追加した。ViteプレビューだけをCloudflareの配信仕様の検証に使わない。 | [構造テスト](../tests/structure/guardrails.test.ts)、[公開手順](deployment.md)、[Local development][cf-local] |
| CF03 | P2 | 本番確認が必要 | リリース後に `/` が200、未知のパスと存在しないAPIが404、モデル設定がJSONであることを確認する。404でもCSPとセキュリティヘッダーを確認する。 | [公開手順](deployment.md)、[Headers][cf-headers] |
| CF04 | P2 | 実装済み | Functionの起動対象は正確な `/api/recipe` に限定されている。スキャナ用の汎用Functionや `/*` のFunctionルートを追加しない。 | [public/_routes.json:3](../public/_routes.json#L3)、[Function routing][cf-routing] |
| CF05 | P2 | 実装済み | 配信対象は `dist/`。Wranglerでルートの `functions/` もビルドする既存のDirect Upload手順を使う。Dashboardのドラッグアンドドロップは `functions/` のコンパイルに対応しない。 | [wrangler.jsonc:4](../wrangler.jsonc#L4)、[公開手順](deployment.md)、[Direct Upload][cf-upload] |
| CF06 | P2 | 本番確認が必要 | Pagesの既定キャッシュを維持し、配信後にHTMLとAPIのcache応答を確認する。独自ドメインでCache Rulesを使う場合は、広い上書きが新deployment、リダイレクト、Functionsを妨げないか確認する。利用者のzone設定が現 `pages.dev` にも適用されるとは扱わない。 | [public/_headers](../public/_headers)、[Serving Pagesのキャッシュ説明][cf-serving] |
| CF07 | P3 | 実装済み | Viteのビルド済みJSとCSSには内容ハッシュが付き、トップページには本番originのcanonicalがある。HTMLへ長期の `immutable` を一律指定する変更は不要。 | [index.html:9](../index.html#L9)、[Vite build options][vite-build]、[Serving Pages][cf-serving] |
| CF08 | P2 | 実装済み | 静的応答にCSP、`no-referrer`、`DENY`、`nosniff` がある。CSPは `unsafe-inline` と `unsafe-eval` を使わず、object、base、frame祖先を制限する。本番ルートでも一致を確認した。 | [public/_headers:1](../public/_headers#L1)、[Headers][cf-headers] |
| CF09 | P2 | 実装済み | APIは自身で `no-store` と `nosniff` を返し、許可するCORSヘッダーを付けていない。Pagesの `_headers` はFunction応答に適用されないため、静的ヘッダーからAPIへの継承を想定しない。 | [functions/api/recipe.ts](../functions/api/recipe.ts)、[Headers][cf-headers] |
| CF10 | P3 | 人の判断が必要 | `Permissions-Policy` は未指定。カメラ、マイク、位置情報などを明示的に無効化する追加防御は選べるが、欠落だけを脆弱性としない。採用する場合はコピーに必要な機能を妨げないことを確認する。 | [public/_headers](../public/_headers)、[Permissions-Policy][mdn-permissions] |
| CF11 | P3 | 対象外 | 現公開先はHTTPSを強制する `.dev` TLDにある。HSTSヘッダーの欠落だけを緊急修正としない。独自ドメイン導入時は、そのドメインのHTTPS、HSTS、リダイレクトを再評価する。 | [公開先](deployment.md#公開先と設定)、[Googleによる.devの説明][google-dev] |
| CF12 | P2 | 実装済み | 秘密値をクライアントへ入れないガードと `.env` 系の除外がある。現ビルドに公開用 `.map` はなく、Viteのsourcemap既定値もfalse。Functionのデバッグ用source mapアップロードは別機能として判断する。 | [.gitignore:6](../.gitignore#L6)、[guardrails.test.ts:129](../tests/structure/guardrails.test.ts#L129)、[Vite sourcemap][vite-sourcemap]、[Function source maps][cf-sourcemaps] |
| CF13 | P2 | 実装済み | Web Analyticsは正確な本番originだけで標準beaconを遅延挿入し、重複読込を避ける。入力内容や独自イベントを解析へ送らないADR 0015の範囲を維持する。 | [src/web-analytics.ts:6](../src/web-analytics.ts#L6)、[ADR 0015](adr/0015-add-cloudflare-web-analytics-and-privacy-dialog.md)、[Web Analytics CSP][cf-analytics-faq] |
| CF14 | P2 | 本番確認が必要 | Pagesの自動Analytics挿入が無効であること、beaconが一度だけ読み込まれること、Dashboardへ反映されることを確認する。リポジトリの手動実装からDashboard設定は確定できない。 | [公開手順](deployment.md#cloudflare-web-analytics)、[Pages Web Analytics][cf-pages-analytics] |
| CF15 | P3 | 本番確認が必要 | 公開応答にはCloudflare管理の `Report-To` と `NEL` がある。アプリ独自の解析追加とは分けて扱い、データ処理を点検する場合はCloudflare側のNetwork Error Logging設定を確認する。 | [public/_headers](../public/_headers)、[Network Error Logging][cf-nel] |

## AI APIと運用の点検表

| ID | 優先度 | 状態 | 現状と次の行動 | リポジトリと一次資料 |
| --- | --- | --- | --- | --- |
| CF16 | P1 | 実装済み | D1、HMAC secret、Free確認、信頼できるedge IPが欠けた場合は推論を止める。構成不足を、ブラウザから利用制限を外す理由にしない。 | [ADR 0016](adr/0016-add-free-model-selection-and-durable-usage-limits.md)、[server/ai-usage.ts](../server/ai-usage.ts)、[Pages bindings][cf-bindings] |
| CF17 | P1 | 実装済み | 接続元ごとに毎分3回、UTC日10回、全体でUTC日100回をD1で予約し、提供元の予算も併用する。IPは日次HMAC、IPv6は/64として扱い、入力と回答は保存しない。 | [AI設定:48](architecture/ai-provider-setup.md#上限と保存範囲)、[server/ai-usage.ts](../server/ai-usage.ts)、[D1 batch][cf-d1-batch] |
| CF18 | P2 | 実装済み | 依頼文12,000文字、本文32,000 bytes、回答20,000文字と出力トークンに上限がある。本文はストリームでも上限を守る。Groq応答は128,000 bytes、25秒で制限し、リダイレクトと自動再送を認めない。不確実な推論の予約は返却しない。 | [functions/api/recipe.ts:143](../functions/api/recipe.ts#L143)、[server/ai-provider.ts:138](../server/ai-provider.ts#L138)、[AI設定](architecture/ai-provider-setup.md#上限と保存範囲)、[Workers limits][cf-workers-limits] |
| CF19 | P2 | 実装済み | ブラウザのAI通信は同一originの `/api/recipe` に限定し、上流は承認済みの固定提供元だけを使う。Origin検証はブラウザからの意図しない送信を抑えるが、直接HTTPクライアントの認証にはならない。 | [ADR 0016](adr/0016-add-free-model-selection-and-durable-usage-limits.md)、[functions/api/recipe.ts](../functions/api/recipe.ts)、[server/ai-provider.ts](../server/ai-provider.ts) |
| CF20 | P1 | 本番確認が必要 | Cloudflare Workers Freeは2026-10-28 JSTのDashboardで確認済み。残る確認はGroq利用時のFree契約、支払い、自動補充、他アプリとの共有枠である。`FREE_ONLY` は運営者の宣言であり契約を照会するコードではない。今後のプラン変更時も再確認する。 | [ADR 0016の課金境界](adr/0016-add-free-model-selection-and-durable-usage-limits.md#billing-boundary)、[AI設定:7](architecture/ai-provider-setup.md#有効化前の確認)、[Workers AI pricing][cf-ai-pricing]、[Groq rate limits][groq-limits] |
| CF21 | P1 | 本番確認が必要 | ProductionのD1、AI、暗号化secret、共通Freeフラグは確認済み。Previewは変数とsecretが空で、AI bindingだけを持ち、現行コードではAI停止に整合する。残る確認はProductionのD1 migrationの適用内容である。モデル設定GETだけでその正しさを判断しない。 | [AI設定:14](architecture/ai-provider-setup.md#d1とsecrets)、[Pages bindings][cf-bindings] |
| CF22 | P1 | 本番確認が必要 | Previewは既定公開だが、Preview deploymentは今回一覧にない。7件のProduction hashへ安全なGETを行い、2件はモデル設定JSON、5件は405のAPI handlerを確認した。旧版の推論と利用制限は未検証なので、保護を棚卸しし、安全を確認できない旧URLの無効化を所有者が判断する。 | [全AI停止手順](deployment.md#全aiの緊急停止)、[Preview deployments][cf-previews]、[古いdeploymentの削除][cf-old-deployments] |
| CF23 | P2 | 人の判断が必要 | WAFやRate limitingによる追加制限は、契約と管理下の独自ドメインを確認して設計する。利用者が持つzoneのルールを `pages.dev` に適用できるとは扱わない。PagesはWorkersのRate Limiting bindingに非対応で、binding自体も地域単位の近似制限なので厳密なD1予算の代替にしない。全入口の迂回を評価する。 | [公開APIの対策](deployment.md#公開apiの濫用費用対策)、[Pages互換表][cf-migration-matrix]、[WAF][cf-waf]、[Rate limiting][cf-rate-plans]、[bindingの精度][cf-rate-accuracy] |
| CF24 | P3 | 人の判断が必要 | Turnstileなどの追加対策は、実際の濫用、利用者の負担、外部送信の変更を踏まえて選ぶ。スキャナのパスが記録された事実だけでは導入の必要性を確定しない。導入時はサーバーでtokenを検証する。 | [AGENTS.mdの人間判断](../AGENTS.md#human-only-decisions)、[Turnstile server-side validation][cf-turnstile] |
| CF25 | P2 | 本番確認が必要 | Workers Freeと共有するFunctionsの日次100,000リクエスト枠、D1の読書き枠、AI枠、エラー、CPU時間を確認する。拒否したAPIリクエストもFunctionやD1の利用を生む場合がある。通知先、確認頻度、停止担当者は運用で定め、通知を利用停止の代わりにしない。 | [公開手順](deployment.md#公開apiの濫用費用対策)、[Functions pricing][cf-functions-pricing]、[Functions metrics][cf-metrics]、[D1 pricing][cf-d1-pricing]、[Workers AI pricing][cf-ai-pricing] |
| CF26 | P2 | 実装済み | エラーを利用者向けに整形し、依頼文をアプリログへ出さない。障害調査でtailを使う場合も、入力、回答、secret、元のIPを新たに記録しない。 | [ADR 0011](adr/0011-add-optional-cloudflare-workers-ai-generation.md)、[functions/api/recipe.ts](../functions/api/recipe.ts)、[Debugging and logging][cf-logging] |
| CF27 | P2 | 今回変更 | Pagesのrollbackと配信後確認の手順を補った。旧利用制限実装へ戻さず、AI停止中は戻し先hashのモデル設定が全て無効であることも先に確認する。停止を維持できる対象がなければ、既知の正常コードを停止設定で再配信する。D1の状態やschemaが同時に戻るとは扱わない。 | [公開手順](deployment.md#問題発生時のロールバック)、[Rollbacks][cf-rollbacks] |
| CF28 | P3 | 実装済み | `compatibility_date` は2026-10-15に固定され、npm依存もlockfileで管理する。日付を自動で今日へ追従させず、更新時にAPIの回帰確認を行う。 | [wrangler.jsonc:5](../wrangler.jsonc#L5)、[package-lock.json](../package-lock.json)、[Compatibility dates][cf-compatibility] |
| CF29 | P3 | 対象外 | 現在はローカルまたは既存CIで検証した成果物をWranglerでDirect Uploadする。Git連携のbuild cache、watch paths、build imageや自動デプロイがないことは、その方式の不足ではない。自動化への変更は必要性が生じた際に判断する。 | [公開手順](deployment.md#公開先と設定)、[CI](../.github/workflows/ci.yml)、[Direct Upload][cf-upload] |
| CF30 | P3 | 対象外 | 現在の小規模なビルド出力に、Pagesのファイル数や25 MiBの単一ファイル上限へ達した証拠はない。容量対策としてR2を追加する必要はない。Git連携の月間build枠を、現在のDirect Uploadの制約と混同しない。 | [wrangler.jsonc:4](../wrangler.jsonc#L4)、[Pages limits][cf-limits]、[Direct Upload][cf-upload] |
| CF31 | P3 | 対象外 | 新規プロジェクトにはWorkersを推奨する公式方針があるが、既存Pagesアプリの欠陥を意味しない。今回は移行しない。Workers Static Assets専用の `assets.not_found_handling`、`run_worker_first`、`html_handling` はPagesの設定へ持ち込まない。 | [AGENTS.md](../AGENTS.md#forbidden-changes)、[Pages overview][cf-pages]、[Workers Static Assets routing][cf-workers-assets] |
| CF32 | P1 | 本番確認が必要 | Cloudflareアカウントの2FAと回復方法を所有者が確認する。今回アカウントの認証設定は確認していないため、未導入とは記録しない。 | [Cloudflare 2FA][cf-2fa] |
| CF33 | P2 | 本番確認が必要 | 継続配信に使う資格情報の権限と保存場所を確認する。D1作成やsecret登録に使う初回OAuthの権限と、継続配信のPages権限は分けて評価する。CIへ配信を追加する場合は対象アカウントに絞ったtokenをsecretとして扱う。 | [公開手順](deployment.md#公開先と設定)、[Direct Upload CI][cf-upload-ci]、[Create API token][cf-token] |
| CF34 | P2 | 実装済み | `origin/main@1d37999` の `wrangler.jsonc` には `env.production` のAI、D1、migrationディレクトリ、共通Freeフラグがあり、Dashboardでも対応する設定を確認した。古いcheckoutにD1定義がない差は修正済みであり、新しい本番の設定不足ではない。secretは暗号化設定を維持し、配信は最新mainを基準にする。 | [mainの設定](https://github.com/AudioStakes/arimono-de-recipe/blob/1d37999/wrangler.jsonc)、[公開手順](deployment.md#公開先と設定)、[Pages Wrangler configuration][cf-wrangler-config]、[Pages bindings][cf-bindings] |
| CF35 | P2 | 人の判断が必要 | 現Production RuntimeはFail openだった。Freeの日次Functions枠を使い切った場合に静的配信へ回す設定なので、APIが静的HTMLとして応答することを避けるためFail closedを推奨する。変更前にFunction対象外の静的画面とコピーが継続することを確認する。設定変更は所有者が判断する。Fail open自体はAI制限の迂回や推論実行を意味しない。 | [public/_routes.json:3](../public/_routes.json#L3)、[Function fail open/closed][cf-fail-mode] |
| CF36 | P3 | 対象外 | D1の期限切れbucketは次の推論時に削除する実装とindexがある。利用集計だけを保持する現状に、掃除用の新Workerやcronを追加する必要はない。 | [server/ai-usage.ts:90](../server/ai-usage.ts#L90)、[ADR 0016](adr/0016-add-free-model-selection-and-durable-usage-limits.md) |
| CF37 | P3 | 人の判断が必要 | `security.txt` は、公開してよい連絡先と有効期限を維持する担当が決まった場合に追加を判断する。連絡先を推測して生成しない。アカウントのAudit Logsは管理操作の確認に使い、HTTPアクセスログやアプリの監視と同一視しない。 | [Security.txt][cf-security-txt]、[Audit logs][cf-audit] |
| CF38 | P2 | 実装済み | PR基点 `9307d38` のインストール済みWrangler 4.153.0で、本番互換日 `2026-10-15` の19件のHTTP確認とキーボード操作を通過した。一時的なWranglerや追加の依存更新は不要だった。初回の4.149.0と4.151.3の対応は履歴として保持する。 | [wrangler.jsonc:5](../wrangler.jsonc#L5)、[PR #60](https://github.com/AudioStakes/arimono-de-recipe/pull/60)、[初回検証のWrangler 4.151.3][wrangler-41513] |

## 誤った追加対策を避けるための境界

404の実装にはトップレベルの `404.html` を使う。
Pagesの `_redirects` は404を返す仕組みではないため、`/* /404.html 404` のような設定は追加しない。[Redirects][cf-redirects]
静的な未知のパスをFunctionで処理する変更も、既存の限定ルートを広げるため採用しない。

Previewの `X-Robots-Tag: noindex` は検索エンジン向けの指示であり、アクセス制御ではない。
Previewは既定では公開され、branch aliasを新deploymentへ向けても、既存のhash付きURLは残る。
非公開にする場合はAccessの対象ホスト名と旧URLを確認する。[Preview deployments][cf-previews]

静的ファイルの `Access-Control-Allow-Origin: *` は、公開素材を配るPagesの応答と、入力を受け取るAPIのCORSを分けて評価する。
静的応答の既定値をAPIへ追加する必要はない。[Headers][cf-headers]
`X-XSS-Protection` は非推奨なので、新しい防御として追加しない。[MDN][mdn-xss]

ローカルの `public/brand/.DS_Store` は、それだけでは公開漏えいの証拠にならない。
今回確認したインストール済みWranglerのアップローダーは `**/.DS_Store` を除外する。
将来アップロード手段を変える場合は、実際の成果物と公開応答を再確認する。

## ログから判断する範囲

- 既知の攻撃用パスへのアクセスは、自動探索の形跡になり得るが、侵入成功の証拠にはならない。まずステータス、Content-Type、本文を比較する。
- `200` の件数だけで実ファイルへのアクセスやAPI成功を数えない。今回の4パスは同じHTMLを返していた。
- 全HTTPリクエスト、Functionの実行、AI推論、Web Analyticsのbeaconは異なる事象である。Functionの割当と費用を調べる場合はFunctions側の指標を使う。[Functions pricing][cf-functions-pricing]、[Functions metrics][cf-metrics]
- DashboardのHTTPログは、Freeでも利用できるsampled HTTP analyticsと、有料のLog Explorerなどの製品を区別する。画面に表示された250行を全アクセス件数や有料契約の証拠にしない。[Logs datasets][cf-log-datasets]
- Pages Functionsのリアルタイムログは永続保存されず、アカウントのHTTPログとも別である。Workers向けのobservability設定をそのままPagesの対応機能として追加しない。[Debugging and logging][cf-logging]
- Origin、Referer、User-Agentだけで利用者や攻撃者を識別しない。Origin検証があるAPIへも、直接HTTPクライアントは送信できる。
- APIの429や503だけで、上流AIが実行されたか、利用量が発生したかを確定しない。ローカル制限、構成不足、上流障害を分けて調べる。
- Dashboardで確認していないAccess、WAF、Cache Rules、請求通知、D1設定を「存在しない」と記録しない。

## 次回リリースと運用確認

1. 変更した404ページ、構造テスト、手順をレビューし、通常の品質確認を通す。
2. Pagesランタイムでトップページ、未知のパス、既知の静的ファイル、存在しないAPIのHTTPステータスを確認する。
3. 運営者がGroq利用時のFree契約、D1 migration、旧deploymentの保護を確認する。配信元には最新mainのProduction設定を使い、AI推論を伴う確認は別途判断する。
4. 承認済みの通常手順でデプロイした後、CF03とCF14の公開応答を照合する。停止が必要な場合は既存の[全AI停止手順](deployment.md#全aiの緊急停止)を使う。
5. 継続運用ではCF25の利用量とエラーを確認する。新たな対策が必要になった時点で、CF23とCF24を判断する。

Cloudflareの予算通知は支出を止める上限ではなく、対象の従量課金プランにも条件がある。
通知を得るためだけに有料プランへ移行せず、現行Free契約、アプリのD1制限、共通Freeフラグによる停止手順を維持する。[Budget alerts][cf-budget]
AI bindingを外すだけではGroqを止められないため、全AIの停止には既存手順の `CLOUDFLARE_FREE_ONLY` を使う。

この調査で確認した公開応答は変更前の本番のものである。
リポジトリでの404対応と、本番で404を返す状態は区別して記録する。
具体的な検証コマンドとその結果は、このターンの実装報告および[配信確認手順](deployment.md)に記録する。

## 装飾追加前のローカル検証

この節は、404のソースを `public/404.html` に置き、そのままビルド出力へコピーしていた初期実装の記録である。
後続の共通CSS適用とソース移動は、次節に分けて記録する。

最初はインストール済みWrangler 4.149.0のruntimeが本番の互換日 `2026-10-15` を受け付けず、対応上限 `2026-10-13` のエラーとなった。
この時点では一時的なfixtureの日付だけを13として確認したが、続いて公式Wrangler 4.151.3を一時ディレクトリへ固定インストールし、本番と同じ日付15でも再確認した。
4.151.3は2026-10-20公開、同梱workerd 1.20261019.1の対応上限は2026-10-26である。[release][wrangler-41513]、[package metadata][wrangler-registry]、[workerd source][workerd-maxdate]
以下は最終の `2026-10-15` で通過した結果であり、検証結果JSONにもWrangler版と互換日を記録した。
本番へのデプロイ確認はCF03の残作業である。

| 確認範囲 | 結果 |
| --- | --- |
| WordPress、Git、未定義API、存在しないJS、深いパス、source mapの6パスにGETとHEAD | 12件とも404。GET本文は追加した404ページと一致。 |
| ルート、favicon、実在するCSSとJS | 4件とも200。静的ヘッダーを確認。 |
| モデル設定GET | 200、JSON、`no-store`。検証用設定では全モデル無効。 |
| 推論APIへのGETとHEAD | 2件とも405。 |
| 404画面のキーボード操作 | トップへ戻るリンクで `/` へ移動。 |

HTTP確認は合計19件を通過した。
デスクトップ1280×800とモバイル390×844の404画面を撮影した。
画像名は `cloudflare-404-desktop.png` と `cloudflare-404-mobile.png` である。
この検証では上流AIを呼んでいない。
検証用スクリプトと結果はローカルの `/tmp/arimono-check-pages.mjs` と `/tmp/arimono-pages-verification.json` に保存した。
検証用Wranglerは `/tmp/arimono-wrangler-41513.nXpPIr` にだけ導入し、リポジトリの依存、lockfile、本番の互換日を変更していない。
これは初回調査時の一時対応である。
PR基点ではPR #60の依存更新を取り込み済みであり、4.151.3の採用や追加の依存更新を残課題としない。
初期実装の最終確認では次のコマンドが終了コード0となり、同じ19件とキーボード操作を再確認した。

```bash
PATH=/Users/satoudaisuke/.asdf/installs/nodejs/24.22.1/bin:$PATH node /tmp/arimono-check-pages.mjs
```

当時の `cmp public/404.html dist/404.html` も終了コード0だった。
現在のVite HTML entryではCSSの参照先がビルド時に書き換わるため、このバイト単位の比較は現行構成の検証には使わない。

文書自身の確認は `ASDF_NODEJS_VERSION=24.22.1 npm run lint:markdown -- docs/cloudflare-readiness-2026-10-28.md` が終了コード0だった。
相対リンク先のファイル存在と点検IDの重複も検査し、問題はなかった。

`npm run check` の初回実行（Node.js 26.12.1）は終了コード1だった。
整形、lint、型検査、ビルド、unit、structureは通過し、E2Eは693件成功、1件失敗だった。
追加した404画面の検証は6プロファイル全てで通過した。
失敗はWebKitの[既存AIフローのコピー確認](../tests/e2e/direct-ai-flow.spec.ts#L588)で、コピー先の値が空だったというassertionである。
traceは `/tmp/arimono-initial-webkit-trace.zip` に保持した。
この初回結果だけで全チェック成功とは扱わず、原因確認と再実行の結果を分けて記録する。

同じWebKitの失敗ケースを次のコマンドで再実行すると、終了コード0、3件成功、予期しない失敗0件だった。

```bash
ASDF_NODEJS_VERSION=24.22.1 npm run test:e2e -- --project=webkit --grep '1280pxで待機中の未確定材料をコピーすると旧通信を中断して再送信できる' --repeat-each=3 --workers=1
```

traceの調査では、既存コンボボックスのfocusout後120 msの処理とコピー操作が近接したことが原因候補になった。
ただし、タイマーの実行順を確定するDOMイベント記録はなく、原因は未確定である。
失敗したケースは404ページへ移動しておらず、今回アプリのフォーカス処理やassertionは変更していない。
再実行の成功を、この競合を修正した証拠にはしない。

最終の全体確認は、Node.js 24.22.1とCIと同じ2 workersの条件で次を実行し、終了コード0だった。

```bash
PATH=/Users/satoudaisuke/.asdf/installs/nodejs/24.22.1/bin:$PATH ASDF_NODEJS_VERSION=24.22.1 CI=true npm run check
```

整形、lint、型検査、ビルド、unit、structure、E2Eが全て通過した。
E2Eは694件成功、予期しない失敗0件、skip 0件、flaky判定0件だった。
追加した404確認は `chromium`、`mobile-chrome`、`firefox`、`webkit`、`mobile-safari`、`tablet-safari` の6プロファイルで通過した。
全体ログは `/tmp/arimono-cloudflare-check-final.log`、機械可読なE2E結果は `playwright-report/results.json` に保存した。
初回のWebKit失敗と未確定の原因候補は、この最終成功と分けて残す。

## 404画面への共通CSSの適用

追加依頼に合わせ、404のソースをルートの [404.html](../404.html) へ移し、[vite.config.ts](../vite.config.ts) のHTML entryに加えた。
[src/styles.css](../src/styles.css) を共有し、クリーム色の背景に大きな404、短い案内、トップへのリンクを中央配置する。
404のソースにはJavaScriptを追加していない。
ビルド後の配信先は引き続き `dist/404.html` で、Pagesのトップレベル404の仕組みを使う。

共通CSS適用後はNode.js 24.22.1で次を実行し、全て終了コード0だった。

| コマンド | 結果 |
| --- | --- |
| `npm run format:check` | 通過。 |
| `npm run lint` | 通過。 |
| `npm run typecheck` | 通過。 |
| `npm run build` | 通過。 |
| `npm run test:structure` | 通過。 |

ログは `/tmp/arimono-404-design-check.log` に保存した。
ビルド済み404にはハッシュ付きCSS参照が1つあり、scriptはなかった。
ソースのCSS参照は `./src/styles.css` とし、最終ビルド結果がE2Eで確認した成果物と同一であることも比較した。
ソースHTMLとビルドHTMLのバイト比較とは区別する。

ブラウザ検証は次のコマンドが終了コード0となった。

```bash
PATH=/Users/satoudaisuke/.asdf/installs/nodejs/24.22.1/bin:$PATH ASDF_NODEJS_VERSION=24.22.1 CI=true npm run test:e2e -- tests/e2e/assets.spec.ts tests/e2e/app.spec.ts
```

6プロファイルで96件成功、予期しない失敗0件、skip 0件、flaky判定0件だった。
ログは `/tmp/arimono-404-design-e2e.log`、結果は `playwright-report/results.json` に保存した。
動作に関わる変更は404のHTML、専用のCSS規則、HTML entryと関連ガードに限るため、ドメインと依頼文のunit、全E2E 694件の再実行は省略した。
前節の全体成功は装飾追加前の履歴として保持する。

Pagesでも `/tmp/arimono-check-pages.mjs` を公式Wrangler 4.151.3、本番互換日 `2026-10-15` で再実行し、終了コード0、19件のHTTP確認とキーボード操作が通過した。
未知のパスは装飾済み404を表示してCSSを読み込み、トップへ戻るリンクも動作した。
既存のルートとアセットは200、モデル設定はJSONで200、推論APIへのGETとHEADは405だった。
上流AIは呼んでいない。
`/tmp/arimono-pages-verification.json` は、この段階の再検証内容へ更新した。
PRレビュー用の画像は[デスクトップ](media/404-desktop.png)と[モバイル](media/404-mobile.png)を参照する。
ソースの `404.html` を直接開く確認でも共通CSSを読み込み、1280×800で背景色 `rgb(255, 251, 237)` と404見出しの160 pxを確認した。

## PR提出前の再検証

`origin/main@9307d38` を基点とする `codex/cloudflare-404-readiness` のworktreeで、次の全体確認を実行した。

```bash
PATH=/Users/satoudaisuke/.asdf/installs/nodejs/24.22.1/bin:$PATH ASDF_NODEJS_VERSION=24.22.1 CI=true npm run check
```

終了コードは0だった。
整形、lint、型検査、ビルド、unit、structure、E2Eが全て通過し、E2Eは706件成功、予期しない失敗0件、skip 0件、flaky判定0件だった。
全体ログの保存先は `/tmp/arimono-cloudflare-pr-check.log` である。
706件は今回のPR基点での全体結果であり、前節までの694件と96件は旧checkoutでの検証履歴である。

Pagesの配信確認も、新worktreeにインストールされたWrangler 4.153.0と本番互換日 `2026-10-15` で再実行した。

```bash
PATH=/Users/satoudaisuke/.asdf/installs/nodejs/24.22.1/bin:$PATH node /tmp/arimono-pr-check-pages.mjs
```

終了コードは0で、19件のHTTP確認、404画面のキーボード操作、デスクトップとモバイルの撮影が通過した。
一時ディレクトリのWranglerは使っていない。
結果の保存先は `/tmp/arimono-pr-pages-verification.json` で、PRに含める最新画像は[デスクトップ](media/404-desktop.png)と[モバイル](media/404-mobile.png)である。
実AIの呼び出し、本番設定の変更、本番へのデプロイは行っていない。
本番配信後のHTTP確認はCF03の残作業として維持する。

## 一次資料

Cloudflareの仕様は調査日時点のものを参照した。
料金、無料枠、利用可能な保護機能は契約ごとに変わり得るため、プラン変更や独自ドメイン導入時に再確認する。
補足資料は、ブラウザ仕様を管理するMDN、`.dev` を運営するGoogle、採用ツールのVite公式ドキュメントに限定した。

[cf-pages]: https://developers.cloudflare.com/pages/
[cf-serving]: https://developers.cloudflare.com/pages/configuration/serving-pages/
[cf-redirects]: https://developers.cloudflare.com/pages/configuration/redirects/
[cf-previews]: https://developers.cloudflare.com/pages/configuration/preview-deployments/
[cf-old-deployments]: https://developers.cloudflare.com/pages/configuration/api/#deleting-old-deployments-after-a-week
[cf-routing]: https://developers.cloudflare.com/pages/functions/routing/
[cf-local]: https://developers.cloudflare.com/pages/functions/local-development/
[cf-upload]: https://developers.cloudflare.com/pages/get-started/direct-upload/
[cf-headers]: https://developers.cloudflare.com/pages/configuration/headers/
[cf-sourcemaps]: https://developers.cloudflare.com/pages/functions/source-maps/
[cf-analytics-faq]: https://developers.cloudflare.com/web-analytics/faq/#what-do-i-need-to-add-to-my-content-security-policy-csp
[cf-pages-analytics]: https://developers.cloudflare.com/pages/how-to/web-analytics/
[cf-nel]: https://developers.cloudflare.com/network-error-logging/
[cf-bindings]: https://developers.cloudflare.com/pages/functions/bindings/
[cf-d1-batch]: https://developers.cloudflare.com/d1/worker-api/d1-database/#batch
[cf-workers-limits]: https://developers.cloudflare.com/workers/platform/limits/
[cf-ai-pricing]: https://developers.cloudflare.com/workers-ai/platform/pricing/
[cf-functions-pricing]: https://developers.cloudflare.com/pages/functions/pricing/
[cf-migration-matrix]: https://developers.cloudflare.com/workers/static-assets/migration-guides/migrate-from-pages/#compatibility-matrix
[cf-rate-plans]: https://developers.cloudflare.com/waf/rate-limiting-rules/
[cf-waf]: https://developers.cloudflare.com/waf/get-started/
[cf-rate-accuracy]: https://developers.cloudflare.com/workers/runtime-apis/bindings/rate-limit/#accuracy
[cf-turnstile]: https://developers.cloudflare.com/turnstile/get-started/server-side-validation/
[cf-metrics]: https://developers.cloudflare.com/pages/functions/metrics/
[cf-logging]: https://developers.cloudflare.com/pages/functions/debugging-and-logging/
[cf-rollbacks]: https://developers.cloudflare.com/pages/configuration/rollbacks/
[cf-compatibility]: https://developers.cloudflare.com/workers/configuration/compatibility-dates/
[cf-limits]: https://developers.cloudflare.com/pages/platform/limits/
[cf-workers-assets]: https://developers.cloudflare.com/workers/static-assets/routing/static-site-generation/
[cf-2fa]: https://developers.cloudflare.com/fundamentals/user-profiles/2fa/
[cf-upload-ci]: https://developers.cloudflare.com/pages/how-to/use-direct-upload-with-continuous-integration/
[cf-token]: https://developers.cloudflare.com/fundamentals/api/get-started/create-token/
[cf-wrangler-config]: https://developers.cloudflare.com/pages/functions/wrangler-configuration/
[cf-fail-mode]: https://developers.cloudflare.com/pages/functions/routing/#fail-open--closed
[cf-d1-pricing]: https://developers.cloudflare.com/d1/platform/pricing/
[cf-security-txt]: https://developers.cloudflare.com/security-center/infrastructure/security-file/
[cf-audit]: https://developers.cloudflare.com/fundamentals/account/account-security/audit-logs/
[cf-log-datasets]: https://developers.cloudflare.com/observability/logs/datasets/
[cf-budget]: https://developers.cloudflare.com/billing/manage/budget-alerts/
[groq-limits]: https://console.groq.com/docs/rate-limits
[vite-build]: https://vite.dev/config/build-options
[vite-sourcemap]: https://vite.dev/config/build-options#build-sourcemap
[mdn-permissions]: https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Headers/Permissions-Policy
[mdn-xss]: https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Headers/X-XSS-Protection
[google-dev]: https://developers.googleblog.com/en/build-security-into-your-next-website/
[wrangler-41513]: https://github.com/cloudflare/workers-sdk/releases/tag/wrangler@4.151.3
[wrangler-registry]: https://registry.npmjs.org/wrangler/4.151.3
[workerd-maxdate]: https://raw.githubusercontent.com/cloudflare/workerd/v1.20261019.1/src/workerd/io/maximum-compatibility-date.txt
