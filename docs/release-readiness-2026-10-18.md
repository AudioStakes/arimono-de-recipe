# 公開前の整合性レビュー — 2026-10-18

## 対象と結論

PR #55を#53へ統合し、[統合CI](https://github.com/AudioStakes/arimono-de-recipe/actions/runs/39092751520)の成功と独立レビューを確認して、#53をmainへマージした。基準コミットは`a69d6a58ad3977fee5b7898d6a0f9456cd7be56b`。
今回の改善はこのmainから分岐したPRで扱う。所有者の指示によりOpenAI連携は対象外として閉じた。

材料フォームと画面全体の追加見直し、最新の全体チェックは[フォームUIの検証記録](testing/form-ui-verification-2026-10-18.md)に記録する。本書の604件は追加見直し前の検証結果である。

依頼文の作成・コピー、任意の明示送信、モデル選択、送信前の利用制限という構成は整合している。
ただし、コードのマージを本番AIの有効化完了とは扱わない。新しいD1・secret・Free設定・配信は今回変更していない。

## 調査範囲

- 入力・候補値・材料の量と使い方・目的・人数・品数・非表示値と依頼文の対応。
- DOMに依存しない入力状態、コピー本文、AIの待機・失敗・古い応答、モデルと送信先の表示。
- キーボード、IME、focus、モーダル、狭幅・固定操作欄、Markdownと外部画像・リンクの境界。
- Functionの入力・出力・Origin・上限、Free設定、D1の原子的予約、HMAC集計と秘密情報の境界。
- 静的配信・CSP・解析の設定、導入・停止手順、README・用語・ADR・PRD・テスト対応表の一致。

画面・ドメイン担当と安全性・運用担当の読み取り専用サブエージェントで分担し、実装者が指摘を再現・修正した。確定した問題と、運用確認・仕様上の限界を分けて記録する。

## 修正した項目

P2は利用者の操作・公開運用に影響する不整合、P3は説明や保守時の誤解につながる不整合とする。

