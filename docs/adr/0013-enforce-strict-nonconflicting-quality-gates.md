# Enforce strict, nonconflicting quality gates

2026-10-04、所有者はエージェントのモデルによる品質差を小さくするため、lint・formatterを厳格化し、不足する検査を追加する方針を承認した。

BiomeをJavaScript・TypeScript・JSON・CSS・HTMLのformatterとlintの基準とする。HTMLの意味検査、Markdown、YAMLは専用エンジンで補い、同じファイルの整形を複数のツールに担当させない。TypeScriptはブラウザ・Function・テストに加え、保守用スクリプトも検査する。各ツールの担当、選択した例外、能力の限界は[品質ゲート](../quality-gates.md)に置く。

警告、skip、onlyもゲートの失敗にする。ADR 0006の一時skip例外は終了し、不安定なテストは証拠を記録して修正する。未解決の失敗を成功として扱わない。

厳格化は違反の実ファイルと実CLIで検証し、正しい入力が通ること、formatterの二巡目に差分がないことも確認する。既存の静的構成、コピー依頼文の基準、API・プライバシー境界は維持する。
