# 品質ゲート

エージェントのモデルによる作業品質の差を減らすため、検査の警告も失敗として扱う。[ADR 0013](adr/0013-enforce-strict-nonconflicting-quality-gates.md)が方針、設定ファイルと`package.json`が実行内容の基準である。

## ツールの担当

| 対象 | 整形 | 検査 |
| --- | --- | --- |
| JS・TS・JSON・JSONC・CSS・HTML | Biome | Biome recommendedと選択した追加ルール |
| ブラウザ・Function・テスト・設定のJS／TS | Biome | TypeScript strict、JSはcheckJs |
| `scripts/`のJS／TS | Biome | NodeNextの専用tsconfig、strictとcheckJs |
| 静的HTMLと初期UIの描画前HTML | Biome（静的HTML） | HTML-validateの意味・ARIA・入力ラベル検査 |
| Markdown | markdownlintのfix | 全既定ルールと下記の例外。inline disableは無効 |
| YAML | yamlのコメントを保持するserializer | strict構文、重複キー、警告、未解決alias、整形前後の値一致 |
| CSSのデザイントークン | Biome | 既存のdesign checkerとCSSの未知のプロパティ・単位・関数・重複等 |
| 依存関係 | npm lockfile | CIの`audit:dependencies`、low以上で失敗 |

Biomeの対象は拡張子で選び、ネストした設定JSON、保守用JavaScript、HTML fixtureも含む。生成物・インストール済み依存・テストレポート・lockfileは整形しない。lockfileは`npm ci`で使用する。TOML、画像など未対応形式の汎用lintは追加していない。

新しいライブラリは開発依存だけに置く。HTMLHintはHTML-validateへ置き換えた。旧ゲートのinline script・イベント属性・実行URL・style禁止を、HTMLメタデータと属性ASTの小さなルールで保持する。文字参照はentitiesで復号し、URL中のTAB／LF／CRも考慮する。`index.html`の旧dash識別子規則は追加の同じHTML-validate実行で保持する。

## 厳格化と例外の理由

- `noNonNullAssertion`、`noConsole`、未使用・無意味な式、Error以外のthrow、skip／onlyをエラーにする。CLI・テストreporterのconsoleだけを許可する。
- Biomeの型推論を使う`noFloatingPromises`／`noMisusedPromises`／`useAwaitThenable`は個別にerrorで選択する。nursery全体は有効にしない。ピン留めしたバージョンで反例と妥当なPromiseLikeを検証する。
- `src/`の全JS／TS形式でNode import・Node globalを禁止する。Nodeの型がテスト用に入っていることによるブラウザ側の見落としを補う。
- TypeScriptは宣言ファイルも検査し、型import、到達不能コード、未使用ラベル、side-effect importを明示検査する。`useLiteralKeys`は`noPropertyAccessFromIndexSignature`と矛盾するため無効にする。
- HTMLのdoctype・boolean／empty属性・voidタグ・行末空白の書式規則はBiomeへ任せる。既存のARIA comboboxをnative selectへ変える規則と、入力条件用formにsubmitを要求する規則は、このアプリの用途に合わないため使わない。
- `hidden-focusable`は別ファイルのCSSによる非表示を考慮できないため、HTML文字列検査では使わない。E2Eで閉じたモバイルパネルの非表示とTab移動を確認する。初期HTMLはブラウザが不正構造を修復する前の文字列を捕捉し、完成DOMの重複ID・参照先も確認する。
- MarkdownのMD013は日本語の論理行とURLを任意の桁で折り返さないため、MD024／MD025はレビュー履歴の反復見出しと複数の指示文書を保持するため無効にする。表はcompact形式で統一する。コードブロックの内容は整形しない。
- HTML-validateの更新では最低Nodeを確認し、`package.json`のengine条件とCIのNodeで互換性を検証する。

## 実行と維持

```bash
npm ci
npm run format
npm run check
npm run audit:dependencies
```

`check`は既存ソースを変更しない。ビルド生成物・テストレポート・テスト後に削除する一時fixtureは作成する。`format:unsafe`は意味を変える可能性があるため差分をレビューする。`void`を付けてPromise検査を通すだけではエラー処理を保証しない。新しいルール抑制は対象を狭くし、理由を記録する。

`tests/structure/quality-gates.test.ts`は実CLIの終了コード・診断・処理件数を検証する。実npm scriptsが警告や保守スクリプトの型エラーで停止することも確認する。正しい入力とformatterの二巡目も検査し、ツールが対象を無視して成功するケースや整形の往復を防ぐ。

非同期ルールは`void`や`unknown`のPromiseを完全には検出できない。CSS wildcard宣言があるため、TypeScriptのside-effect import検査だけではCSSファイルの存在を保証しない。YAML検査はActionsのスキーマ・式の評価を保証しない。HTML E2Eの追加検査は初期描画が対象で、全ての動的状態やアクセシビリティ全体を保証するものではない。

監査はnpmの公開情報への通信を必要とし、新しいアドバイザリーやサービス障害で結果が変わる。通常のローカル`check`とは分ける。モックとChromiumから実AIの品質、実機Safari／Firefox、本番費用の安全性は結論づけない。

## 依存監査の例外

`micromark-extension-math` 3.1.0はKaTeXを`^0.16.0`に制限しているため、[既知の脆弱性](https://github.com/advisories/GHSA-238p-pmpm-9mq7)を修正する0.18.2を、その依存配下だけnpm overrideで固定する。Markdown全件lint、構造テスト、inline／display数式の描画・解析で互換性を確認した。upstreamが修正版を許容する際にoverrideを削除する。

Chromium・Pixel 7相当では全E2Eを実行する。Firefox・WebKit・iPhone 13相当・iPad Pro 11相当では入力、候補選択、調理表示、コピー・エラー回復、今回修正した操作の回帰テストを実行する。実機OS、実機のソフトウェアキーボード、実際のSafariアプリを再現するものではない。

アプリのE2Eは本番ビルドをVite previewで配信して実行する。`combo-controller.spec.ts`だけは本番へ含めないTypeScript harnessを別ポートのViteで検証する。どちらも既存サーバーを再利用しない。
