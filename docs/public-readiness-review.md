# 公開準備レビュー

調査日: 2026-09-29。対象: `main` の `b0f6d9c6836505d617e051a730a5be07d15bf568` と、この公開準備PRの変更。

## 結論

依頼文コピーを中心とする構成、同一オリジンのAI経路、テストの土台は整っています。ただし、他の人がコードを再利用するためのライセンスと、公開AIの連続呼び出しに対する運用上の制限が未整備です。リポジトリをpublicにすることと、第三者の再利用を許諾すること、AIを誰でも呼べる状態で公開運用することは、それぞれ確認が必要です。

このPRでは導入・参加・公開手順を整え、実際に確認できた入力検証・待機・キーボード操作の問題を修正しました。所有者の判断が必要な設定や、実環境での出力品質は以下に分けて記載します。

## 調査範囲と限界

- 現行ツリー128ファイルのコード・設定・テスト・ドキュメント・画像を確認。依頼文生成、候補生成、材料指定、コピー、モバイル画面、アクセシビリティ、通信・表示・エラー処理、ビルド・CIを対象にした。
- `main` に到達する82コミットと12ブランチの先端を確認。取得したブランチの先端に、この履歴の外のコミットはなかった。
- 現行のテキストと履歴の716テキスト差分を、GitHubトークン、AWSアクセスキー、一般的なAIキー、秘密鍵、長い秘密情報の代入パターンで検査。差分が省略された4つのリネーム先テキストも取得して補完した。これらのパターンに該当する秘密情報は検出しなかった。
- 過去のバイナリ画像、削除済みの非到達オブジェクト、GitHubの非公開データ、外部サービスの保存データまでは検査していない。秘密情報が一切ないという保証ではない。現行WebPにEXIFキーはなかったが、画像の著作権や写り込みの確認とは別である。
- リポジトリはprivate、説明・homepage・ライセンス情報は未設定、`main` の `protected` はfalseだった。Rulesetsの読み取りは現在のprivateリポジトリのプラン制約で403となり、追加設定は確認できなかった。設定は変更していない。
- Cloudflareの本番設定、請求情報、実モデル、実機Safari、Private vulnerability reportingの有効化状態は未確認。Cloudflareの推論を実際に呼び出すテストは行っていない。

## 優先度

P0: 対象の公開・利用形態では先に解決したい項目。P1: 他の人が安全に試し、開発を継続するための重要項目。P2: 初回公開後の改善や、利用範囲が広がった時の対応。

### このPRで改善した項目

| ID | 優先度 | 調査時の問題・影響 | 改善と証拠 |
|---|---|---|---|
| 01 | P0 | AI依頼の材料・要望・NG項目・補足が上限で切られ、入力した条件が黙って落ちる。NG9件なら9件目を送らない。必須材料7件以上も候補の材料6項目上限と両立しない。 | `ai-recipe-request.ts` で送信前に上限を検証し、条件を減らすかコピーを使う案内を表示。独立レビューの修正で、目的・品数の説明を補足とともに保持し、API側も文字数超過を切り捨てず拒否する。必須・使い切り指定は合計6件までとし、API入力でも検証。NG9件・必須7件でAPI呼び出し0回、コピーに条件が残るE2Eを追加。 |
| 02 | P0 | 材料の部分一致で「塩漬け豚肉」を「塩」、「油揚げ」を「油」、「豆腐ハンバーグ」を「豆腐」として許可できる。買い足しなしの検証を迂回する。 | `ai-recipe-schema.ts` を材料名と限定した分量表記の照合へ変更。独立レビューの修正で全角の分量・半丁・括弧で補記した重量も扱う。別食材を許可しない回帰テストを追加。 |
| 03 | P0 | NG食材の検証対象に調理手順がなく、材料一覧から除外しても手順で使用できる。 | `steps` もNG照合の対象にし、手順にNG食材が出る応答を拒否するテストを追加。独立レビューの修正で長い手順や材料名を先に切り捨てず、上限超過の応答全体を拒否する。別名等の限界は項目28を参照。 |
| 04 | P1 | 「必ず使う」材料をAIが `use` に申告するだけで通り、実際の材料一覧 `ing` に含まれない応答を許可する。 | 必須・使い切り材料が `ing` にもあることを検証。独立レビューの修正で、おまかせ指定でも少なくとも1件の入力材料が `ing` に必要。自己申告だけでは通らないテストを追加。 |
| 05 | P1 | 固定の「味の調整」で、NGに指定した塩・しょうゆ・だしを再び勧める。 | 詳細・調理ビューへNG指定を渡し、該当する味付けの案内を除外。醤油・出汁表記のユニットテストと両画面のE2Eを追加。 |
| 06 | P1 | 入力材料名は80文字、応答の材料名は48文字で切られ、長い名前の照合が一致しない。 | 応答の文字数を80へ揃えた。80文字の材料名を保持・照合するテストを追加。 |
| 07 | P1 | AI通信に時間制限がなく、応答本文の受信中にも待機し続ける。 | fetchと本文読取を30秒で中断。タイムアウトの案内・コピー経路を維持し、待機とタイマー解放をテスト。サーバーの推論停止や課金取消を保証する機能ではない。 |
| 08 | P1 | 外部送信について、操作する画面に説明がない。 | ヘッダー付近にCloudflareへの明示送信とコピーの扱いを表示し、候補ボタンから `aria-describedby` で関連付け。READMEにも処理経路を記載。 |
| 09 | P1 | API応答に明示的なキャッシュ禁止・MIME保護がない。 | 成功・エラーに `no-store` と `nosniff` を付与しテスト。Pagesの実行環境でも応答を確認。 |
| 10 | P1 | `text/application/json-fake` のような偽のContent-Typeも部分一致で受理。本文ストリームの読取エラーは未処理。 | JSONのメディアタイプを正確に照合。読取失敗を機密情報のない400応答に変換し、上限超過ではreaderをキャンセル。独立レビューの修正でキャンセル完了を待たず413を返し、成功・失敗ともreaderを解放する。回帰テストを追加。 |
| 11 | P1 | `npm audit` が11件（high 8 / moderate 2 / low 1）の開発用依存の脆弱性を報告。 | Vitest・Wranglerと関連依存を同じメジャー系で更新。PostCSS・nanoid・brace-expansionも更新。最終auditは0件。型定義はCIのNode 22へ揃え、未使用のWorkers型パッケージを除去。 |
| 12 | P1 | Biomeの対象に `functions/**/*.ts` がなく、APIコードが整形・lint対象外。 | APIと `public/_routes.json` を検査対象へ追加。lint・整形確認を実行。 |
| 13 | P1 | Node.jsの前提がなく、第三者が異なるバージョンで起動しやすい。 | `engines`、`.nvmrc`、READMEを追加。lockfileを使う `npm ci` を導入手順に明記。追加のRTK CLIを必須にしない。 |
| 14 | P1 | READMEに具体的な使い方、AI不要の試し方、制約、検証、問い合わせ、ライセンス状態が不足。 | 初回起動からコピー、任意のAI設定、入力上限、データの扱い、問い合わせまで再構成。 |
| 15 | P1 | 自分で公開する際のビルド、Production/Previewのバインディング、費用と停止手順が曖昧。 | `docs/deployment.md` を追加。AIあり・なしの確認方法、設定と運用上の制限を記載。 |
| 16 | P1 | Functionの実行対象が成果物に明示されていない。 | `_routes.json` を追加し `/api/recipe` だけに限定。静的ファイルへのFunction実行を避ける。 |
| 17 | P1 | 静的配信でセキュリティヘッダーが未定義。 | Pages用 `_headers` にCSP、フレーム埋込禁止、MIME保護、Referer抑制を追加。ビルド済み画面でコピー・モバイル操作・エラー経路とCSP違反0件を確認。 |
| 18 | P1 | PlaywrightのHTML reporterがなく、CIがアップロードするレポートを生成しない。再試行なしの `on-first-retry` では失敗時traceも出ない。 | HTMLレポートと `retain-on-failure` を設定。CIはレポートとtrace等を7日保存、15分制限と旧実行のキャンセル、2workerで実行。 |
| 19 | P1 | 依存更新の自動提案がない。Actionsが可変タグを参照する。 | npm/ActionsのDependabotを追加。既存のActionsを確認済みのコミットSHAに固定。 |
| 20 | P1 | 一般利用者向けの不具合・改善案フォーム、開発参加の案内、非公開の脆弱性報告案内がない。 | Issueフォーム、CONTRIBUTING、SECURITYを追加。有効化が必要な報告設定は項目26に残した。 |
| 21 | P1 | 調理タブにARIAはあるが、左右矢印/Home/Endによる操作がなく、Tabでパネルに入れない。 | キーボード操作とパネルfocusを実装し、デスクトップ・モバイル相当のE2Eを追加。 |
| 22 | P2 | ADR/Codex文書の旧ボタン名と全文送信の記載が、現在の構造化候補依頼と食い違う。 | 現行ボタン名と送信内容を補足・修正。過去のADRは履歴として残し、ADR 0012に実装上の補足を追加。 |
| 23 | P2 | 検索向けdescriptionがなく、使わない画像をpreloadしている。JavaScript無効時は案内がない。 | description/OG説明/noscriptを追加し、不要なpreloadを除去。実在を確認していないデモURLは追加していない。 |

