# 開発に参加する

不具合や改善案は[Issues](https://github.com/AudioStakes/arimono-de-recipe/issues)へ報告してください。コードの利用条件は[READMEのライセンス](README.md#ライセンス)を確認してください。

## 不具合の報告

利用したブラウザと端末、再現手順、期待した結果、実際の結果を書いてください。AI候補については、依頼文コピーを利用できるかも確認してください。入力例やスクリーンショットには個人情報を含めないでください。脆弱性は通常のIssueではなく[SECURITY.md](SECURITY.md)に従って報告してください。

## 開発環境

```bash
# Node.js 22.12以上の22系（推奨）または24以上
npm ci
npm run dev
npx playwright install --with-deps chromium
```

追加のCLIは必須ではありません。RTKやnvmを使用しない環境でも、記載したnpmコマンドをそのまま実行できます。Vite単体では依頼文コピーを確認し、AI候補はE2Eのモックか[Pagesの開発環境](docs/deployment.md)で確認します。実際のWorkers AIを使うテストは自分のCloudflareアカウントの利用量に計上されます。

## コードの場所

| 場所 | 役割 |
|---|---|
| `src/data.ts`、`src/candidate-values/` | 候補値と項目の設定 |
| `src/prompt.ts` | コピーする依頼文の生成 |
| `src/ui.ts`、`src/styles.css` | 画面の構成とスタイル |
| `src/app-events.ts`、`src/types.ts`、`src/ui.ts` | 入力操作と状態 |
| `src/ai-recipe-request.ts`、`src/ai-recipe-client.ts` | AI候補への依頼と通信 |
| `src/ai-recipe-schema.ts`、`functions/api/recipe.ts` | リクエスト・応答の検証とWorkers AI呼び出し |
| `src/recipe-candidate-list.ts` | 候補の詳細と調理ビュー |
| `tests/unit/`、`tests/structure/`、`tests/e2e/` | ユニット、構造、ブラウザの検証 |

## 変更前に確認すること

[AGENTS.md](AGENTS.md)に検証・変更範囲のルールがあります。用語は[CONTEXT.md](CONTEXT.md)、設計判断は[ADR](docs/adr/)を確認してください。生成する依頼文は `buildPrompt(data)` を基準とし、指定していない項目や条件を追加しません。

新しいAPI、ログイン、保存、解析、外部送信、広範なUI再設計、パッケージマネージャやホスティング方式の変更は、実装前にIssueまたはDraft PRで提案してください。既存の `/api/recipe` とCloudflare Workers AIが、現在承認されているアプリ内AI経路です。

## 検証

```bash
npm run format
npm run check
```

`format` はファイルを整形します。`check` は整形確認・lint・型検査・ビルド・ユニット・構造・E2Eを順に実行します。個別に実行する場合は `npm run test:unit`、`npm run test:structure`、`npm run test:e2e` 等を使用してください。

E2EはChromiumのデスクトップとPixel 7相当のモバイル表示で実行し、Workers AIの応答をモックします。実モデルの出力品質や実機Safariを保証するテストではありません。失敗時のHTMLレポートは `playwright-report/`、トレース等は `test-results/` に出ます。CIはこれらを7日間保存します。入力を含むテストを追加する際は実ユーザーのデータを使わないでください。

UIの重要な操作には既存の `data-testid` を使用し、変更した挙動をテストまたは明示的な確認手順で検証してください。テストを削除・弱体化して通さないでください。

## Pull Request

変更理由、対象範囲、追加・更新したテスト、実行コマンドと終了コード、未実行の確認と理由をPRテンプレートに記載してください。画面を変更した場合はスクリーンショットまたは実行したE2Eの範囲も記載します。

Codexが作成するPRはDraftとし、人間がレビュー・マージします。秘密情報をコミットせず、`.env`、`.dev.vars`、Cloudflareトークンや実ユーザーの入力を含めないでください。
