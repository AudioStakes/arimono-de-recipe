# 2026-10-16 公開前検証

既存の[PR #41](https://github.com/AudioStakes/arimono-de-recipe/pull/41)、[PR #42](https://github.com/AudioStakes/arimono-de-recipe/pull/42)、[PR #43](https://github.com/AudioStakes/arimono-de-recipe/pull/43)をCI成功後に統合し、main `43376a5` を起点として公開準備を行った。

## 修正とレビュー

UX・正しさ・セキュリティ・配信性能の読み取り専用レビューと、実装担当による修正・再検証を分けて行った。依頼文の原本、同一オリジンの `/api/recipe`、保存なしの境界を維持した。

| 確認した問題 | 修正 |
| --- | --- |
| 編集中のBackspace／Deleteで材料全体が消える | 編集inputのキー操作を材料削除から除外 |
| 材料名を変更すると使用指定と分量が消える | 明示的な編集前後の対応で設定を保持し、既存材料への統合も検証 |
| おまかせ材料の入力分量が依頼文から消える | 通常材料の条件へ指定量を出力し、コピー・全文送信を検証 |
| 材料の使い方の矢印操作でfocusが消える | 再描画後のradioへfocusを復元 |
| 候補のキーボード選択が画面外へ隠れる | 候補パネル内で選択項目をスクロール表示 |
| FirefoxのIME終了後に古い予約描画が候補focusを奪う | composition中かつ入力focus中だけ予約描画を適用 |
| モバイルパネル表示中に背面がスクロールする | root／bodyのスクロールを固定し、閉じる・Escape・resizeで解除 |
| コピー失敗時に手動選択する本文が閉じている | 本文を展開してfocus・選択 |
| 本文選択のドラッグでモバイルパネルが閉じる | 開閉操作の開始場所を見出し・要約に限定し、pointercancelでは開閉しない |
| 長い材料名で320px画面が横にはみ出す | fieldsetの最小幅と長い文字列の折り返しを制御 |
| 調理時間スライダーが数値indexとして読み上げられる | 現在の時間をaria-valuetextへ反映 |
| 狭い出力パネルのボタンが不自然に改行し、コピー成功時に高さが変わる | 実幅に応じたカード配置と短い表示。読み上げ案内は維持 |

提供済みのロゴを見出し・favicon・Apple touch icon・OGPへ統合し、不要になった旧画像を削除した。公開URLとOGP画像URLを絶対URLで指定した。

## 検証範囲

Chromium・Pixel 7相当では全E2Eを実行する。Firefox・WebKit・iPhone 13相当・iPad Pro 11相当では入力、素材表示、キーボード、コピーと失敗回復、AI送信の2経路、候補選択と調理タブ、修正箇所の回帰を確認する。CIにも同じブラウザを導入し、本番ビルドを配信して検証する。

| コマンド・確認 | 結果 |
| --- | --- |
| `npm run check` | exit 0。format・lint・型検査・build・unit・structure・E2Eを完了。E2Eは366 passed、失敗・skip・flaky 0 |
| `CI=1 npm run check` | exit 0。CIと同じ2 workersでも366 passed、失敗・skip・flaky 0 |
| `npm run audit:dependencies` | exit 0、found 0 vulnerabilities（依存修正前は7件） |
| `npx wrangler pages functions build functions --outfile /private/tmp/arimono-pages-function.js` | exit 0、Compiled Worker successfully |
| 追加UXの独立ブラウザ操作 | Chromium・Firefox・WebKitでexit 0、pageerrorなし |
| 入力・コピー・スマホ表示の録画 | QA・録画・cleanupすべてpassed、AI送信0回 |
| 動画のffprobeとフレーム確認 | H.264、1280×900、10.28秒。デスクトップとスマホ画面を目視確認 |

ローカル実行はNode.js 24.18.0、CIはNode.js 22。PlaywrightのJSON・HTMLレポートと失敗時traceを保存する。初回のFirefox検証ではIME完了直後のEnter待機条件を修正し、編集途中のHMR再読み込みによる失敗を分離して再実行した。現在は既存サーバーを再利用せず、アプリは`dist/`を配信する。独立したTypeScript combo harnessだけは別ポートのViteで検証し、本番ビルドへ含めない。

CIのmobile Safari相当では、自由入力7項目を連結した1テストが30秒の累積制限を超えた。traceで各操作は成功していることを確認し、同じ制限と全assertを維持して項目ごとの独立テストへ分割した。操作に1秒ずつ遅延を加えた条件で元の失敗を再現し、分割後は7件すべて成功した。6構成×7項目×3反復も126 passedで、timeout延長・retry・skipは追加していない。

別のローカル全件実行ではChromiumが材料入力の途中で応答せず1件失敗した。traceを保存し、同一テストを1 worker・5 workersで各12回実行したが、24回すべて成功して停止は再現しなかった。高負荷の共有環境での一過性停止として原因は未確定のまま記録し、テストを変更せず2 workersで全件を再実行して成功した。[修正後のGitHub CI](https://github.com/AudioStakes/arimono-de-recipe/actions/runs/38826011079)も成功している。

画像と動画は[デスクトップ](media/desktop.png)、[スマホ幅](media/mobile.png)、[操作動画](media/demo.mp4)。動画は実際の材料入力・分量指定・依頼文コピーを検証した実行を収録している。

## 公開設定と運用

- リポジトリをpublicに変更し、descriptionと技術タグを設定した。
- 動作確認後の公開URLをリポジトリのWebsite欄に設定した。
- mainはPR経由と最新mainに対する`check`成功、会話解決を必須にし、管理者にも適用した。force pushとブランチ削除は禁止する。個人開発のため必須承認数は0件。
- GitHubのPrivate vulnerability reportingを有効化した。
- ソース・到達可能なGit履歴のテキスト・Issue/PR本文の秘密情報パターン検査は検出0件。画像の再利用許諾や第三者の権利を自動検査で保証するものではない。再利用ライセンスは未設定のまま維持した。
- Cloudflare Workers FreeをDashboardで確認した。有料プランへの変更、AI Gateway、保存・解析・ログインの追加は行っていない。
- 無料枠はアカウント共有で、濫用によるAI可用性低下は残る。公開先・上限・停止手順は[公開手順](deployment.md)に記録した。

今回は所有者がPRのマージ・リポジトリ公開・main保護・デプロイを明示的に依頼した。通常のリポジトリ方針を恒常的に変更せず、この依頼の範囲で実施している。

## 本番デプロイ後の検証

[公開アプリ](https://arimono-de-recipe.pages.dev/)は、PR #44・#45を統合したmain `aa14135` からビルド・デプロイした。`npm run build` と `npx wrangler pages deploy dist --project-name arimono-de-recipe --branch main` はexit 0。Production deployment `35dc53c4` のSourceが `aa14135` であることと、公開URLのHTTP 200を確認した。

| 公開URLの確認 | 結果 |
| --- | --- |
| Desktop Chromium・Firefox・WebKit | 材料入力・150gの保持・依頼文・コピー経路・横幅を確認、3構成成功 |
| Pixel 7・iPhone 13・iPad Pro 11相当 | 同じ操作とモバイル本文パネルを確認、3構成成功 |
| インストール済みGoogle Chrome | version 155.0.8059.80のヘッドレス操作も成功。ユーザープロファイルは使用せず |
| 自動送信 | 入力・コピー・本文確認では各構成0回 |
| クリップボード本文 | Chromiumのdesktop・Pixel相当とGoogle Chromeで依頼文全文との一致を確認。他の構成は成功表示まで確認 |
| 実AI・候補 | desktop Chromiumで明示送信1回、HTTP 200、3候補の選択と作り方の表示に成功 |
| 実AI・依頼文全文 | 明示送信1回、HTTP 200、コピー本文との完全一致と506文字の回答を確認 |
| APIキャッシュ | 両送信と不正リクエストの応答で `Cache-Control: no-store` |
| API拒否 | GET 405、異なるOrigin 403、不正本文400、非JSON 415。いずれも想定するエラーcode |
| 配信ヘッダー | CSP・nosniff・frame拒否・no-referrerを確認 |
| ブラウザーエラー | 6構成とGoogle Chromeですべてpageerror・requestfailed 0 |

公開URLの操作スクリプトはexit 0。実AIの入力には「豆腐150g・キャベツ」だけを使い、個人情報は送っていない。結果の要約と照合値は[本番検証JSON](production-verification-2026-10-16.json)に保存した。

### 小画面・横画面とMacの実ブラウザー

Chromium・WebKitの320×568と844×390でも、材料と150gの入力、下部コピー、本文パネル開閉、入力までのスクロール・focus復帰を追加確認した。4実行すべてexit 0、QA・録画・動画フレーム確認も成功した。各checkpointの横幅はviewportと一致し、API送信・pageerrorは0。Chromiumでは隔離contextに通常のクリップボード権限を付与して本文を読み返し、WebKitではコピー経路と表示を確認した。

当初Macがロックされていたため実UI操作を保留したが、所有者の解除後、このMacのChrome・Safariでも公開URLを操作した。両方で豆腐・キャベツと150gの入力、依頼文への反映を確認した。Chromeはコピー本文1,929文字の完全一致を確認。Safariはコピー後に実際の貼り付けを行い、依頼文の冒頭・豆腐150g・キャベツを確認した。貼り付け先のテスト入力は確認後に削除した。Safariの全文比較は行っていない。AI送信ボタンは操作していない。

## 検証の限界

実機のiPhone／Android、実機IME・ソフトウェアキーボード、スクリーンリーダー、低速回線でのフィールド性能をこのエミュレーションで保証しない。Macの実ブラウザー確認も、実機スマートフォンの代わりにはならない。モバイルWebKitの背景スクロールはCSSロックと解除を確認し、wheelによる実スクロール抑止はdesktop 3エンジンとmobile Chromiumで検証した。AIの全回答やアレルギー対応は保証しない。