### 未解決・所有者の判断が必要な項目

| ID | 優先度 | 現状と根拠 | 次に行うこと・完了条件 |
|---|---|---|---|
| 24 | P0（コード再利用を許諾する場合） | `LICENSE` がなく、GitHubのlicense情報もない。publicにするだけではコードの改変・再配布の一般的な許諾は明示されない。 | 所有者がMIT/Apache-2.0等、意図する条件を選び `LICENSE`、package metadata、READMEを更新する。このPRは選択せず、`UNLICENSED` と未設定状態を明示した。 |
| 25 | P0（公開AIを運用する場合） | `/api/recipe` に認証・回数制限がない。Originを設定した直接HTTP送信は可能。本文とトークン上限だけではAIの連続呼び出しや費用増加を防げない。 | Cloudflareで適用可能なRate limiting/WAFを設定し、本番・Preview・代替ドメインで確認。使用量の監視・停止方法も決める。コードへ新しい保存・認証・別APIは追加しなかった。 |
| 26 | P1 | Security案内を追加したが、GitHubのPrivate vulnerability reporting有効化状態と連絡方法の運用は未確認。 | 所有者が非公開報告を有効化し、報告先を実際に利用できるか確認する。回答期限は合意前に約束しない。 |
| 27 | P1 | 実モデルの応答品質はモックのテストでは確認できない。候補は材料6項目・手順3項目までで、分量や加熱条件は完全でない。 | ダミー入力で材料数、必須・使い切り、時間、器具、人数、NG、自由記述を組み合わせて本番確認する。短い候補の位置付けはREADMEに記載。完全なレシピを目指す場合は別の設計変更として検討する。 |
| 28 | P1 | NG検証は文字列照合。醤油/しょうゆ、卵/マヨネーズ、乳/バター等を包括的に関連付ける原料・別名モデルはない。味の調整の限定的な別名対応はアレルギー対応を意味しない。 | 「参考候補」であることを明記し、アレルギー対応を謳わない。包括的な対応を行う場合は原料・別名データと検証方針を別途設計する。READMEに現状の限界を記載済み。 |
| 29 | P1 | 画像の権利・生成元・商標の扱い、Git履歴・Issue/PR内の個人情報はコード検査だけでは確定できない。コミットには作者名・メールアドレスも含まれる。 | `public/arimono.webp` と過去画像の権利を所有者が確認。公開で見える作者情報、Issue/PR、スクリーンショット等を確認する。秘密情報があれば履歴削除だけでなく失効・再発行を先に行う。 |
| 30 | P1 | `main` はprotected=false。Rulesetsの追加情報はプラン制約で読み取れなかった。文書の「人間がマージ」は設定による強制とは限らない。 | public化後にCI必須・レビュー・直接pushの制限等を設定し、実際の権限で確認する。repository settings/permissionsはこのPRで変更していない。 |
| 31 | P2 | GitHubの説明・homepageが空で、READMEに公開デモや画面例がない。コードを動かす前に用途を把握しづらい。 | 公開URLを決めて動作確認後、GitHubの説明・topics・homepage、READMEにURLと実画面を追加する。架空の公開先は作らない。 |
| 32 | P2 | ブラウザテストはChromiumとPixel 7相当のエミュレーションのみ。 | 公開対象に応じSafari/iOS、Firefox、実機IME、スクリーンリーダー、拡大表示を確認する。現行テストがこれらの確認を代替すると記載しない。 |
| 33 | P2 | `recipe-decision/` の状態モデルと現在の `aiRecipe` 画面状態等に重複があり、候補の型・上限の一部もFunctionで再定義される。 | 対象の機能変更時に責務を整理し、上限を共有する。今回の公開準備に大規模なリファクタリングを混ぜない。 |
| 34 | P2 | versionは0.1.0で、利用者向けのリリース・変更履歴・対応ブラウザの方針がない。入力は永続保存されない。 | 初回公開のタグ・短い変更履歴・サポート範囲を決める。再読み込みで入力が消える現状をREADMEに記載済み。保存機能は別途プライバシー判断を要する。 |
| 35 | P1（配布物を決める際） | lockfileの開発用依存にはMIT/ApacheだけでなくMPL-2.0、LGPL-3.0-or-later等のメタデータもある。画像の権利確認とは別の論点。 | ソースのみ、ビルド済みサイト、開発環境ごとの同梱物を把握し、必要なライセンス表示等を確認する。開発用依存の存在だけでアプリ本体のライセンスを断定しない。 |

## 良い点・今回維持したこと

- `buildPrompt(data)` にコピー用の依頼文生成を集約し、未指定項目を出さないルールにテストがある。
- アプリ内AIはブラウザ→同一オリジン `/api/recipe`→Cloudflare Workers AIだけ。クライアントにトークンやプロバイダーSDKを置かない。
- AIやユーザーの内容はテキストとして表示する。AIのHTMLをそのまま挿入しない。
- 本文のストリームサイズ制限、Origin検証、AI出力のスキーマと材料制約の検証、一般化したエラー応答がある。
- 入力変更後の古いAI応答を表示しない。コピーは候補生成前・中・後・失敗時に利用できる。
- モバイル、IME、自由入力、コピー、候補選択、調理ビュー、エラー経路にE2Eの土台がある。テストを削除・skipして通す変更は行っていない。
- 静的Viteビルド、npm、既存API・ホスティング方式、保存なし・ログインなし・解析なしの構成を維持した。

