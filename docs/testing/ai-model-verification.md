# AIモデル選択・利用制限の検証

確認日: 2026-10-17。Node.js 26.4.0、macOS、Playwrightの制御したAPI応答で検証。
実際のAIへ依頼文を送信せず、アカウント・課金・secret・remote DB・配信の設定は変更していない。

## コマンドと結果

| コマンド | 終了コード | 関連結果 |
| --- | --- | --- |
| `CI=1 ASDF_NODEJS_VERSION=26.4.0 npm run check` | 0 | format、lint、typecheck、build、unit、structure、E2Eの全段階を実行 |
| 同コマンド内の`npm run test:e2e` | 0 | 580 passed、0 failed、0 skipped、0 flaky、159.6秒 |
| `ASDF_NODEJS_VERSION=26.4.0 npm run audit:dependencies` | 0 | found 0 vulnerabilities |
| `ASDF_NODEJS_VERSION=24.18.0 npm run format:check` | 0 | 別のサポート対象Nodeでも整形・Markdown・YAML検査が成功 |
| 同Nodeの`npm run test:unit`と`npm run test:structure` | 各0 | SQLiteを含む単体テストと構造検査が成功 |
| `ASDF_NODEJS_VERSION=26.4.0 npm run format:check` | 0 | Codex残高の種類を確認したMarkdown追記を検査。runtime変更がないため、この追記だけのローカルE2E再実行は省略 |

E2Eの内訳はChromium 114、Pixel相当114、Firefox 88、WebKit 88、iPhone相当88、iPad相当88。
モデル選択の追加ケース18件を含む。モデル変更時の未送信、全文と選択IDの明示送信、
提供元表示、429後のコピー、利用不可モデルから自動で提供元を変えないことを確認する。

SQLiteで実migrationと同じ予約SQLを実行し、複数上限の原子的rollback、並行予約、
日付更新、IPv6 /64、秘密情報・信頼ヘッダー不足、失敗時の予約保持を確認する。
62,500のlifetime予約テストは任意のテスト単位であり、実際のクレジット換算・API利用の証明ではない。

最終ログはローカルの`/tmp/arimono-ai-final-check-3.log`、
機械可読結果は生成物の`playwright-report/results.json`。CIでも後者をartifactとして保存する。

## レビューと修正

調査・クライアントと安全性・サーバーを分けて、読み取り専用のサブエージェントが確認した。
実装者は次を修正し、再レビューと全体検証を行った。

- 期限切れキーの再利用による上限回避と、期限付きbucketのlifetime化を拒否する。回帰テストは修正前に失敗、修正後に成功。
- 確認できない旧CloudflareモデルとGroq Previewモデルを、現行の固定モデルへ変更する。
- 実際の生成依頼文がGroqの単発見積もりを超えていたため、枠とテンプレート余裕を見直す。推定値を公式保証のtoken上限とは説明しない。
- 人数stepperの「selectなし」検査を人数パネル内に限定し、追加したモデルselectと区別する。
- Safari系のnative selectが23pxになる問題を、明示的な46pxの高さ指定で修正する。6環境で44px以上の操作領域を検証する。
- 現行Cloudflareの`choices[].message.content`形式を受け取り、返すusageは数値の既知項目に限定する。
- Qwen3を非推論のLlama 3.3へ置換し、Gemmaの正式なthinking=falseを明示する。Groqはlowでも推論予算を使うため、本文が空・finish_reason=lengthなら失敗とする。Cloudflare/Groqのchoices形式の中断応答テストは修正前exit 1、修正後exit 0。終了理由のないnative応答の中断検知は保証しない。

最後の静的レビューでは、送信前予約・Free設定の必須化・秘密情報・古い応答の破棄について追加の修正必須事項はなかった。

SQLiteは[Node 22.13から追加フラグ不要](https://nodejs.org/download/release/latest-jod/docs/api/sqlite.html)。
既存HTML検査ツールのengine条件が22.22以上または24.8以上のため、
packageとlockfileの必要バージョン・開発手順をその範囲へ揃えた。依存のバージョンは変更していない。

## 画面の証拠と未実施範囲

[320pxのモデル選択画面](../media/ai-model-selection-mobile.png)と
[1280pxの画面](../media/ai-model-selection-desktop.png)をChromiumで確認した。
320pxで横方向のはみ出しがなく、選択欄の高さは46px。

実機Safari、OSのソフトウェアキーボード、実AIの品質・モデル可用性、実アカウントのFree契約、
remote D1、秘密情報、課金停止は未実施。料金を使う実API確認と配信を行っていないためである。
運営者は[有効化手順](../architecture/ai-provider-setup.md)で設定を確認する。
接続済みProアカウントの利用情報を読み取り専用で確認し、62,500はCodex用creditと判明した。
通常のPlatform API key課金へ転用できず、有効期限・自動補充設定・別のAPI残高の有無は未確認。
OpenAI連携には別のAPI残高、またはhosted appとして承認された本人認可経路の判断が必要で、実装・有効化はしていない。
