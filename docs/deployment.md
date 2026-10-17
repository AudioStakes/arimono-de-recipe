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
npx wrangler login --scopes account:read user:read workers:write pages:write ai:write
npx wrangler pages deploy dist --project-name arimono-de-recipe --branch main
```

本番へのデプロイは、CIを通してマージした最新 `main` で行います。`check` が `dist/` を生成し、Wranglerがルートの `functions/` もビルドします。現在はWranglerによるDirect Uploadで、GitHubへのpushだけでは自動デプロイしません。

`public/_routes.json` はビルド時に `dist/_routes.json` へコピーし、Functionの実行対象を `/api/recipe` に限定します。通常の画面・静的ファイルへのアクセスでFunctionを起動する必要はありません。

独自のアカウントで公開する場合は、コード・画像の利用条件を確認し、Pagesプロジェクト名を変更してください。Git連携ビルドを選ぶ場合はNode.js 22、ビルド `npm run build`、配信ディレクトリ `dist` を使用します。

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

このモードはFunctionを配信しません。新しい `wrangler.jsonc` は `AI` バインディングを含むため、`wrangler pages dev` を使うとローカルでも実AIを呼べます。通常の自動テストはモックを使い、Cloudflareアカウントや課金を必要としません。AI未設定時のFunctionの応答もユニットテストで確認します。

## 公開APIの濫用・費用対策

`/api/recipe` はログインを持たず、接続元ごとの回数と全体・提供元の使用量をD1で制限します。Origin検証だけでは直接HTTP送信を防げません。IP制限も一人単位の識別ではなく、VPN等で回避され得るため全体上限を併用します。

公開運用前に、所有者が次を確認してください。

- `/api/recipe` に適用できるCloudflareのRate limiting/WAF設定と、使用するプランの対応範囲を確認する。Preview URL等で保護を迂回できないかも確認する。
- 想定利用者数に合わせて呼び出し頻度を制限し、AI使用量と課金を定期的に確認する。通知は必ずしも利用停止や上限を意味しないため、利用を止める手順も用意する。
- AIを停止する必要がある場合は `AI` バインディングを外して再デプロイするなど、AI回答の生成を止めても依頼文コピーを利用できることを確認する。
- 本番テストにはダミーの材料を使う。負荷試験を行う場合は、課金や運用への影響を事前に確認する。

依頼文12,000文字、本文32,000バイト、回答20,000文字、出力トークン数の上限は1回の処理を抑えるためのもので、継続的な呼び出しの費用を制限しません。具体的な料金や利用枠は[Workers AIの料金](https://developers.cloudflare.com/workers-ai/platform/pricing/)で確認してください。

### 現在の無料枠と停止手順

2026-10-16にDashboardでWorkers **Free** を確認しました。このアプリは `AI.run` を直接利用し、AI Gatewayや前払課金を使いません。有料プランへの変更は行っていません。

FreeではWorkers AIはアカウント全体で10,000 Neurons／日、Pages FunctionsはWorkersと共有で100,000 requests／日が上限です。上限到達後はAI応答が失敗し、日次枠は09:00 JSTにリセットします。他アプリと枠を共有するため、第三者の反復呼び出しによる可用性低下は残ります。アプリの利用制限とは別の、提供元側の課金停止境界です。[Workers AI料金](https://developers.cloudflare.com/workers-ai/platform/pricing/)・[Pages料金](https://developers.cloudflare.com/pages/functions/pricing/)

制限導入前の旧deploymentはこのD1制限を持ちません。本番を有効化する前に、旧URL・Previewからの迂回を止めるか、不要なdeploymentを運営者が削除してください。コード作業中には削除やアカウント設定を行っていません。

PagesはWorkersのRate Limiting bindingに対応していません。有料運用へ変更する前には、管理下の独自ドメインのWAF等で全入口の制限を設計してください。`pages.dev`、過去のdeployment URL、Previewからの迂回も確認します。[公式の対応表](https://developers.cloudflare.com/workers/static-assets/migration-guides/migrate-from-pages/#compatibility-matrix)

緊急停止する場合は `wrangler.jsonc` の `ai` を削除して再デプロイします。旧deployment URLでAIが使える場合は、Cloudflare Dashboardから不要な旧deploymentも削除します。入力・依頼文コピーが動くことと、AIボタンで失敗を案内することを確認してください。プラン変更時にはこの無料枠前提を再確認します。

## 配信とプライバシーの確認

静的ファイルのセキュリティヘッダーは `public/_headers` に定義しています。Pages Functionの応答には `_headers` が適用されないため、API側で `Cache-Control: no-store` と `X-Content-Type-Options: nosniff` を返します。

### Cloudflare Web Analytics

`arimono-de-recipe.pages.dev` 専用のWeb Analyticsサイトを登録済みです。`src/web-analytics.ts` は公開サイト識別子を使い、正確な本番originでページ読込後に一度だけ標準beaconを挿入します。APIトークンやアカウントIDはブラウザへ渡しません。ローカル・Previewは集計しません。

**Pagesの自動Web Analytics挿入は有効にしないでください。** 手動beaconとの二重計測を防ぐためです。独自のドメイン・アカウントへ移す場合は、自分の解析サイトを登録してoriginと公開サイト識別子を更新します。

CSPではスクリプトを `https://static.cloudflareinsights.com/beacon.min.js`、解析の送信を `https://cloudflareinsights.com/cdn-cgi/rum` に限定します。実デプロイ後、スクリプト読込とbeaconの応答が成功し、Dashboardへ反映されることを確認します。ブロッカーや反映の遅延で数値が一致しない場合があります。[公式のCSP説明](https://developers.cloudflare.com/web-analytics/faq/#what-do-i-need-to-add-to-my-content-security-policy-csp)

公開URLで以下を確認してください。

- 材料の入力・依頼文の確認・コピーだけでは `/api/recipe` が呼ばれない。
- 明示的な「AIへ送信」は表示・コピーする依頼文全文を送る。待機・失敗後もコピーできる。
- 成功時はMarkdown形式の回答を表示する。HTMLや外部画像は実行せず、安全なリンクだけを利用者の操作で開く。
- AIを停止した場合、応答が失敗した場合、入力上限を超えた場合もコピーできる。
- 画面の外部送信の説明が見え、API応答を共有キャッシュへ保存しない。
- HTTPSでクリップボードが動き、デスクトップ・モバイルで操作できる。

## よくある問題

| 症状 | 確認すること |
| --- | --- |
| Viteの開発画面でAI回答が出ない | `npm run dev` にFunctionはありません。コピーを使うかPages devへ切り替える。 |
| 本番でAIへの送信に失敗する | `AI` の名前、Production/Previewの設定、再デプロイ、使用量・モデルの利用可否を確認する。 |
| Function自体が動かない | `functions/` を含むPagesのビルドか、`dist/` だけの静的配信かを確認する。 |
| 上限超過の案内が出る | 材料や条件を減らすか、条件を含む依頼文コピーを使う。 |
| コピーできない | HTTPSやブラウザの権限を確認し、出力欄を選択して手動でコピーする。 |
| 30秒後に待機が中断される | 通信とAIの状態を確認する。クライアントの中断が推論の停止や課金取消を保証するわけではありません。 |

公式資料: [Pagesバインディング](https://developers.cloudflare.com/pages/functions/bindings/)、[Functionルーティング](https://developers.cloudflare.com/pages/functions/routing/)、[Pagesヘッダー](https://developers.cloudflare.com/pages/configuration/headers/)。
