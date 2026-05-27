# AGENTS.md

## Project

このプロジェクトは、「ありもの de レシピ」です。

冷蔵庫にある食材・材料やレシピ要望から、AI に貼り付けるレシピ依頼文を作る静的 Web アプリです。

## Read first

- ドメイン用語は `CONTEXT.md` を参照する。
- 重要な設計判断の背景は `docs/adr/` を参照する。
- `AGENTS.md` は、AI エージェントや開発者が作業するときの最小限のルールを定義する。
- 用語の定義や設計判断の背景を `AGENTS.md` に重複して増やさない。

## Non-negotiable rules

- このアプリは、レシピ生成アプリではない。
- アプリ内で AI 生成やレシピ生成を行わない。
- API 連携を行わない。
- サーバー処理を行わない。
- ログイン機能を持たない。
- 入力内容を外部送信しない。
- 外部送信や保存を前提とする設計にしない。
- 未指定項目はプロンプトに出力しない。
- 未指定項目に対応するルール文も出力しない。
- 家にない材料を主材料として追加させるレシピ依頼文にしない。

## Commands

```bash
npm install
npm run dev
npm run format:check
npm run lint
npm run typecheck
npm run build
npm run test
npm run check
```

Use focused commands while developing:

```bash
npm run test:unit
npm run test:e2e
npm run test:e2e:ui
```

Before finishing a meaningful change, prefer running:

```bash
npm run check
```

If `npm run check` is too broad for the change, run the smallest relevant subset and report what was run.

## Essential implementation rules

- TypeScript / CSS / HTML を Vite で静的サイトとしてビルドする構成を維持する。
- Cloudflare Pages で `dist/` を配信できる構成を維持する。
- 依存を増やす場合は、静的フロントエンドとしての単純さを損なわない。
- レシピ項目、候補値、プロンプト出力ルールは設定データ中心に管理する。
- 不要になった旧 UI、旧文言、未使用コードは残さない。
- HTML と JavaScript が構文エラーなく実行される状態を常に保つ。

## Before finishing

- `CONTEXT.md` の用語と矛盾していないか確認する。
- 関連する ADR の判断と矛盾していないか確認する。
- UI、候補値、指定値の表示、プロンプト出力、テスト観点への影響を確認する。
- 未指定項目が出力されないことを確認する。
- 変更に見合うテストまたはセルフテストを行い、実行した確認内容を報告する。
- Playwright の一部テストが不安定で時間を使い過ぎる場合は、理由を `FIXME` コメントに残して一旦 `skip` し、後で再開しやすくする。
