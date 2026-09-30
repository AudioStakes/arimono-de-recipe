# Cloudflareでの公開・ローカル確認

依頼文コピーだけなら `npm run dev` または `dist/` の静的配信で動きます。アプリ内の「今日の候補を見る」には、Cloudflare Pages FunctionsとWorkers AIの設定が必要です。ブラウザへAPIキーを渡す必要はありません。

## Cloudflare Pages

1. 自分のCloudflareアカウントでPagesプロジェクトを作成し、このリポジトリを接続する。Forkを利用する場合は、先にコードのライセンスを確認する。
2. フレームワークをVite、ビルドコマンドを `npm run build`、出力ディレクトリを `dist`、ルートディレクトリをリポジトリのルートに設定する。
3. ビルドにNode.js 22を使用する（環境変数 `NODE_VERSION=22` 等で指定）。
4. PagesプロジェクトのSettings → BindingsでWorkers AIバインディングを追加し、名前を **`AI`** にする。
5. ProductionとPreviewの両環境の設定を確認し、再デプロイする。公開されたURLで、コピーとAI候補をそれぞれ確認する。

`functions/api/recipe.ts` はルートの `functions/` からPages Functionとしてビルドされます。`dist/` だけを静的アップロードした場合はFunctionも `AI` バインディングも追加されません。

`public/_routes.json` はビルド時に `dist/_routes.json` へコピーし、Functionの実行対象を `/api/recipe` に限定します。通常の画面・静的ファイルへのアクセスでFunctionを起動する必要はありません。

## ローカルでFunctionも動かす

```bash
npm ci
npx wrangler login
npm run dev:pages
```

`dev:pages` はビルド後に `wrangler pages dev dist --ai=AI` を起動します。表示されたローカルURLを開いてください。**Workers AIの推論はローカルで起動した場合もCloudflareアカウントを利用し、利用量・料金の対象になります。** ログインやAI利用は実行者のアカウントで行ってください。

AIを呼ばず、配信やエラー応答だけを確認する場合は以下を使えます。

```bash
npm run build
npx wrangler pages dev dist
```

この場合、AIバインディングなしの呼び出しはエラーになり、画面では依頼文コピーへ戻れます。通常の自動テストはモックを使い、Cloudflareアカウントや課金を必要としません。

## 公開APIの濫用・費用対策

`/api/recipe` にログインや回数制限はありません。Originは同じサイトからのブラウザ送信を検証しますが、直接HTTPを送るプログラムはOriginを設定できるため、認証や濫用対策の代わりにはなりません。

公開運用前に、所有者が次を確認してください。

- `/api/recipe` に適用できるCloudflareのRate limiting/WAF設定と、使用するプランの対応範囲を確認する。Preview URL等で保護を迂回できないかも確認する。
- 想定利用者数に合わせて呼び出し頻度を制限し、AI使用量と課金を定期的に確認する。通知は必ずしも利用停止や上限を意味しないため、利用を止める手順も用意する。
- AIを停止する必要がある場合は `AI` バインディングを外して再デプロイするなど、候補生成を止めても依頼文コピーを利用できることを確認する。
- 本番テストにはダミーの材料を使う。負荷試験を行う場合は、課金や運用への影響を事前に確認する。

本文32,000バイト、候補の入力サイズ、出力トークン数の上限は1回の処理を抑えるためのもので、継続的な呼び出しの費用を制限しません。具体的な料金や利用枠は[Workers AIの料金](https://developers.cloudflare.com/workers-ai/platform/pricing/)で確認してください。

## 配信とプライバシーの確認

静的ファイルのセキュリティヘッダーは `public/_headers` に定義しています。Pages Functionの応答には `_headers` が適用されないため、API側で `Cache-Control: no-store` と `X-Content-Type-Options: nosniff` を返します。

公開URLで以下を確認してください。

- 材料を入力しただけ、またはコピーしただけでは `/api/recipe` が呼ばれない。
- 明示的に候補を要求した場合だけ通信が発生し、成功時に3候補が表示される。
- AIを停止した場合、応答が失敗した場合、入力上限を超えた場合もコピーできる。
- 画面の外部送信の説明が見え、API応答を共有キャッシュへ保存しない。
- HTTPSでクリップボードが動き、デスクトップ・モバイルで操作できる。

## よくある問題

| 症状 | 確認すること |
|---|---|
| Viteの開発画面でAI候補が出ない | `npm run dev` にFunctionはありません。コピーを使うかPages devへ切り替える。 |
| 本番で候補生成に失敗する | `AI` の名前、Production/Previewの設定、再デプロイ、使用量・モデルの利用可否を確認する。 |
| Function自体が動かない | `functions/` を含むPagesのビルドか、`dist/` だけの静的配信かを確認する。 |
| 上限超過の案内が出る | 材料や条件を減らすか、条件を含む依頼文コピーを使う。 |
| コピーできない | HTTPSやブラウザの権限を確認し、出力欄を選択して手動でコピーする。 |
| 30秒後に待機が中断される | 通信とAIの状態を確認する。クライアントの中断が推論の停止や課金取消を保証するわけではありません。 |

公式資料: [Pagesバインディング](https://developers.cloudflare.com/pages/functions/bindings/)、[Functionルーティング](https://developers.cloudflare.com/pages/functions/routing/)、[Pagesヘッダー](https://developers.cloudflare.com/pages/configuration/headers/)。
