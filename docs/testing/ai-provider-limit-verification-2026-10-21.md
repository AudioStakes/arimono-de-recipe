# 2026-10-21 本番AI応答と利用上限エラーの確認

## 本番で確認できたこと

- 公開URLは `https://arimono-de-recipe.pages.dev/`。Cloudflareの本番deploymentは `main` の `e4effb7` で、調査中の作業ツリーとは異なる旧版だった。
- ブラウザで診断用の「豆腐」を入力し、「AIへ送信」を1回押すと回答が表示された。返信が返らない現象は、この操作では再現しなかった。
- 既存の認証を使ってCloudflare GraphQLの `aiInferenceAdaptiveGroups` を読み取り、2026-10-19 22:36:46 UTCから2026-10-20 22:36:46 UTCまで（日本時間10月20日07:36:46から10月21日07:36:46まで）の集計を確認した。
- 上記期間は旧モデル `@cf/meta/llama-3.1-8b-instruct-fast` の呼び出し1件、21.56579 Neurons、`errorCode = 0`。無料枠超過の `3036` を含むAIエラーは記録されていなかった。
- [Cloudflareの無料枠](https://developers.cloudflare.com/workers-ai/platform/pricing/)は1日10,000 Neurons。確認した期間では上限に達しておらず、ユーザーが経験した失敗の原因を無料枠超過とは断定できない。失敗日時・画面表示・通信の記録は未取得。

集計は提供元に到達したAI呼び出しの情報であり、ブラウザ内の入力エラー、通信失敗、API手前の失敗の原因を示すものではない。Analytics API自身の読み取り制限で追加取得が一度停止したが、制限解除後に以下を確認した。この制限はアプリのAI無料枠とは別である。

## 失敗日時の補足後の確認

ユーザーから失敗は約3〜4日前と補足を受け、2026-10-13 22:40:32 UTCから2026-10-20 22:40:32 UTCまでの7日間を、モデル・UTC日付・エラーコード別に再集計した。

| UTC日付 | 呼び出し | Neurons合計 | エラーコード |
| --- | --- | --- | --- |
| 2026-10-16 | 12件 | 約217.07 | すべて0 |
| 2026-10-20 | 1件 | 約21.57 | 0 |

他の日付の行と `3036` はなかった。約3〜4日前を含む記録でも無料枠の上限には達しておらず、無料枠超過が原因だったことを示す証拠はない。個別の失敗原因は未特定のままとする。

## 修正した不具合

提供元の上限エラーまで一般的な500応答に変換していたため、利用者に理由が伝わらなかった。

- Cloudflareの `3036:` で始まる例外をHTTP 429・`provider_quota_exceeded` に変換し、「Cloudflare AIの本日の無料枠の上限に達しました」と案内する。
- GroqのHTTP 429を `provider_rate_limited` に変換し、利用上限と時間をおいての再試行を案内する。短時間制限もあるため、当日の無料枠を使い切ったとは断定しない。
- 混雑の `3040`、認証エラー、未知の失敗は無料枠超過として扱わない。提供元のエラー本文は利用者へ返さない。
- 既存の画面がAPIの安全なメッセージを表示する。自動再送を追加せず、依頼文のコピーを維持する。

判定根拠は[Cloudflareのエラー一覧](https://developers.cloudflare.com/workers-ai/platform/errors/)、[公式binding実装の `_parseError`](https://github.com/cloudflare/workerd/blob/main/src/cloudflare/internal/ai-api.ts)、[Groqの利用制限仕様](https://console.groq.com/docs/rate-limits)。

## 検証記録

Nodeは既存のasdfインストールから `ASDF_NODEJS_VERSION=26.4.0` を指定した。依存関係は変更していない。

| コマンド・確認 | exit code | 結果 |
| --- | --- | --- |
| 修正前 `npm run test:unit -- tests/unit/ai-model-api.test.ts` | 1 | 新規回帰2件が `expected 500 to be 429` で失敗し、表示理由が失われる経路を再現 |
| 修正後 `npm run test:unit` | 0 | Cloudflare無料枠、誤判定防止、Groq上限・認証・障害の回帰を含む単体テストが成功 |
| `npm run check`（制限環境内） | 1 | format・lint・typecheck・build・unit・structureは成功。E2E用サーバーの起動時に停止 |
| `npm exec vite preview -- --host 127.0.0.1 --port 4173 --strictPort --clearScreen false` | 1 | 起動失敗が `listen EPERM: operation not permitted 127.0.0.1:4173` と確認できた |
| 制限外での `npm run test:e2e` | 0 | 700件成功。失敗・skip・flakyは0。3種類の上限表示・alert・コピー維持・自動再送なしを6ブラウザ構成、計18件で確認 |
| `python3 /private/tmp/arimono-ai-analytics-readonly.py aggregate` | 0 | 上記24時間のAI使用量・エラーコードを取得。認証情報・入力文・回答文・IPは出力・保存しない |
| `python3 /private/tmp/arimono-ai-analytics-readonly.py seven-days` | 0 | 補足された失敗日時を含む7日間を取得。全13件がエラーコード0、無料枠超過の記録なし |

最初のE2E起動失敗は制限外で解消した。アプリのテスト・品質チェックに未実行項目はない。調査記録の追加後は `npm run lint:markdown` もexit 0で確認した。

独立したread-onlyレビューで実装と回帰テストを確認し、指摘はなかった。初回検証時点では本番へのデプロイ、クラウド設定、契約、利用上限を変更していない。

## 本番反映の承認と準備

所有者が今回に限るPR #57のmerge・専用D1・サーバー秘密情報設定を明示的に許可し、Workers Freeのままであることを確認した。D1操作権限は所有者のブラウザ承認で追加した。

- 本番専用D1 `arimono-ai-usage` を作成し、既存 `0001_ai_usage.sql` を適用した。保存対象は既定の利用集計だけで、入力・回答は保存しない。
- `AI_USAGE_SECRET` をランダム生成し、長さ32文字以上を生成時に確認してProductionへ登録した。値は画面やGitへ出していない。
- `wrangler.jsonc` の `env.production` にだけD1・AI・`CLOUDFLARE_FREE_ONLY=true` を設定した。Groqは有効化しない。
- インストール済みWranglerの `unstable_readConfig()` とassertで、ProductionはD1が1個・Freeフラグtrue、local/PreviewはD1が0個・Freeフラグなしと確認した（exit 0）。

| コマンド | exit code | 結果 |
| --- | --- | --- |
| `wrangler d1 list --json` | 0 | 作成前のDBが0個であることを確認 |
| `wrangler d1 create arimono-ai-usage --location=apac --update-config=false` | 0 | 専用DB作成成功 |
| `wrangler d1 migrations apply AI_USAGE --remote --env production` | 0 | `0001_ai_usage.sql` が成功 |
| `wrangler pages secret put AI_USAGE_SECRET --project-name arimono-de-recipe` | 0 | Productionのsecret登録成功をAPIでも確認 |

秘密値やOAuth tokenは記録しない。Free契約は所有者による確認であり、利用制限の推定値だけで無課金を保証するものではない。
