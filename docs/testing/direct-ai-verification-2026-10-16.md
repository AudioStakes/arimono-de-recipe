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
| `CI=1 npm run check` | exit 0。format・lint・typecheck・build・unit・structure・6構成E2Eを完了。446 passed、失敗・skip・flaky 0 |
| `npm run audit:dependencies` | exit 0、found 0 vulnerabilities |
| UX修正後のfocused Chromium E2E | exit 0、62 passed |
| 未確定入力コピー修正後のfocused E2E | exit 0、34 passed。新依頼文のコピー一致・旧signalのabort・回答消去・送信再有効・再送信を確認 |
| 独立したUX再確認 | exit 0、4サイズ41項目、pageerror 0。応答はモック |
| 既存8Bモデル切替後のFunction unit | exit 0、19 passed |
| 同切替後の`npm run typecheck`・Pages Function build | exit 0、Compiled Worker successfully |

全checkはUI最終版 `ab50dad` で実行した。その後のアプリ変更は、既存8Bモデルを再利用するFunctionの定数1行のみで、対応unit・型検査・Functionコンパイルを追加実行した。UIを変えずにローカル全checkは重複実行せず、PRの必須CIでは全checkを実行する。

## 実AIと画面・動画

コミット `b90399c` のPages previewで、desktop 1280×900とmobile 390×844を別の録画として実行した。ダミー入力は豆腐150g・キャベツのみ。各1回の明示送信でHTTP 200、`no-store`、表示・コピーした依頼文全文との一致を確認した。入力・コピー・プレビューだけでは送信せず、回答後のコピーとプレビュー開閉でも追加送信しなかった。

両方とも既存の `@cf/meta/llama-3.1-8b-instruct-fast` で、desktopは433文字、mobileは438文字の回答だった。見出し6個・リスト5個をMarkdownとして表示し、pageerror・requestfailedは0。QA・録画・cleanupはすべてpassed。初回3Bの実回答2件では材料の重複や不自然な日本語を観測し、以前候補生成で使っていた8Bを再利用した。限られたサンプルの比較で、料理の正しさを保証するものではない。

[デスクトップ](../media/desktop.png)・[スマホ](../media/mobile.png)・[操作動画](../media/demo.mp4)はこの実AI実行から更新した。動画はH.264、1280×900、13.64秒。ffprobeとフレームdecodeで確認し、画像・動画フレームも視認した。照合値は[集計JSON](direct-ai-verification-2026-10-16.json)を参照。

ローカルWranglerはremote proxy sessionの作成に失敗したため、実AI確認はPages previewへ切り替えた。認証権限やプランは拡張していない。previewは検証用の一時配信先で、最終公開先は既存のPages本番とする。

## 確認していない範囲

実機iPhone／Android、実機IME・ソフトウェアキーボード、スクリーンリーダーは未検証。自由文の回答には材料・NG条件の自動照合がなく、調理前の確認が必要。Free枠と出力トークン上限による失敗・回答の途切れは残る。
