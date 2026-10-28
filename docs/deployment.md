# Cloudflareでの公開・ローカル確認

依頼文コピーだけなら `npm run dev` または `dist/` の静的配信で動きます。アプリ内の「AIへ送信」には、Cloudflare Pages Functions、AI、D1の利用制限設定が必要です。既存の `/api/recipe` を使い、ブラウザへAPIキーを渡しません。[モデルと利用制限の設定](architecture/ai-provider-setup.md)を完了してから有効にしてください。設定不足ではAI送信を停止します。

## 公開先と設定

公開先は **<https://arimono-de-recipe.pages.dev/>** です。Cloudflare Pagesプロジェクト名は `arimono-de-recipe`、本番ブランチは `main` です。

`wrangler.jsonc` に出力先 `dist/`、互換日、Workers AIの `AI` バインディングを定義しています。アカウントIDやAPIキーはリポジトリへ保存しません。本番設定を変える場合は、このファイルをPRで変更してからデプロイします。

```bash
npm ci
npx playwright install --with-deps chromium firefox webkit
npm run check
npm run audit:dependencies
npx wrangler login --scopes account:read user:read workers:write pages:write ai:write d1:write
npx wrangler pages deploy dist --project-name arimono-de-recipe --branch main
```

本番へのデプロイは、CIを通してマージした最新 `main` で行います。`check` が `dist/` を生成し、Wranglerがルートの `functions/` もビルドします。現在はWranglerによるDirect Uploadで、GitHubへのpushだけでは自動デプロイしません。

`public/_routes.json` はビルド時に `dist/_routes.json` へコピーし、Functionの実行対象を `/api/recipe` に限定します。通常の画面・静的ファイルへのアクセスでFunctionを起動する必要はありません。

