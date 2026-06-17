# ありもの de レシピ

冷蔵庫にある材料と条件から、AI にレシピ提案を依頼する文章を作るWebアプリです。

主な使い方は2つです。

- `AIでレシピを作成`: Cloudflare Pages Function 経由で Cloudflare Workers AI に依頼し、アプリ内にレシピ案を表示します。
- `AI向けレシピ依頼文をコピー`: ChatGPT、Claude、Geminiなど、普段使っているAIに貼り付けられる依頼文をコピーします。

## Setup

```bash
npm install
npm run dev
```

`npm run dev` は従来どおり Vite 単体の開発用です。このモードでは Pages Function は動かないため、アプリ内AI生成は実環境または Pages dev で確認してください。

## Cloudflare Pages / Workers AI

Cloudflare Pages でアプリ内AI生成を使うには、Pages project に Workers AI binding を追加します。

1. Cloudflare dashboard で対象の Pages project を開く。
2. Settings > Bindings から Workers AI binding を追加する。
3. binding name を `AI` にする。
4. 再デプロイする。

ローカルで Pages Function も含めて確認する場合は次を使います。

```bash
npm run dev:pages
```

このコマンドは `npm run build` 後に `wrangler pages dev dist --ai=AI` を起動します。Workers AI はローカル開発でも Cloudflare アカウントを使うため、無料枠や利用量の上限を超えるとAI生成が失敗する可能性があります。必要に応じて Cloudflare 側で rate limiting / WAF などの保護を設定してください。

AI生成に失敗した場合や、好みのAIサービスを使いたい場合は、画面の `AI向けレシピ依頼文をコピー` を使ってください。コピー導線は外部サービスへ自動送信せず、ユーザーが明示的にコピーして任意のAIへ貼り付ける設計です。
