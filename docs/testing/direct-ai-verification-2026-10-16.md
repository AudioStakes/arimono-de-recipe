# 2026-10-16 依頼文送信中心の動線の検証

## 変更とレビュー

[PRD](../prd/direct-ai-recipe-flow.md)・[ADR 0014](../adr/0014-center-full-prompt-ai-response.md)に沿い、料理候補の生成・選択・調理タブを撤去した。表示・コピー・送信は同じ依頼文を使い、回答は共通のMarkdown表示に集約した。

設計・文書、APIとMarkdownの安全性、テスト移行、実画面のUX、最終の状態遷移を別担当がレビューした。parser例外と表のセル増幅を制限し、入力・コピー・上限・中断・古い回答の排除を新動線へ移した。通常の通信失敗とtimer解放の移植漏れも補完した。

実画面レビューでは次の7件を修正し、1280×900／390×844／320×568／844×390で41項目を独立再確認した。

- 長い回答を含む親のstickyを解除。
- 材料削除を右端の小さいアイコン付き操作へ変更。
- 送信先の長い説明を主操作近くの短い表示へ集約。詳細の読み上げ説明は保持。
- 材料なしのエラーを入力直下に表示し、入力追加でARIAと説明を解除。
- 分量の入力とエラーを実際の固定footerの上へ表示。
- スマホのコピーラベルを一行に保持。
- 表の分量を途中で割らず、長い表だけを横スクロール。

最終レビューでは、送信中または回答後の未確定入力をコピーで確定すると、待機状態や古い回答が残る経路も修正した。旧distでdesktop/mobileの4件を再現し、修正後4件すべて成功した。クリップボード操作の前に新しいawaitや分量検証を挟まず、同期の変更通知から中断・回答消去へ接続した。

## 実行した確認

| コマンド・確認 | 結果 |
| --- | --- |
| 初回 `CI=1 npm run check` | exit 0。format・lint・typecheck・build・unit・structure・6構成E2Eを完了。446 passed、失敗・skip・flaky 0 |
| Tab修正後 `CI=1 npm run check` | exit 0。全ゲート成功、458 passed、失敗・skip・flaky 0 |
| `npm run audit:dependencies` | exit 0、found 0 vulnerabilities |
| UX修正後のfocused Chromium E2E | exit 0、62 passed |
| 未確定入力コピー修正後のfocused E2E | exit 0、34 passed。新依頼文のコピー一致・旧signalのabort・回答消去・送信再有効・再送信を確認 |
| 独立したUX再確認 | exit 0、4サイズ41項目、pageerror 0。応答はモック |
| 既存8Bモデル切替後のFunction unit | exit 0、19 passed |
| 同切替後の`npm run typecheck`・Pages Function build | exit 0、Compiled Worker successfully |

初回のローカル全checkは `ab50dad` で実行した。初回CIまでのアプリ変更は、既存8Bモデルを再利用するFunctionの定数1行のみで、対応unit・型検査・Functionコンパイルを追加実行した。以下の追加確認で見つかったフォーカス修正後の `988694c` では、ローカル全checkが458件すべて成功した。PRの必須CIも最終HEADで再実行する。

## Linux CIで見つかった準備操作の時間切れ

[PR #50の初回CI](https://github.com/AudioStakes/arimono-de-recipe/actions/runs/38842241778)は444 passed・2 failed・skip/flaky 0で、失敗はWebKitとmobile Safariの大量材料テストだった。失敗したtraceを保存し、別担当も解析した。radioのクリック前に安定を待つ時間が累積し、mobile Safariでは完了した6操作だけで約24秒を使っていた。成功操作にはdetach・遮蔽・再試行の記録がなく、30秒のテスト全体予算が異なる操作地点で尽きていた。

このテストは多数の材料制約を含む依頼文の全文送信を確認するものなので、材料7件を先に追加してから指定する順序へ整理し、使用方法の準備は通常のSpaceキー操作とcheckedの確認に変更した。7件の操作、分量・目的・品数・NG条件、全文一致、送信1回の検証を保持した。pointer操作は既存の専用回帰で確認する。この準備操作の調整ではアプリ・timeout・retry・skip・force操作は変更せず、修正後の全構成をPRの必須CIで再確認する。

## 追加確認で見つかったTabのフォーカス

分量を入力して通常のTabキーで次へ進むと、入力確定時の再描画でフォーカスがbodyへ落ち、次のTabが先頭材料へ戻る問題を再現した。材料のid・名前・使用方法が変わるときだけ構造を描画し直し、分量・required・ARIA・エラーは既存DOMへ反映するように修正した。変更通知と古い通信・回答の無効化は維持した。

回帰テストはnative Tabで次材料へ進み、そのまま入力できること、分量クリア時の検証と通信中断、新しい量での再送信を確認した。OS・設定でボタンやradioを経由する順序が違うため、最初のTabと追加Tabの各段階で次材料内のfocusを必須にした。追加Tabは最大3回とし、量入力への到達・入力継続・本文反映を共通に確認する。Alt+Tabや強制focusは使っていない。修正前の回帰は失敗し、修正後のfocused検証は6構成30件が成功した。多材料の準備操作も6構成各3反復、18件が成功した。Tab順序をOS固定にした期待は[2回目のLinux CI](https://github.com/AudioStakes/arimono-de-recipe/actions/runs/38845053605)で不一致を検出したため、この操作目的に沿う期待へ修正した。修正後のTab回帰は6構成各3反復、18件が成功した。アプリの追加変更はなく、最終HEADの必須CIで全458件を確認する。差分は独立レビューでも確認した。

## 実AIと画面・動画

コミット `b90399c` のPages previewで、desktop 1280×900とmobile 390×844を別の録画として実行した。ダミー入力は豆腐150g・キャベツのみ。各1回の明示送信でHTTP 200、`no-store`、表示・コピーした依頼文全文との一致を確認した。入力・コピー・プレビューだけでは送信せず、回答後のコピーとプレビュー開閉でも追加送信しなかった。

両方とも既存の `@cf/meta/llama-3.1-8b-instruct-fast` で、desktopは433文字、mobileは438文字の回答だった。見出し6個・リスト5個をMarkdownとして表示し、pageerror・requestfailedは0。QA・録画・cleanupはすべてpassed。初回3Bの実回答2件では材料の重複や不自然な日本語を観測し、以前候補生成で使っていた8Bを再利用した。限られたサンプルの比較で、料理の正しさを保証するものではない。

[デスクトップ](../media/desktop.png)・[スマホ](../media/mobile.png)・[操作動画](../media/demo.mp4)はこの実AI実行から更新した。動画はH.264、1280×900、13.64秒。ffprobeとフレームdecodeで確認し、画像・動画フレームも視認した。照合値は[集計JSON](direct-ai-verification-2026-10-16.json)を参照。

ローカルWranglerはremote proxy sessionの作成に失敗したため、実AI確認はPages previewへ切り替えた。認証権限やプランは拡張していない。previewは検証用の一時配信先で、最終公開先は既存のPages本番とする。

## 確認していない範囲

実機iPhone／Android、実機IME・ソフトウェアキーボード、スクリーンリーダーは未検証。自由文の回答には材料・NG条件の自動照合がなく、調理前の確認が必要。Free枠と出力トークン上限による失敗・回答の途切れは残る。