ルートの `404.html` はViteのHTMLエントリとして処理し、共通の `src/styles.css` を参照する `dist/404.html` を生成します。Pagesは配信ルートの `404.html` がないとSPAとみなし、存在しないパスにもトップページを200で返します。このアプリでは未知のパスを404にするため、このエントリを維持してください。`_redirects` で404ステータスを指定する方法は対応していません。[Pagesの配信仕様](https://developers.cloudflare.com/pages/configuration/serving-pages/)、[redirectの対応範囲](https://developers.cloudflare.com/pages/configuration/redirects/)

独自のアカウントで公開する場合は、コード・画像の利用条件を確認し、Pagesプロジェクト名を変更してください。Git連携ビルドを選ぶ場合はNode.js 22.22以上の22系、ビルド `npm run build`、配信ディレクトリ `dist` を使用します。

## ローカルでFunctionも動かす

```bash
npm ci
npx wrangler login
npm run dev:pages
```

`dev:pages` はビルド後に `wrangler pages dev dist --ai=AI` を起動します。表示されたローカルURLを開いてください。**Workers AIの推論はローカルで起動した場合もCloudflareアカウントを利用し、利用量・料金の対象になります。** ログインやAI利用は実行者のアカウントで行ってください。

今回の利用制限ガードは、D1・Free確認・信頼できるedge IPが不足する通常のローカル環境ではAIを呼びません。ローカル検証のために接続元判定を緩めないでください。自動テストはfakeのbindingとIPを使います。

AIを呼ばずに画面と依頼文コピーを確認する場合は、Functionを起動しない静的プレビューを使います。

```bash
npm run build
npm run preview
```

このモードはFunctionを配信しません。通常の自動テストはモックを使い、Cloudflareアカウントや課金を必要としません。AI未設定時のFunctionの応答もユニットテストで確認します。

## HTTPステータスの確認

`npm run check` は404ファイルの存在とFunctionの実行範囲、404画面からトップへ戻る操作を検査します。
E2Eの配信はVite previewのため、Pages固有のステータス、ヘッダー、ルーティングは `wrangler pages dev` と公開後のURLでも確認します。
ビルド後に `dist/404.html` が生成され、参照するCSSが読み込めることを確認してください。HTML内のCSSパスはViteがビルド時に書き換えるため、ソースHTMLとのバイト比較は行いません。

公開後は次のGETを実行します。確認先をPreviewに変更する場合も、実AIへのPOSTは不要です。

```bash
recipe_origin=https://arimono-de-recipe.pages.dev
for recipe_path in / /brand/favicon.png /wp-login.php /.git/config /api/does-not-exist /assets/does-not-exist.js '/api/recipe?models'; do
  curl --silent --show-error --max-time 20 --output /dev/null \
    --write-out "$recipe_path status=%{http_code} type=%{content_type}\n" \
    "$recipe_origin$recipe_path"
done
curl --silent --show-error --max-time 20 --dump-header - --output /dev/null \
  "$recipe_origin/api/recipe?models"
```

| 対象 | 期待する応答 |
| --- | --- |
| `/` と既存の画像、CSS、JS | GETで200。条件付きリクエストの304は正常 |
| 未存在の画面、`.git/config`、API、アセット | GETとHEADで404。GET本文は404ページ |
| `GET /api/recipe?models` | 200のJSON、`Cache-Control: no-store`、`X-Content-Type-Options: nosniff` |
| `/api/recipe` の対象外メソッド | 405。モデル一覧の確認はHEADではなくGETを使う |

未知のパスが404でも、実在するHTMLの拡張子除去などの正規化では301が返る場合があります。
通常の静的ファイルをFunctionへ広げず、Pages標準キャッシュを維持します。[キャッシュの公式推奨](https://developers.cloudflare.com/pages/configuration/serving-pages/#caching-and-performance)

## 公開APIの濫用・費用対策

`/api/recipe` はログインを持たず、接続元ごとの回数と全体・提供元の使用量をD1で制限します。Origin検証だけでは直接HTTP送信を防げません。IP制限も一人単位の識別ではなく、VPN等で回避され得るため全体上限を併用します。

公開運用前に、所有者が次を確認してください。

- `/api/recipe` に適用できるCloudflareのRate limiting/WAF設定と、使用するプランの対応範囲を確認する。Preview URL等で保護を迂回できないかも確認する。
- 想定利用者数に合わせて呼び出し頻度を制限し、AI使用量と課金を定期的に確認する。通知は必ずしも利用停止や上限を意味しないため、利用を止める手順も用意する。
- AIを停止する必要がある場合は、下記の全AI停止手順を使い、AI回答の生成を止めても依頼文コピーを利用できることを確認する。
- 本番テストにはダミーの材料を使う。負荷試験を行う場合は、課金や運用への影響を事前に確認する。

依頼文12,000文字、本文32,000バイト、回答20,000文字、出力トークン数の上限は1回の処理を抑えるためのもので、継続的な呼び出しの費用を制限しません。具体的な料金や利用枠は[Workers AIの料金](https://developers.cloudflare.com/workers-ai/platform/pricing/)で確認してください。

### 現在の無料枠と停止手順

2026-10-16にDashboardでWorkers **Free** を確認しました。このアプリは `AI.run` を直接利用し、AI Gatewayや前払課金を使いません。有料プランへの変更は行っていません。

FreeではWorkers AIはアカウント全体で10,000 Neurons／日、Pages FunctionsはWorkersと共有で100,000 requests／日が上限です。上限到達後はAI応答が失敗し、日次枠は09:00 JSTにリセットします。他アプリと枠を共有するため、第三者の反復呼び出しによる可用性低下は残ります。アプリの利用制限とは別の、提供元側の課金停止境界です。[Workers AI料金](https://developers.cloudflare.com/workers-ai/platform/pricing/)・[Pages料金](https://developers.cloudflare.com/pages/functions/pricing/)

制限導入前の旧deploymentはこのD1制限を持ちません。本番を有効化する前に、旧URL・Previewからの迂回を止めるか、不要なdeploymentを運営者が削除してください。コード作業中には削除やアカウント設定を行っていません。

PagesはWorkersのRate Limiting bindingに対応していません。有料運用へ変更する前には、管理下の独自ドメインのWAF等で全入口の制限を設計してください。`pages.dev`、過去のdeployment URL、Previewからの迂回も確認します。[公式の対応表](https://developers.cloudflare.com/workers/static-assets/migration-guides/migrate-from-pages/#compatibility-matrix)

### 全AIの緊急停止

1. Pagesの対象環境で `CLOUDFLARE_FREE_ONLY` を削除するか文字列 `false` にし、設定を反映したdeploymentを再配信します。これはCloudflare・Groq両方の新規推論の受付を止める共通の条件です。`AI` バインディングの削除だけではGroqは停止しません。既に上流へ送った推論の取消や使用量予約の返却は保証しません。
2. 本番originの `GET /api/recipe?models` で全モデルが `enabled: false` であることを確認します。入力内容や実AI呼び出しを伴わない確認です。
3. ページを再読込し、AI送信が無効で、材料入力・依頼文コピーを利用できることを確認します。既に開いている画面からの送信もAPIは503で拒否します。
4. ProductionだけでなくPreview・旧deployment URLも確認します。設定変更は既に配信済みの旧deploymentへ遡及しないため、推論できる旧URLを運営者が無効化するか、不要なdeploymentを削除します。

再開は[有効化前の確認](architecture/ai-provider-setup.md#有効化前の確認)をやり直してから行います。プラン変更時には無料枠の前提も再確認します。

## 配信とプライバシーの確認

静的ファイルのセキュリティヘッダーは `public/_headers` に定義しています。Pages Functionの応答には `_headers` が適用されないため、API側で `Cache-Control: no-store` と `X-Content-Type-Options: nosniff` を返します。

### Cloudflare Web Analytics

`arimono-de-recipe.pages.dev` 専用のWeb Analyticsサイトを登録済みです。`src/web-analytics.ts` は公開サイト識別子を使い、正確な本番originでページ読込後に一度だけ標準beaconを挿入します。APIトークンやアカウントIDはブラウザへ渡しません。ローカル・Previewは集計しません。

**Pagesの自動Web Analytics挿入は有効にしないでください。** 手動beaconとの二重計測を防ぐためです。独自のドメイン・アカウントへ移す場合は、自分の解析サイトを登録してoriginと公開サイト識別子を更新します。

CSPではスクリプトを `https://static.cloudflareinsights.com/beacon.min.js`、解析の送信を `https://cloudflareinsights.com/cdn-cgi/rum` に限定します。実デプロイ後、スクリプト読込とbeaconの応答が成功し、Dashboardへ反映されることを確認します。ブロッカーや反映の遅延で数値が一致しない場合があります。[公式のCSP説明](https://developers.cloudflare.com/web-analytics/faq/#what-do-i-need-to-add-to-my-content-security-policy-csp)

公開URLで以下を確認してください。

- 材料の入力・依頼文の確認・コピーだけでは推論の `POST /api/recipe` が呼ばれない。初期表示の `GET /api/recipe?models` は入力を含まない設定確認だけを行う。
- 明示的な「AIへ送信」は表示・コピーする依頼文全文を送る。待機・失敗後もコピーできる。
- 成功時はMarkdown形式の回答を表示する。HTMLや外部画像は実行せず、安全なリンクだけを利用者の操作で開く。
- AIを停止した場合、応答が失敗した場合、入力上限を超えた場合もコピーできる。
- 画面の外部送信の説明が見え、API応答を共有キャッシュへ保存しない。
- HTTPSでクリップボードが動き、デスクトップ・モバイルで操作できる。

## 問題発生時のロールバック

費用や意図しないAI送信が疑われる場合は、先に「全AIの緊急停止」を実施します。
配信を戻すだけでは、Previewや旧deployment URLのAPIは停止しません。
停止を維持するときは、戻し先のhash URLで全モデルが無効であることを切り替え前に確認してください。
通常の旧版へ戻すと、旧deploymentの有効設定が復活する可能性があります。
停止済みの安全な戻し先がなければ、既知の正常なコードをAI停止設定で再デプロイする方法を所有者が判断します。

1. Pagesプロジェクトの **Deployments** で、利用制限と無料契約の前提を満たす既知の正常なProduction deploymentを選びます。D1制限導入前など、保護のない旧版を戻し先にしないでください。
2. 所有者が対象deploymentのメニューから **Rollback to this deployment** を選び、確認します。成功したProduction deploymentだけが対象で、Previewは対象外です。
3. 本番URLで「HTTPステータスの確認」を実行し、入力とコピーが使えることを確認します。AI停止中はモデル一覧の全モデルが無効であることも確認します。
4. 戻したdeploymentの識別子、理由、確認結果を作業記録に残します。古いURLの公開状態も別途確認します。

PagesのロールバックをD1データの復元として扱わないでください。
利用制限用DBを過去へ戻すと、消費済みの枠が未使用に戻る可能性があります。
本番のロールバック、旧deploymentの削除、D1の復元は所有者が判断して実施します。[Pagesのロールバック](https://developers.cloudflare.com/pages/configuration/rollbacks/)

今回のCloudflare設定監査と残る確認項目は[2026-10-28の調査記録](cloudflare-readiness-2026-10-28.md)にまとめています。

## よくある問題

| 症状 | 確認すること |
| --- | --- |
| Viteの開発画面でAI回答が出ない | `npm run dev` にFunctionはありません。コピーを使うかPages devへ切り替える。 |
| 本番でAIへの送信に失敗する | [AI・D1・Free設定とsecret](architecture/ai-provider-setup.md)、Production/Previewの分離、再デプロイ、使用量・モデルの利用可否を確認する。 |
| Function自体が動かない | `functions/` を含むPagesのビルドか、`dist/` だけの静的配信かを確認する。 |
| 上限超過の案内が出る | 材料や条件を減らすか、条件を含む依頼文コピーを使う。 |
| コピーできない | HTTPSやブラウザの権限を確認し、出力欄を選択して手動でコピーする。 |
| 30秒後に待機が中断される | 通信とAIの状態を確認する。クライアントの中断が推論の停止や課金取消を保証するわけではありません。 |

公式資料: [Pagesバインディング](https://developers.cloudflare.com/pages/functions/bindings/)、[Functionルーティング](https://developers.cloudflare.com/pages/functions/routing/)、[Pagesヘッダー](https://developers.cloudflare.com/pages/configuration/headers/)。
