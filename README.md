# ありもの de レシピ

冷蔵庫にある材料から、今日作る料理候補を見つけるWebアプリです。

主な使い方は2つです。

- `今日の候補を見る`: 家にある食材・材料をもとに、Cloudflare Pages Function 経由で Cloudflare Workers AI に依頼し、アプリ内に短い料理候補を表示します。
- `AI向けレシピ依頼文をコピー`: ChatGPT、Claude、Geminiなど、普段使っているAIに貼り付けられる依頼文をコピーします。アプリ内AI候補が失敗した場合の fallback としても使えます。

現在の候補表示は、買い足しなしを基本にします。買い足しなしは通常状態なので、候補カードには `買い足しなし` badge として表示しません。買い足しを許可する動線は、明示的な opt-in が必要になった時点で別途扱います。

料理を決めた後の調理ビューは、手順を進めるプレイヤーではなく参照用のタブです。`材料`、`作り方`、`味の調整` を切り替えて確認できます。

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

このコマンドは `npm run build` 後に `wrangler pages dev dist --ai=AI` を起動します。Workers AI はローカル開発でも Cloudflare アカウントを使うため、無料枠や利用量の上限を超えるとAI候補表示が失敗する可能性があります。必要に応じて Cloudflare 側で rate limiting / WAF などの保護を設定してください。

AI生成に失敗した場合や、好みのAIサービスを使いたい場合は、画面の `AI向けレシピ依頼文をコピー` を使ってください。コピー導線は外部サービスへ自動送信せず、ユーザーが明示的にコピーして任意のAIへ貼り付ける設計です。