| ID | 優先度 | 確認した問題 | 改善・検証 |
| --- | --- | --- | --- |
| R01 | P2 | 条件サマリーの削除ボタンが再描画で消え、キーボードのfocusが失われる | 入力欄、閉じていればその項目または親の開閉ボタンへ戻す。材料・時間・閉じたNG欄・閉じた親の補足を6構成のE2Eで確認 |
| R02 | P2 | `AI` binding削除だけでは設定済みGroqが停止しない | 共通Free設定を無効化して再配信し、全モデル無効・POST拒否・コピー継続を確認する停止手順へ変更。missing/false両方でGroq設定済みでも上流呼び出し0件となる単体テストを追加 |
| R03 | P2 | 掲載の限定OAuth scopesではD1作成・migrationに必要な権限が不足 | `d1:write`を追加。同梱Wranglerのscope定義と照合。クラウドのログイン・DB作成は未実行 |
| R04 | P2 | Groqの「最大30日」に法令で延長が必要な場合の例外がない | 画面・利用説明・調査記録を[公式のデータ方針](https://console.groq.com/docs/your-data#system-reliability-and-abuse-monitoring)へ合わせた。ZDRが有効とは記載しない |
| R05 | P2 | SECURITYの送信先・回数制限説明がWorkers AI単独の時点のまま | Groq、入力を含まないmetadata、D1集計、接続元識別の限界と全AI停止手順を記載 |
| R06 | P2 | OpenAIを残高・認可方式の判断待ちとして残すと、不要な設定作業を再開し得る | ADRに所有者の2026-10-18の決定を追記し、README・設定・検証・agent notes・調査記録を同期。個人の残高調査は履歴に保持し、一般利用者向けのREADMEから外した |
| R07 | P3 | 品数「おまかせ」の用語説明が現行の既定1レシピと一致しない | `CONTEXT.md`を現行動作へ合わせた。品数の入力項目は省略し、既定の1レシピを依頼する。依頼文生成コード・出力規則は変更しない |
| R08 | P3 | PRD・参加手順にGroq/D1の承認範囲や、metadata GETと推論POSTの区別がない | ADR 0016への参照を追加し、入力・回答の保存禁止と利用制限集計の例外を区別。内部API・serverの責務も参加手順へ反映 |
| R09 | P3 | ブラウザー対応表からモデル選択が欠落し、利用制限の確認範囲が不明 | 実行設定に合わせ、6構成のモデル選択・削除focusとSQLite・全AI停止の確認範囲を記載 |
| R10 | P3 | 過去の本番確認が現在のモデル・設定の確認済み根拠に見える | 最新レビューへの入口をREADMEと公開準備レビューへ追加。2026-10-16の本番記録は当時の検証履歴として保持 |

## レビューと検証

R01は修正前の録画操作と追加E2Eでfocus復帰の失敗を再現した。回帰テストは各項目の入力条件が削除されること、他の材料が残ること、AIへのPOSTが0件であることも確認する。
固定プロンプト内の説明例に現れる材料名と、利用者が指定した入力節は区別して検査する。

| コマンド・確認 | 終了コード | 結果 |
| --- | ---: | --- |
| `CI=1 ASDF_NODEJS_VERSION=26.4.0 npm run check` | 0 | format・lint・typecheck・build・unit・structure・全E2Eが成功 |
| 同コマンド内の`npm run test:e2e` | 0 | 604 passed、失敗・skip・flaky各0。Chromium/Pixel各118、Firefox/WebKit/iPhone/iPad各92 |
| `ASDF_NODEJS_VERSION=26.4.0 npm run test:e2e -- --grep '条件サマリーの'` | 0 | 追加4ケース×6構成、24 passed |
| `ASDF_NODEJS_VERSION=26.4.0 npm run test:unit` | 0 | 停止設定の2ケースを含む単体テストが成功 |
| `WRANGLER_SEND_METRICS=false ASDF_NODEJS_VERSION=26.4.0 npm exec wrangler -- pages functions build functions --outfile /tmp/arimono-release-pages-function.js` | 0 | `Compiled Worker successfully`。配信・実AI呼び出しなし |
| 録画runnerの1280×900、390×844と修正前後のfocus操作 | 修正前1、修正後各0 | 修正前のQAはfocus assertionで失敗。修正後のQA・録画・cleanupは全てpassed |
| 動画検査 | 各0 | ffprobeで寸法・正の長さ・byte数、ffmpegのdecodeとフレーム・画面の目視を確認 |

全体チェックのログはローカルの`/tmp/arimono-release-final-check.log`、機械可読結果は`playwright-report/results.json`。依存バージョンは変更していない。依存監査は統合済みmainのCIで0件であり、この改善PRのCIでも実行する。

録画と同じ実行の画像・結果は`/tmp/arimono-release-final-desktop/`、`/tmp/arimono-release-final-mobile/`、`/tmp/arimono-chip-focus-after/`の`README.md`と`result.json`に記録した。修正前は`/tmp/arimono-chip-focus-before/`。通常操作の2録画では実Clipboard APIでコピー全文の一致を確認し、AIへのPOST・pageerrorは0。静的プレビューのためモデル情報は確認不可の案内となり、本番の提供元の可用性を示すものではない。録画を公開リポジトリへアップロードしていない。

修正後は別のfresh reviewerが全差分を確認し、安全性担当も5指摘の解消を再確認した。重大・重要・軽微の追加指摘はなかった。安全性担当の提案に従い、停止手順は新規受付が対象であり、開始済み推論の取消や予約返却は保証しないことも明記した。レビュアーは読み取り専用で、独立したテスト再実行は行っていない。

実AI・実機OS・本番D1・秘密情報・契約・配信は次節の範囲として未実施。ローカル検証はNode.js 26.4.0とPlaywrightのエミュレーションを使い、CIはNode.js 22を使う。

## 本番AIの有効化前に必要な運用確認

| 項目 | 完了条件 | 今回の状態 |
| --- | --- | --- |
| 無料契約 | Cloudflare/GroqのFree契約、支払い・upgrade・自動補充の扱いを所有者が確認 | 未確認。アプリのフラグは契約の自動検証ではない |
| D1とsecret | 専用DBへmigrationを適用し、Productionにbinding・HMAC secret・Free設定を登録 | 未実行。設定不足のAIは安全側に停止する |
| Preview・旧URL | 本番の枠やDBをPreviewと共有せず、制限導入前の旧deploymentから推論できない | 未確認。旧deploymentの削除・アカウント設定は行っていない |
| 再配信後の確認 | [公開手順](deployment.md)に沿ってモデル情報・入力・全文コピー・上限・停止・CSP・解析を実環境で確認 | 今回は未デプロイ。静的プレビューとfakeのAIだけで確認 |
| 実モデルの品質 | ダミーの材料で実回答・欠落・日本語・調理条件を確認 | 実AI送信なし。自動照合や調理安全の保証は追加しない |
| 実機の操作 | 実際のiOS/Safari・ソフトウェアキーボードで入力・コピー・focusを確認 | エミュレーションとは別の未確認項目 |

手順の詳細は[AI・D1設定](architecture/ai-provider-setup.md)と[公開・全AI停止](deployment.md)を基準とする。過去の本番テストの成功だけで、この表を完了扱いにしない。

## 残る仕様上の限界

- ログインなしのため厳密な一人単位の上限ではない。NATでは枠を共有し、VPN等では接続元制限を回避され得る。全体・提供元の上限を併用する。
- token/neuronの予約は見積もりであり、無課金の最終境界は提供元のFree契約に依存する。同じアカウントを使う別アプリの消費は制御しない。
- AI回答の材料・NG条件・加熱の正しさや、終了理由のない応答が完結していることは保証しない。
- ソース・画像の再利用ライセンスは`UNLICENSED`のまま。今回、権利や公開設定を変更していない。
