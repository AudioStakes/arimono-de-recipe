# AIモデルと利用制限の設定

コードの実装・検証と、本番アカウントの設定は別である。
この作業ではCloudflare/Groqのアカウント、契約、secret、DBを変更していない。
設定不足の場合は推論を止め、依頼文の作成とコピーを使える状態にする。

## 有効化前の確認

1. CloudflareはWorkers Freeのままにする。有料プランで無料割当だけを使う運用は、今回の追加支払いゼロの保証に使わない。
2. Groqを使う場合はFree専用組織とし、Developerへのupgradeや支払い手段・自動補充を有効にしない。API keyだけから契約区分を検証する仕組みはない。
3. [調査記録](../research/free-ai-api-options.md)のモデル・価格・データ方針を再確認する。無料枠は変更され得る。
4. 本番とPreviewの設定を分ける。Previewから本番の無料枠・DBを消費しないようにする。

## D1とsecrets

運営者がCloudflareへログインした環境で、専用D1を作成する。

```bash
npx wrangler d1 create arimono-ai-usage
```

返された実際のIDを`wrangler.jsonc`へ追加する。以下のプレースホルダーのまま配信しない。

```jsonc
"d1_databases": [
  {
    "binding": "AI_USAGE",
    "database_name": "arimono-ai-usage",
    "database_id": "<実際のdatabase_id>",
    "migrations_dir": "migrations"
  }
]
```

```bash
npx wrangler d1 migrations apply AI_USAGE --remote
npx wrangler pages secret put AI_USAGE_SECRET --project-name arimono-de-recipe
```

`AI_USAGE_SECRET`は32文字以上のランダム値を設定する。チャット、Git、ブラウザコードへ値を貼らない。
Cloudflare Pagesのサーバー環境へ`CLOUDFLARE_FREE_ONLY=true`を設定するのは、Free契約を確認した後だけにする。
Groqを有効にする場合も、Pagesのsecretへ`GROQ_API_KEY`を登録し、確認後に`GROQ_FREE_ONLY=true`を設定する。
`VITE_`付きの環境変数へ秘密情報を入れない。

新しいWorker、課金プラン変更、ユーザーのログイン、recipeの保存は必要ない。
秘密の更新・アカウント設定・配信は、このコード作業では実行していない。

## 上限と保存範囲

1接続元は1分3回・UTC日10回、全体はUTC日100回。日本時間の9時に日付が切り替わる。
IPv6は/64単位でまとめる。NATでは別人が共有し、VPN等では接続元制限を回避され得るため、全体上限も必須。
モデル切替やブラウザの再読込で枠は復活しない。

提供元使用量も送信前に予約する。Cloudflareは日9,000 neurons、Groqは分25回・推定7,800tokens・日180,000tokensまで。
Groqの推定には512tokensのテンプレート余裕を含むが、公式保証の上限ではない。
提供元の実測とはずれ得るため、最終的な無課金停止はFreeプランの制限に依存する。
上流の429や障害で自動再送・他モデルへの自動切替をしない。
Gemmaは公式のthinking無効化を明示する。Groqのlowは推論を無効化する設定ではなく、
1,400の総出力予算に推論も含む。本文が空、または応答が`finish_reason=length`を報告した場合は失敗とする。
Llamaのnative応答のように終了理由がない形式では中断を検出できず、レシピ全体が完結する保証はない。

D1に保存するのはbucket key・予約量・上限・有効期限だけ。
元のIP、食材、依頼文、回答は保存しない。
期限切れbucketは次の推論リクエスト時に削除する。
利用を完全に終了するときは運営者がDBを削除する。
現在lifetime残高bucketを有効にする提供元はない。再deployで残高を補充する実装を追加しない。

## 停止と連携範囲

全AIを止める場合は[緊急停止手順](../deployment.md#全aiの緊急停止)を使う。
共通の`CLOUDFLARE_FREE_ONLY`を無効にして再配信すると、GroqのkeyとFree設定が残っていても全モデルを停止する。

2026-10-18に所有者がOpenAI連携を不要と決定したため、OpenAI API・Sign in with ChatGPT・個人Pro残高の設定は行わない。
過去の残高調査は[調査記録](../research/free-ai-api-options.md#chatgpt-proと62500クレジット)に残す。
GroqのGPT OSSモデルはGroqの利用枠を使い、OpenAIのアカウントへ接続しない。

## 検証範囲

単体テストは実SQLiteでmigrationとtransactionを検証し、上流AIをfakeに置き換える。
E2Eはモデル選択、送信先、明示送信、制限時のコピーを制御した応答で検証する。
実アカウントのbilling区分、実Groq/Workers AIの品質、D1のremote bindingは別途運営者の設定後に確認が必要。