## 初回実装時の検証記録

以下はこのPRの初回実装者が記録した履歴です。2026-10-02の独立レビューで実行した検証は末尾の追記に分けて記録し、この履歴を新しいheadの検証結果として扱いません。

| 確認 | 結果 |
|---|---|
| `npm run format` / `format:check` / `lint` / `typecheck` / `build` | 終了コード0。Node.js 24.19.0 / npm 11.9.0で確認。 |
| `npx vitest run tests/unit tests/structure --reporter=default` | 終了コード0。ユニット139件・構造15件、合計154件が成功。 |
| `npm run check`（GitHub Actions） | 終了コード0。[標準CI](https://github.com/AudioStakes/arimono-de-recipe/actions/runs/36654321661)でNode.js 22.23.2と標準Chromiumを使用。ユニット139件・構造15件・E2E100件、計254件が成功。必須材料上限の追加テストも含む。 |
| `npm audit --json` | 終了コード0。脆弱性11件→0件。開発用依存に関する検査時点の結果であり、将来の無脆弱性を保証しない。 |
| `npx wrangler pages functions build --outdir /tmp/arimono-function-build` | 終了コード0。Functionのコンパイル成功。 |
| `npx wrangler pages dev dist --ip 127.0.0.1 --port 8788 --compatibility-date 2026-09-29` とHTTP/Playwright smoke | 静的配信200、CSP等のヘッダー、API GET 405、AI未設定500、APIのno-storeを確認。コピーだけのAPI呼び出し0回、候補要求で1回、エラー時のコピー・モバイル操作が成功。CSP違反・JavaScriptエラー0件。 |
| `git diff --check` / 秘密情報パターン検査 | 差分の空白エラーなし。調査したテキストで該当パターンの検出なし。 |

ローカルのPlaywright標準ブラウザ（Chromium 148）はCDNダウンロードが破損して取得できなかったため、作業環境だけにChromium 153を用意し、一時configで先行修正の98件を実行した。これはリポジトリの依存やCI設定には追加していない。追加修正を含む100件のE2Eは、CIで標準の `npx playwright install --with-deps chromium` と `npm run check` を使い、成功を確認した。CIのHTMLレポートも保存される。

未実施: 実Workers AIの呼び出し・品質測定、Cloudflareの本番設定・料金制御、Safari/Firefox実機、履歴のバイナリと非到達オブジェクト、非公開脆弱性報告の実送信。アカウント設定・費用・機密データ・第三者への送信を伴うものは、所有者が公開前に確認する。

## 公開前の実行順

1. 所有者がコード・画像の利用条件を確認してライセンスを決め、公開される履歴・Issue/PRの内容を確認する。
2. このDraft PRをレビューし、CIを確認して人間がマージする。
3. AIを公開する場合は、Cloudflareの利用制限・監視・停止手順と本番の動作を確認する。コピーだけの公開ならAIの設定は不要。
4. リポジトリをpublicへ変更した後に、ブランチ保護・非公開脆弱性報告と、説明・デモURLを設定する。
5. ダミー入力で公開URLのコピー・候補生成・エラー経路・モバイルを確認し、初回リリースを記録する。

## 参照した公式資料

- [GitHub: Licensing a repository](https://docs.github.com/en/repositories/managing-your-repositorys-settings-and-features/customizing-your-repository/licensing-a-repository)
- [Cloudflare Pages: Bindings](https://developers.cloudflare.com/pages/functions/bindings/)
- [Cloudflare Pages: Function routing](https://developers.cloudflare.com/pages/functions/routing/)
- [Cloudflare Pages: Headers](https://developers.cloudflare.com/pages/configuration/headers/)
- [Cloudflare Workers AI: Pricing](https://developers.cloudflare.com/workers-ai/platform/pricing/)
- [Cloudflare WAF: Rate limiting rules](https://developers.cloudflare.com/waf/rate-limiting-rules/)

クラウドの仕様・料金・プラン対応は変更されるため、公開作業時に公式情報で再確認する。

## 2026-10-02 独立レビューの追記

開始時点: base `b0f6d9c6836505d617e051a730a5be07d15bf568`、head `dbe218d67131f1df75627facc133cabddd79fd22`、Draft PR #29。開始時点のCI成功は確認したが、レビューの結論の代わりには用いていない。

### 範囲

- 初期PRの変更35ファイルを確認。AGENTS、README、CONTEXT、関連ADR、PRD、UI境界、Codexルール、UXテスト表、PR本文と公開準備レビューを取得した。
- 差分の周辺として入力の読取・IME・材料指定・状態更新・コピー・候補表示・API検証・共有型・依存lockfile・Pagesルーティング・CSP・CIと関連テストを確認した。
- このセッションにはローカルのシェル・Node・ブラウザ実行機能がない。GitHubから取得した関数本体の型注釈を除いた限定的なV8再現と、既存GitHub Actionsによる検証を区別している。
- 実Workers AI、本番Pages、料金・制限、Safari/Firefox実機、実機IME、スクリーンリーダー、画像の権利・全Git履歴の秘密情報は独立に再検証していない。初回記録のaudit・Pages smoke・履歴検査を今回実行したと扱わない。

### 確認した問題と修正

位置はレビュー開始時点のheadの関数・設定を示す。P1は利用結果や条件保持に影響する不具合、P2は特定経路の不具合・導入保守上の問題。

| ID | 優先度 | 位置・発生条件・影響 | 由来と根拠 | 対応 |
|---|---|---|---|---|
| R1 | P1 | `src/ai-recipe-schema.ts:normalizeText/parseString/parseStringList`。APIへ81文字の材料・NG、181文字の補足等を送ると、上限まで切った条件で受理する。 | PR以前から存在。取得した関数本体で切り捨てを再現し、APIの上限超過8種と上限ちょうど8種の回帰テストを追加。 | 超過を拒否し、AIを呼ばない。空白の正規化は維持。 |
| R2 | P1 | 同ファイルの応答parser。手順の61文字目以降のNGや、長い材料名の後半を検証前に除去するため、途中までの内容で成功できる。 | 切り捨て自体は既存。今回の手順NG検証でも残っていた穴。60文字の後に「にんにくを加える」を置くFunction境界テストを追加。 | 応答文字数超過を拒否し、短縮した内容で成功しない。 |
| R3 | P1 | `src/ai-recipe-request.ts:buildNotes/buildAiRecipeCandidateRequest`。カレーを作る指定とカレーに合わせる指定が同じJSONとなり、品数も送らない。 | PR以前から存在。入力reader・コピー本文では区別されるがAIアダプタでは失われる。ユニットと実フォーム操作のE2Eを追加。 | 既存のnotesに選択した目的と品数の説明を保持。補足との合計180文字を送信前に検証し、超過時もコピーを維持。 |
| R4 | P1 | `src/ai-recipe-schema.ts:mentionsListItem/ingredientAmountPattern`。「豆腐（半丁）」「豆腐1丁（300g）」「豆腐２００ｇ」を未入力材料として拒否する。 | 今回の照合変更による回帰。ソース抽出のV8再現と分量表記の回帰テスト。 | 比較時の全角正規化と限定した分量文法を追加。「豆腐ハンバーグ」「豆腐（豚肉）」等は引き続き拒否。 |
| R10 | P1 | 同ファイルの `parseMaterialInputs`。同名材料の後続指定が必須・使い切り・異なる分量でも、最初の指定だけを残して受理する。 | PR以前から存在。baseの実装にも同じ処理がある。異なる指定3種のAPI回帰テストと、同一指定の正規化テストを追加。 | 矛盾する重複指定はAI呼出し前に拒否し、同一内容だけを正規化する。 |
| R5 | P2 | 同ファイルの `validateAiRecipeCandidatesForRequest`。おまかせの豆腐をuseで申告し、実際のingを塩・水だけにしても通る。 | PR以前から存在。必須材料だけを実材料と照合する実装の周辺で確認。 | おまかせでも入力材料が実材料一覧に少なくとも1件必要とし、回帰テストを追加。 |
| R6 | P2 | `functions/api/recipe.ts:readRequestText`。32,000バイト超過後のstream.cancelが完了しないと413応答も返らない。readerも解放しない。 | 取消完了待ちは今回追加、lock解放不足は既存。解決しないcancelを持つ実ReadableStreamでFunctionを検証。 | cancelの失敗を処理しつつ完了を待たず拒否。finallyでreaderを解放する。 |
| R7 | P2 | `src/output-panel.ts:copyText/copyPrompt`。Clipboard API拒否に加えexecCommandが例外を投げると、手動コピーの案内が出ず一時textareaも残り得る。 | PR以前から存在。取得したcopyPrompt本体のV8再現で例外を確認。デスクトップ・モバイルとClipboard API未対応の3経路で例外を発生させるE2Eを追加。 | 代替操作の例外を処理して案内し、一時要素をfinallyで除去。外部送信0回も検証。 |
| R8 | P2 | `functions/api/recipe.ts:buildCandidateResponseFormat`。allowShopping=trueの材料名schemaだけ48文字のままで、更新後の入力・応答80文字と食い違う。 | このPRで応答parserを80文字にした際の更新漏れ。現在のUIから買い足しを有効にする操作はないが、既存API経路にはある。 | schemaの最大文字数を共有上限へ揃え、Workers AIに渡す値をFunctionテストで確認。 |
| R9 | P2 | `CONTRIBUTING.md:コードの場所`。実在しないsrc/recipe-items.tsとsrc/app-state.tsを導入参加者へ案内する。 | 今回追加した文書。最新ツリーと突合して不存在を確認。 | 実在するcandidate-values、types、ui等へ修正。 |

CI失敗時のGitHub形式のログだけでは整形差分が見えなかったため、失敗時に通常形式のBiome診断を追加した。元の `npm run check` と終了コードを維持し、skip・テスト弱体化・品質ゲート緩和はしていない。

### 検証の記録

回帰テストを先に既存PRへ追加してから製品コードを修正する。追加テストの初期CIは整形エラーで停止したため、その実行を「不具合の回帰テスト失敗」とは数えない。整形を修正した後のCIと、修正後の検証結果を別に記録する。

- 修正前の回帰確認: head `1797e49c96ae671ae2df258f094df8a59c5a38b9` の[CI](https://github.com/AudioStakes/arimono-de-recipe/actions/runs/36959181475)で `npm run check` は終了コード1。整形・lint・型検査・ビルドは成功し、追加ユニット回帰テスト23件が期待どおり失敗した。構造・E2Eは先行するユニット失敗により未実行。
- 重複指定の追加後: head `a54c7a3490e2b63613256c9eea1e31c0885dec42` の[CI](https://github.com/AudioStakes/arimono-de-recipe/actions/runs/36960139556)も整形・lint・型検査・ビルドを通り、ユニット回帰26件が失敗（終了コード1）。同一条件の重複など正常系は失敗していない。構造・E2Eはユニット失敗により未実行。
- 修正コミット: `9afc8de074a29cfbacf40ef6620b0f0ff4ce80bf`。上記10項目を修正し、[対応するCI](https://github.com/AudioStakes/arimono-de-recipe/actions/runs/36960288541)は成功した。
- このCIの環境はUbuntu / Node.js 22.23.3 / npm 10.9.9 / Playwright標準Chromium。以下の終了コードはこのコミットで確認した結果であり、初回実装者の結果の転記ではない。

| 実行したコマンド | 終了コード | 確認結果 |
|---|---:|---|
| `npm ci` | 0 | lockfileを用いた新しいCI環境の依存導入が成功。 |
| `npx playwright install --with-deps chromium` | 0 | CI指定のブラウザと必要な依存を導入。 |
| `npm run check` | 0 | 整形、lint、型検査、ビルド、ユニット、構造、E2Eを順に完了。 |
| `npm run format:check` / `npm run lint` / `npm run typecheck` / `npm run build` | 各0 | check内の前半の品質ゲートが成功。 |
| `npm run test:unit` / `npm run test:structure` / `npm run test:e2e` | 各0 | check内で全スイートが終了し、回帰テストを含め失敗なし。 |

追加したテストはユニット41件、E2E8件（4シナリオを2プロジェクトで実行）。既存の成功時ログを省略するreporterを維持しているため、今回のCIログには成功件数の総計は出ない。合計件数の過去記録を新しい実行結果として転記せず、各コマンドの成功と追加したケース数を記録する。既存テストは削除・変更・skipしていない。

E2Eは実フォームから目的・品数を選んで送信データを確認し、上限で送信0回とコピー本文の条件保持を確認した。コピーAPI拒否・代替コピー例外・Clipboard API未対応を操作で再現し、エラー案内、JavaScript例外なし、一時textareaの解放、外部送信0回を確認した。[HTMLレポートのartifact](https://github.com/AudioStakes/arimono-de-recipe/actions/runs/36960288541/artifacts/11207816585)はアップロード成功し、保持期限は7日。

関連文書7ファイルのローカルリンク14件を取得したGitツリーと突合し、欠落0件だった（限定的なJavaScript検査であり、shellコマンドの実行ではない）。`npm audit` の独立再実行、WranglerのFunction build/Pages smoke、Node 24での実行、実AIの呼出しは今回行っていない。FunctionはTypeScript検査とモックのFunctionテスト、画面はViteを起動する既存E2Eで確認した。

### 追加したコミット

既存headの履歴を引き継ぎ、各push前にリモートheadを確認してfast-forwardで追加した。force pushや履歴の書換えはしていない。

| SHA | 内容 |
|---|---|
| [`59367e87de6ab3b207d60db19a84a3e868a0e25e`](https://github.com/AudioStakes/arimono-de-recipe/commit/59367e87de6ab3b207d60db19a84a3e868a0e25e) | 入力・応答・条件保持・streamの回帰テストを追加 |
| [`457d973c504de120bbbf927b4e4cf90a9739c3bb`](https://github.com/AudioStakes/arimono-de-recipe/commit/457d973c504de120bbbf927b4e4cf90a9739c3bb) | 回帰fixtureのlint・整形を修正 |
| [`d0e7d3705318321a7539d78baff18405535bb58a`](https://github.com/AudioStakes/arimono-de-recipe/commit/d0e7d3705318321a7539d78baff18405535bb58a) | 表形式テストの整形を修正 |
| [`587f908c97ab5b641e15bf76f963dca0e19ea6ca`](https://github.com/AudioStakes/arimono-de-recipe/commit/587f908c97ab5b641e15bf76f963dca0e19ea6ca) | コピー例外・実フォーム条件保持のE2E、AI schema回帰を追加 |
| [`89777c02d31171cc1cb31ddbba0a4b1431197086`](https://github.com/AudioStakes/arimono-de-recipe/commit/89777c02d31171cc1cb31ddbba0a4b1431197086) | CI失敗時の詳細Biome診断を追加（元の品質ゲートは維持） |
| [`1797e49c96ae671ae2df258f094df8a59c5a38b9`](https://github.com/AudioStakes/arimono-de-recipe/commit/1797e49c96ae671ae2df258f094df8a59c5a38b9) | CI診断に基づき回帰テストを整形し、23件の不具合を再現 |
| [`47d005d67fa100cd51ccd137a979792afa9fb34e`](https://github.com/AudioStakes/arimono-de-recipe/commit/47d005d67fa100cd51ccd137a979792afa9fb34e) | 同名材料の矛盾する指定・同一指定の回帰を追加 |
| [`f295049a5ef0242b32509df0756749afb3a05d0d`](https://github.com/AudioStakes/arimono-de-recipe/commit/f295049a5ef0242b32509df0756749afb3a05d0d) | Clipboard API未対応時の一時要素解放の回帰を追加 |
| [`a54c7a3490e2b63613256c9eea1e31c0885dec42`](https://github.com/AudioStakes/arimono-de-recipe/commit/a54c7a3490e2b63613256c9eea1e31c0885dec42) | 拡張したE2Eを整形し、ユニット26件の不具合を再現 |
| [`9afc8de074a29cfbacf40ef6620b0f0ff4ce80bf`](https://github.com/AudioStakes/arimono-de-recipe/commit/9afc8de074a29cfbacf40ef6620b0f0ff4ce80bf) | 10項目の最小修正、README・貢献手順・独立レビューの更新 |

この検証記録を確定する後続の文書コミットとそのCIは、PR本文に記録する。

### 残る判断とリスク

初回レビューの項目24〜35は今回の修正だけでは完了しない。所有者はライセンス、画像・公開履歴、非公開脆弱性報告先、ブランチ保護、公開先とサポート範囲を決める。AIを公開運用する場合はProduction/Preview/代替ドメインの呼出し制限、使用量監視と停止手順を設定・確認する。Origin検証を認証や費用制限として扱わない。今回の独立確認でもmainのbranch APIはprotected=falseだった。

文字列検証は原料・別名・交差接触や加熱の安全性を判定しない。目的・品数を送信できることはモデルが遵守する証明ではなく、使い切り量・器具・時間・複数品の出力品質は未確認。クライアントの30秒中断は推論停止や課金取消を保証しない。新しい認証・保存・解析・外部送信・AI提供元は追加していない。

## 2026-10-04 マージ後の独立レビュー

### 対象と進め方

開始時にリモートを取得し、最新 `origin/main` は `df307d826970cb33764d47ef457811913502e9da` だった。PR #29のマージコミットで、親はbase `b0f6d9c6836505d617e051a730a5be07d15bf568` と最終head `18262efc1bb1e8f0ed0d27ab7f29a04f851463f7`。後続のmain変更はなかった。GitHub CLIでPR本文・ファイル一覧・全14コミットを取得し、baseから最終headまでの38ファイルの変更と追加修正を確認した。以前のレビュー記録は調査の入口と履歴として扱い、修正済みのR1〜R9等を未解決として重複指摘していない。

作業場所は `/Users/satoudaisuke/src/github.com/AudioStakes/arimono-de-recipe`、remoteは `https://github.com/AudioStakes/arimono-de-recipe`。開始ブランチは `issue-17-recipe-decision-docs` で、tracked/untrackedとも未コミット変更はなかった。reset・clean・stashを使わず、最新mainから `codex/post-merge-readiness-review` を作成した。閉じたPRブランチとmainには追記しない。

適用AGENTS、README、CONTEXT、関連ADR（特に0011/0012）、UX guardrails、UI境界、test matrix、Codex文書、PR本文、設定とテストを確認した。規約・セキュリティと仕様を別の読み取り専用レビュアーで確認し、実装担当はブラウザ操作・状態管理を追った。実装の追加修正も別レビュアーが確認した。

確認範囲は入力→request/parser→Function→応答検証→候補/調理表示、`buildPrompt(data)` によるコピー、timeout・stale response・再試行、clipboard失敗、キーボード・モバイル、Content-Type・本文/stream上限・reader解放・エラー/キャッシュ、CSP・Function routing、依存/lockfile・CI、導入/公開/貢献文書。未指定項目、入力上限時の全文コピー、必須/使い切り6件制限などは既存の実テストと現実装で確認した。モデルの指定遵守や安全性まで確認したとは扱わない。

### 発見した問題と対応

全6件はbaseにも存在する問題で、PR #29による新しい回帰・マージ後の変更による問題としては分類しない。位置は今回の修正後のファイル位置で、修正前の発生条件を併記する。好みだけの変更は行っていない。

| ID / 分類 | 位置 | 発生条件・影響と根拠 | 対応 |
|---|---|---|---|
| M1 / 必須修正 / P2 | `src/ai-recipe-schema.ts:722` | NG「にんにく」、材料/手順が正常でも、料理名「にんにく入り豆腐炒め」や理由「にんにくを加えると香りがよくなります。」を受理し表示できた。`title/why` が検査配列にない。新規unit2件で修正前に再現。 | 表示する料理名・推薦理由も検査し、Functionが汎用500を返す回帰とNGなしの正常系を追加。修正済み。 |
| M2 / 必須修正 / P2 | `src/ai-recipe-schema.ts:602`、`src/recipe-candidate-list.ts:getTasteAdjustmentLabels` | NG「醤油」でも「しょうゆ」を材料/手順で受理する。逆方向、みそ/味噌、こしょう/胡椒、だし/出汁も同様。アプリ内で既に扱う表記がNG側で一致しない。8組のunitが修正前に失敗。 | 4組の既知表記だけを正規化し、候補の全文検査と味の調整で同じNG比較を使う。一般の食材別名/アレルギー辞書は追加しない。修正済み。 |
| M5 / 必須修正 / P2 | `src/app-events.ts:67`、`bindAppEvents` | モバイルシート中、Tab/Shift+Tabが背後の材料入力や削除ボタンへ移り、覆われた操作を実行できた。pointer用backdropだけではキーボード操作を遮らない。Chromiumで独立再現、追加E2E2件が修正前に失敗。 | 展開中だけ背景siblingsをinertにし、可視の操作のTab境界を循環。全操作を含むbottomActionsにdialog/aria-modalと見出しを設定。Escape・閉じる・幅変更時は解除しフォーカス復帰を確認。修正済み。 |
| M3 / 実用上の効果がある改善 / P2 | `src/recipe-candidate-list.ts:376` | 受理した `ing=["豆腐（１丁）","油 小さじ1"]` の「１丁」が詳細には出ても調理の材料tabから落ちる。主材料欄は入力の名前だけ、その他欄は主材料を除外するため。desktop/mobileの4 E2Eで再現。 | `ing` の全項目を主材料/その他に分けて保持し、入力の量・必須/使い切り指定は別に表示。生成が分量を提供する保証は追加しない。修正済み。 |
| M4 / 実用上の効果がある改善 / P2 | `src/output-panel.ts:82` | Clipboard API未対応時、代替textareaへfocusして除去するとコピー成功後もbodyにfocusが落ちる。keyboard利用者が元の位置を失う。execCommandをモックしないネイティブコピーで4 E2Eが失敗。 | 一時要素除去後に接続中の元要素へpreventScroll付きでfocusを復帰。成功/失敗の既存処理と要素解放を維持。修正済み。 |
| M6 / 実用上の効果がある改善 / P2 | `src/app-events.ts:214` | 展開ボタンは開くと「レシピ依頼文全文を閉じる」と案内するが、handlerが常にopen=trueを設定し閉じない。独立Chromium操作と追加E2E2件で確認。 | 現在の開閉状態を反転する。Enterで閉じ、起点へのfocus復帰も確認。修正済み。 |

否定表現を意味解析する変更は行っていない。NG文字を含む「にんにく不使用」等も保守的に拒否する既存の制約は、今回 `title/why` にも適用する。READMEにこの制約と4組の表記対応を明記した。数量範囲や食材の説明括弧の過剰拒否も調べたが、モデル契約は数量なしの完全材料名であり、自由な説明文を解釈する仕様へ拡張しなかった。

### 実行環境と検証

macOS / arm64、Node.js 22.20.0・npm 10.9.3、Playwright 1.60.0の標準Chromium（desktop/mobile emulation）、Wrangler 4.144.0。`ASDF_NODEJS_VERSION=22.20.0` をコマンドごとに指定した。Node24の補助確認は24.18.0。シェルコマンドはrtk経由で実行した。下表の `npm/npx` はこの環境指定とrtk prefixを省略して記載する。

| Command / 対象 | Exit | 主要な結果 |
|---|---:|---|
| `git ai-status` / `git ai-files` / `git ai-status-full` / `git ai-untracked`、`git remote -v`、`git fetch origin --prune` | 0 | 作業場所・変更なし・remote・最新mainを確認。Git管理領域はread-onlyのためfetch/branch/commitは依頼済み操作の昇格経路を使用。 |
| `gh pr view 29 --repo AudioStakes/arimono-de-recipe --json ...`、限定したdiff/stat/log | 0 | MERGED、base/head/merge、最終差分、全14コミットを確認。 |
| `npm ci` | 0 | lockfile固定で導入。先行する失敗はasdf未選択のexit1とsandboxのnpm接続制限によるexit1で、Node指定と許可された接続経路で解消。ソース/lockfileは変更していない。 |
| `npx playwright install chromium`、修正前mainでの `npm run check` | 0 | 標準ブラウザ準備と全品質ゲートが成功。既存失敗として扱うソース上の問題はなかった。 |
| `npx vitest run tests/unit/public-readiness-regressions.test.ts --reporter=default`（製品修正前） | 1 | 追加unit10件が失敗、42件成功。通常候補を保持する新規正常系も成功。 |
| `npx playwright test tests/e2e/public-readiness-regressions.spec.ts --grep 'ネイティブ代替' --reporter=list`（修正前） | 1 | コピー成功文言は出るが、focus保持の4件が失敗。 |
| `npx playwright test tests/e2e/ai-recipe.spec.ts --grep '主材料の分量' --reporter=list`（修正前） | 1 | 「豆腐（１丁）」の表示保持で4件失敗。 |
| `npx playwright test tests/e2e/public-readiness-regressions.spec.ts --grep '背景を操作'`（境界修正前 / toggle修正前） | 各1 | 背景へのfocus逸脱2件、別実行で案内されたcloseが閉じない2件を再現。 |
| 関連unit4ファイル `--reporter=dot` | 0 | schema・Function・candidate labels・回帰の106件成功。 |
| 関連E2E3ファイル `--reporter=list` | 0 | candidate・コピー・回帰54件成功（modal追加前）。 |
| `npx playwright test tests/e2e/public-readiness-regressions.spec.ts --reporter=dot`（最終修正後） | 0 | native copy・失敗案内・modal・toggle・Escape/resize等14件成功。 |
| `npm run check`（全6件の最終実装、`afddb8099f5e085b0f44226d323c8a6fc46892f8` と同じ実装ツリー） | 0 | format/lint/typecheck/build/unit/structure/E2Eがすべて成功。HTMLレポートの実行statsは118 E2E成功、failure/flaky/skip各0。 |
| Node24.18.0で `npm run typecheck` / `npm run build` / `npm run test:unit -- --reporter=dot` | 各0 | unit191件成功。Node22で導入した同じ依存を使用。Node24での新規npm ci・E2Eは未実行。 |
| `npm audit --json` | 0 | info/low/moderate/high/criticalすべて0件。監査時点のregistry結果で将来を保証しない。 |
| `npx wrangler pages functions build functions --outdir /private/tmp/arimono-postmerge-function-build` | 0 | `Compiled Worker successfully`。実AI呼び出しなし。 |
| `npx wrangler pages dev dist --port 8788 --ip 127.0.0.1 --compatibility-date=2026-09-26` + `node /private/tmp/arimono-pages-smoke.mjs` | probe 0 | AI bindingなし。GET405、media type415、別Origin403、AI未設定500がno-store/nosniff付き。静的200にCSP/frame拒否/nosniff、API対象外のpathは静的配信。1280/390pxで入力/コピー送信0回、明示候補操作のみ1回、失敗後コピー可、CSP violation/pageerror 0。mobileのTab循環・inert・案内されたclose・focus復帰も成功。サーバーは確認後Ctrl-Cで停止（終了コード130は意図した停止）。 |
| ローカルMarkdownリンク検査、`git diff --check` | 0 | 主要7文書のローカルリンク16件に欠落0、余分な空白差分なし。外部リンク全体の巡回確認ではない。 |
| `gh run list --commit df307d826970cb33764d47ef457811913502e9da --workflow CI ...` | 0 | 対象mainの[CI run 37162715389](https://github.com/AudioStakes/arimono-de-recipe/actions/runs/37162715389)はsuccess。新Draft PRの最終SHAに対応するCIはPR本文に追記する。 |

modalテストの初期作成時に最初のTab対象を閉じるボタンと誤認し、関連E2E実行で56成功/2失敗になった。実際は可視の展開ボタンが先頭なので、その境界へ修正して14件を再実行し成功した。このテスト作成上の失敗を製品不具合の再現に数えていない。既存テストの削除・弱体化・skip、品質ゲートの緩和は行っていない。

E2Eの成功時reporterは既存どおり静かだが、HTMLレポートのstatsを別に確認した。UI証拠はローカルの `playwright-report/index.html` と、Pages配信の `/private/tmp/arimono-pages-smoke-1280.png`・`/private/tmp/arimono-pages-smoke-390.png`。一時probeはその場の確認用で、リポジトリの恒久テスト契約にはしていない。再利用する回帰は既存のunit/E2Eに追加した。

### 修正コミットと残る判断

- `7c2a51f3d31789305092e35b8f7b00de61783482`: NGの全文/既知表記検証、味の調整の共有、調理分量保持と回帰、README/test matrix。
- `afddb8099f5e085b0f44226d323c8a6fc46892f8`: native copyのfocus復帰、mobileの背景inert・Tab循環・実際の開閉と回帰。
- この記録の文書コミット、push、Draft PR URL、最終headのCIは新Draft PR本文と最終報告に記録する。force push・履歴書換え・PR #29への変更は行わない。

取得時のGitHub APIではvisibilityはPRIVATE、licenseInfoはnull、main branch APIはprotected=false。設定は変更しない。ライセンス/公開化、画像と履歴の権利・情報、非公開脆弱性報告先、branch保護、公開URL/サポート範囲は所有者の判断が必要。Rulesets全体の現在設定は今回取得していないのでbranch APIだけで保護全体を断定しない。

Production/Preview/代替ドメインのBindings・WAF・呼び出し制限・費用/停止設定は未確認で、所有者の運用判断を要する。Origin検証は認証/回数制限の代わりではない。実モデルの品質、分量/使い切りの遵守、アレルギー・加熱安全性、Safari/Firefox実機、実機IME/支援技術、本番配信・課金制御は検証していない。local Pagesの成功を本番設定の成功とは扱わない。有料AI、本番負荷試験、デプロイ、マージ、新しい認証・保存・解析・送信先・アーキテクチャは実施していない。

参考: [WAI modal dialog](https://www.w3.org/WAI/ARIA/apg/patterns/dialog-modal/)、[MDN inert](https://developer.mozilla.org/en-US/docs/Web/API/HTMLElement/inert)、[MDN focus](https://developer.mozilla.org/en-US/docs/Web/API/HTMLElement/focus)、[Pages headers](https://developers.cloudflare.com/pages/configuration/headers/)、[Function routing](https://developers.cloudflare.com/pages/functions/routing/)。

### 新Draft PRのCIで確認したテスト同期修正

専用ブランチをpushし、[Draft PR #36](https://github.com/AudioStakes/arimono-de-recipe/pull/36)を作成した。最初のhead `b6e3137f815115b3d633dd7532f33209feab4647` の[CI run 37164857563](https://github.com/AudioStakes/arimono-de-recipe/actions/runs/37164857563)はfailureで、`npm run check` の終了コードは1。format/lint/typecheck/build/unit/structureは成功し、追加したmobileのresize後focus確認1件がE2Eで失敗した。この後に確認した最終CIとは区別する。

ダウンロードしたtraceでは `setViewportSize` の完了直後、背景入力へのfocus呼び出し時点でまだinertが残り、その後のresizeイベント処理でdialogがclosedになっていた。focusは一度だけ実行されるため、expectが待機しても再実行されない。製品の解除失敗ではなく、今回作成したテストのイベント同期不足だった。

`npx playwright test tests/e2e/public-readiness-regressions.spec.ts --grep '背景を操作' --project mobile-chrome --repeat-each 12 --workers 2 --reporter=dot` は修正前exit1（5失敗/7成功）で同じ症状を再現した。既存の「dialogが0件」のassertをresize後のfocusより前へ移し、完了状態を観測してから操作する順序にした。assertの削除・skip・固定sleepは追加していない。同じ反復コマンドは修正後exit0（12成功）。元の全シナリオを維持した。

同期修正後に `CI=true npm run check` をNode22で再実行し、exit0で全品質ゲートが成功した。CIと同じ2worker設定を使用。最終headのCI URLと結果はDraft PR本文・最終報告へ記録する。この追加コミットはテスト順序とこの履歴の記録だけで、Pagesで確認した製品実装は変更していない。

さらに独立レビュー担当が、desktop向けCSSだけでもdialogが非表示となり、通常の `getByRole("dialog")` ではhandler実行前にcount0となる可能性を指摘した。12回成功という実行結果は維持しつつ、「完了状態」の待機条件を厳密にするため、resize後のassertだけを `getByRole("dialog", { includeHidden: true })` に補強した。非表示でもroleが残る要素を数え、handlerによるrole削除まで待つ。同じ12回・2workerの反復はこの補強後もexit0（12成功）。製品変更や期待値の緩和はない。

補強後も `CI=true npm run check` はexit0で全品質ゲートが成功した。補強前の `940cd1957338c69a4d165b2c38b5c7974bad8ce2` に対応する[CI run 37165299705](https://github.com/AudioStakes/arimono-de-recipe/actions/runs/37165299705)もsuccessだったが、最終補強を含むSHAのCI結果とは区別し、後者をDraft PR本文と最終報告で確認する。

## 2026-10-04 依頼文コピーと全文AI送信の追加レビュー

### 対象と変更の理由

所有者から、依頼文の作成・コピーと、その依頼文をAIへ送って返答を確認する操作の両方を使えるようにする追加依頼を受けた。開始時のアプリはコピーと短い構造化条件による候補生成に対応していたが、画面で確認する依頼文全文を送る操作はなかった。これはPR #29の回帰として扱わず、追加要望への機能改善とした。既存FunctionにはADR 0011の `{prompt}` 経路があり、これを利用した。

作業前のheadは `bbcc043cbf76b97f95cc7e0730369cf8155e943f`。製品・テスト・利用文書の追加コミットは `f7852529e1e90a7681464ab18000ca84be892be2`。push前に再取得した `origin/main` は引き続き `df307d826970cb33764d47ef457811913502e9da` で、先行修正PR #36のheadは `0721ef347ef4b3d919595d6b912018072954a065` だった。[Draft PR #37](https://github.com/AudioStakes/arimono-de-recipe/pull/37)はPR #36の専用ブランチをbaseにしている。mainや閉じたPR #29へpushしていない。

コピーの本文は引き続き `buildPrompt(data)` だけで生成する。desktopの依頼文previewとmobileの展開パネルに「この依頼文をAIへ送信」と自由文の回答欄を追加した。未確定入力を確定してから同じ全文を送信し、候補用の件数制限は流用しない。既存の12,000文字・JSON全体32,000 UTF-8バイトの上限をFunctionと共有し、超過時もコピー本文を切り捨てない。候補生成は別の状態・検証・調理タブを維持した。

### 独立したレビュー・修正ループ

- `dual_flow_map` がコピー／候補／既存legacy APIと入力確定・失効・mobile modalの接続点を読み取り調査した。
- `spec_review` が設計、実装、最終文書を3段階で確認した。独立したメモリ内probeでも、必須・使い切り材料7件と13材料では候補上限と全文送信を分けられ、分量・NG・人数・目的・品数・補足が残ることを確認した。7材料のケースを永続E2Eへ追加した。
- `standards_review` が送信の入口、サイズ境界、共有transport、timer/listener解除、abort、古い回答の破棄、文字列表示、コピーとの独立を読み取り確認した。具体的な必須修正は見つからなかった。
- 最終文書レビューではdeploymentの「候補要求の場合だけ通信」という古い説明と、UX matrixのNG照合対象が自由文にも見える点を指摘された。両送信の成功結果とAI候補に限定した検証範囲へ修正した。好みのためのUI再設計は行っていない。

### 検証環境と結果

macOS arm64、Node 22.20.0、npm 10.9.3、Playwright 1.60.0の標準Chromium、Wrangler 4.144.0。shellは `rtk`、Node選択は `ASDF_NODEJS_VERSION=22.20.0`、E2EはCIと同じ2workerで実行した。下表の成功結果は上記製品コミットに含まれるコード・テストに対応する。この記録だけを追加する後続コミットのSHAとCIはPR本文・最終報告で区別する。

| コマンド | 終了コード | 主要な結果 |
|---|---:|---|
| `npm run test:unit -- --run tests/unit/ai-prompt-client.test.ts`（実装前） | 1 | 全文送信関数が未実装で追加テストが失敗。既存の経路に全文送信クライアントがないことを確認。 |
| `npx vitest run tests/unit/ai-prompt-client.test.ts tests/unit/ai-recipe-client.test.ts tests/unit/recipe-function.test.ts` | 0 | 新旧のクライアントとFunction（AIスタブ）が成功。 |
| `npx vitest run tests/unit/ai-prompt-client.test.ts --reporter=json --outputFile=/private/tmp/arimono-dual-flow-unit-report.json` | 0 | 18/18成功。全文一致、空・文字数・UTF-8とescapeの境界、不正応答、APIエラー、接続・本文待機timeout、中断とtimer解除。 |
| `npx playwright test tests/e2e/ai-prompt.spec.ts`（最初の9シナリオ） | 0 | 1280/390pxの明示送信・native copy・失敗/再試行・上限時の全文保持・安全な回答表示・閉じたpreviewのfocus・古い応答破棄。 |
| `CI=true npm run check`（追加中） | 1 | 初回はimport順。次は既存modal testが「出力欄が最後」と仮定したTab期待値2件で失敗。新ボタンを含むoutput→send→firstと逆方向へ更新し、背景inert/Escape/resizeのassertは維持した。品質gateは緩和していない。 |
| focused E2E（7材料ケースの最初の追加） | 1 | 新テストの存在しないhook `material-use-card` が原因。既存 `material-card` hookへ修正。製品の失敗と区別した。 |
| `npx playwright test tests/e2e/ai-prompt.spec.ts --grep '候補上限\|コピー本文全文'` | 0 | 7材料の制約保持と、送信前・回答後のmobile Tab循環も成功。 |
| `CI=true npm run check`（最終） | 0 | format/lint/typecheck/build/unit/structure/E2Eすべて成功。HTML reportは138 expected、unexpected/flaky/skipped各0。 |
| `npx wrangler pages functions build functions --outdir /private/tmp/arimono-dual-flow-function-build` | 0 | 共有上限定数を含むFunctionをコンパイル。 |
| `npx wrangler pages dev dist --port 8788 --ip 127.0.0.1 --compatibility-date=2026-09-26` + `node /private/tmp/arimono-dual-flow-pages-smoke.mjs` | probe 0 | **AI bindingなし**。実Functionの全文POSTは500 `ai_binding_unavailable` + no-store/nosniff。静的200のCSP/frame拒否/nosniffを確認。1280/390pxのpreview/copyは送信0回、明示送信は表示本文と完全一致、失敗後もcopy可能。成功回答はbrowser mockで文字列表示・copy・mobile Tab/inert/Escapeを確認。CSP違反/pageerror各0。確認後にserver停止、終了0。 |
| `git diff --check` / `git fetch origin --prune` | 0 | 余分な差分エラーなし。mainとbaseの更新なし。他者の履歴を保持。 |

Pages smokeの最初の試行では、AI未設定のまま本文超過が413になると想定してexit1になった。既存Functionは本文解析より先にAI設定の有無を確認するため500になる。製品を変更せず、実行可能な未設定エラーの検証へ修正した。本文上限はAIスタブを用いるFunction単体テストで確認しており、このPages smokeから本文解析を確認済みとはしていない。

### 判断待ちと未確認の範囲

表示の優先順は既存の候補先行を維持した。依頼文コピーを先に案内するか、アプリ内AIを先に案内するかは所有者の選択待ちで、どちらの場合も自動送信は行わない。全文送信の自由文回答には候補用の材料・NG自動照合を適用せず、画面とREADMEへ明記した。既存の応答トークン上限による途中終了もあり得る。

実Workers AI、実モデルの品質・入力条件の遵守・アレルギーや加熱の安全性、Safari/Firefox実機、本番・Previewの課金/呼出し制御は未確認。推論・課金・公開運用に関する以前の所有者判断は残る。client abortがサーバーの推論停止や課金取消を保証するとはしていない。新しい提供元・認証・保存・解析・API経路は追加していない。デプロイ・マージ・本番負荷試験は行っていない。

## 2026-10-04 デフォルトの案内順の確定

所有者が「アプリ内AI優先。ただしコピーも同じ画面から選べる」と回答した。以前の「選択待ち」は上記時点の履歴として保持し、この回答で解消した。`cadcd33b7dfe651a13073cfb86b892497895b219` の画面を読み取りサブエージェント `dual_flow_map` と `spec_review` で独立に確認したところ、既存のAI先行と同時選択の構成が要望に合っていたため、追加のモード切替やUI再設計は行わなかった。

desktopはAIカードの次にコピーカード、mobileは収納中のfooterにもAI・依頼文確認・コピーを表示する。展開中はパネル内のコピーを使える。READMEの説明をAI→コピーの順へ揃え、ADR 0012に確定した優先順と同じ画面からコピーを選べる方針を記録した。優先順は自動送信を意味しない。

実際に選べる証拠を補強するため、`tests/e2e/action-choice.spec.ts` を追加した。1280/390/320pxで初期表示のAIと文字付きコピーの可視性・有効状態・表示順、通常クリックとEnterによるネイティブClipboardへの全文コピー、入力・確認・コピー時のAPI送信0回、明示AI要求の未設定エラー後もコピーできることを確認する。旧 `copy.spec.ts` のmobile合成クリックは、可視性・有効状態を検査する通常クリックへ変更した。既存assertの削除・弱体化・skipはない。

最終レビューで、Enter前から同じ本文がClipboardにあるとキーボードコピーが動かなくてもassertが成功する点を指摘された。各コピーの直前に異なる文字列を書き込み、実クリック・Enterによって本文へ更新されることを検査する形へ補強した。アプリのコピー処理をモックしていない。

環境は上記と同じmacOS arm64 / Node22.20.0 / npm10.9.3 / Playwright1.60.0標準Chromium。対象はcadcd33を基準にした今回の文書・テスト変更で、製品コード・Function・配信設定・依存関係は変更していない。

| コマンド | 終了コード | 主要な結果 |
|---|---:|---|
| `CI=true npx playwright test tests/e2e/copy.spec.ts tests/e2e/sticky-footer.spec.ts`（追加前） | 0 | 既存のコピー・モバイル展開のbaselineが成功。 |
| `CI=true npx playwright test tests/e2e/action-choice.spec.ts tests/e2e/copy.spec.ts tests/e2e/sticky-footer.spec.ts` | 0 | 新しい3画面幅の選択操作と通常クリックへ補強した既存テストが成功。 |
| `CI=true npm run check` | 0 | 全品質gate成功。reportの144件すべてexpected、unexpected/flaky/skipped各0。 |
| `git diff --check` | 0 | 差分の空白エラーなし。 |

新しいAI提供元・送信経路・保存・解析・設定画面は追加していない。実AI・有料呼出し・デプロイ・マージは行っていない。今回は文書・テストだけの変更なのでFunctionコンパイルやPages配信は再実行せず、上記f7852529の既存実装に対する証拠と区別する。最終コミットSHAとCIの結果はDraft PR #37と最終報告で確認する。
