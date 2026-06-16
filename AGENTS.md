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

## YAGNI

- 将来必要になるかもしれないだけの抽象化は追加しない。
- 候補値データは、まずレシピ項目ごとの単純な `CandidateValue[]` として管理する。
- 候補値に `CandidateValueGroup`、`keywords`、`itemTypes` は持たせない。
- `NG食材・調味料` は、`食材・材料` と `調味料` の候補値から合成する。
- グルーピング、関連語検索、複数項目への所属管理は、実際に必要になった時点で追加する。

## Before finishing

- `CONTEXT.md` の用語と矛盾していないか確認する。
- 関連する ADR の判断と矛盾していないか確認する。
- UI、候補値、指定値の表示、プロンプト出力、テスト観点への影響を確認する。
- 未指定項目が出力されないことを確認する。
- 変更に見合うテストまたはセルフテストを行い、実行した確認内容を報告する。
- Playwright の一部テストが不安定で時間を使い過ぎる場合は、理由を `FIXME` コメントに残して一旦 `skip` し、後で再開しやすくする。


<!-- headroom:rtk-instructions -->
# RTK (Rust Token Killer) - Token-Optimized Commands

When running shell commands, **always prefix with `rtk`**. This reduces context
usage by 60-90% with zero behavior change. If rtk has no filter for a command,
it passes through unchanged — so it is always safe to use.

## Key Commands
```bash
# Git (59-80% savings)
rtk git status          rtk git diff            rtk git log

# Files & Search (60-75% savings)
rtk ls <path>           rtk read <file>         rtk grep <pattern>
rtk find <pattern>      rtk diff <file>

# Test (90-99% savings) — shows failures only
rtk pytest tests/       rtk cargo test          rtk test <cmd>

# Build & Lint (80-90% savings) — shows errors only
rtk tsc                 rtk lint                rtk cargo build
rtk prettier --check    rtk mypy                rtk ruff check

# Analysis (70-90% savings)
rtk err <cmd>           rtk log <file>          rtk json <file>
rtk summary <cmd>       rtk deps                rtk env

# GitHub (26-87% savings)
rtk gh pr view <n>      rtk gh run list         rtk gh issue list

# Infrastructure (85% savings)
rtk docker ps           rtk kubectl get         rtk docker logs <c>

# Package managers (70-90% savings)
rtk pip list            rtk pnpm install        rtk npm run <script>
```

## Rules
- In command chains, prefix each segment: `rtk git add . && rtk git commit -m "msg"`
- For debugging, use raw command without rtk prefix
- `rtk proxy <cmd>` runs command without filtering but tracks usage
<!-- /headroom:rtk-instructions -->
