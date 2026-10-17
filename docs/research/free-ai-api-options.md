# 無料AI APIと利用上限の調査

確認日: 2026-10-17。対象は公開レシピアプリから呼べるテキスト生成API。
主要31提供元を公式資料で確認した一覧であり、世界中のサービスや全モデルを列挙したものではない。
無料のチャット画面、開発用の評価キー、期限付きの試用、継続無料APIを区別する。
実AI送信、アカウント残高の参照、契約・秘密情報の変更は行っていない。

## 比較

| 提供元 | 無料範囲・課金の境界 | このアプリでの判断 | 一次資料 |
| --- | --- | --- | --- |
| Cloudflare Workers AI | Workers Freeは10,000 neurons/UTC日。枠終了でエラー。Paidは超過課金、一部モデルは有料限定 | 第一候補。Free契約と固定モデルを維持 | [料金](https://developers.cloudflare.com/workers-ai/platform/pricing/)、[制限](https://developers.cloudflare.com/workers-ai/platform/limits/) |
| GroqCloud Free | `openai/gpt-oss-20b`は30 RPM、1,000 RPD、8K TPM、200K TPD。組織で共有、超過429。Developerへの変更後は課金 | Free専用アカウントを確認した場合の任意候補 | [制限](https://console.groq.com/docs/rate-limits)、[課金](https://console.groq.com/docs/billing-faqs)、[アプリ提供の規約](https://console.groq.com/docs/legal/services-agreement) |
| Gemini Developer API | Flash-Lite等に無料枠。正確な割当はプロジェクトで確認。無料入力・出力の改善利用、人手レビューあり。未成年向け制限、EEA・英国・スイスはPaid必須 | 汎用公開アプリへの無料追加は保留 | [料金](https://ai.google.dev/gemini-api/docs/pricing)、[制限](https://ai.google.dev/gemini-api/docs/rate-limits)、[規約](https://ai.google.dev/gemini-api/terms) |
| OpenRouter Free | 無料モデル25以上、20 RPM・50 RPD。`:free`を指定可能。上流の規約・ログ方針が別々 | 送信先とデータ条件の追加確認が必要。有料fallbackを混ぜない | [料金](https://openrouter.ai/pricing/)、[ログ方針](https://openrouter.ai/docs/guides/privacy/provider-logging) |
| Mistral Studio Free | カードなしFree mode。組織のRPS・TPM・月間枠、超過429。評価・試作向けの説明、学習利用のopt-outあり | 公開本番とデータ条件を確定するまで保留 | [開始手順](https://docs.mistral.ai/getting-started/quickstarts/developer/first-api-request)、[制限](https://help.mistral.ai/en/articles/698531-why-am-i-hitting-api-rate-limits-and-how-do-i-increase-them)、[データ](https://help.mistral.ai/en/articles/347617-do-you-use-my-user-data-to-train-your-artificial-intelligence-models) |
| Cerebras | 恒久無料なし。決済手段の検証後に$5・30日。期限・残高終了で停止 | 期限付き試用。旧Free表記を採用しない | [現行FAQ](https://inference-docs.cerebras.ai/support/rate-limits) |
| Hugging Face Inference Providers | 現行Free Usersの月間creditsはNone。購入・有料契約付属枠とは区別 | 継続無料の候補から除外 | [現行料金](https://huggingface.co/docs/inference-providers/pricing) |
| GitHub Models | 2026-07-30にPlayground・Inference API等を全面終了 | 利用不可 | [終了告知](https://github.blog/changelog/2026-07-01-github-models-is-being-fully-retired-on-July-30-2026/) |
| NVIDIA NIM | Developer Programの無料プロトタイピング。開発・テストと本番を区別 | 無料本番APIとして採用しない | [開発者向け案内](https://developer.nvidia.com/nim) |
| Cohere | 評価キーは1,000 calls/月、試用20 RPM等。Production keyは有料 | 評価用途 | [キーと制限](https://docs.cohere.com/docs/rate-limits) |
| SambaNova Cloud | 制限ページはFreeを掲載する一方、Plansは初回利用に決済・購入が必要と説明 | 公式資料の不一致が解消するまで保留 | [制限](https://docs.sambanova.ai/docs/en/models/rate-limits)、[Plans](https://cloud.sambanova.ai/plans) |
| Together AI | 無料試用なし、最低$15の前払い。Auto-rechargeは別設定 | 無料ではない | [クレジット](https://docs.together.ai/docs/billing-credits) |
| Fireworks AI | $1の一度限りのstarter credit。Auto Reload無効なら残高終了で停止、後払い契約は別 | 試用のみ | [残高終了の扱い](https://docs.fireworks.ai/faq-new/billing-pricing/what-happens-when-i-finish-my-1-dollar-credit) |
| DeepSeek API | テキスト生成はトークン課金。無料チャットや一時無料Search/Fetchとは別 | 継続無料枠の根拠を確認できず除外 | [料金](https://api-docs.deepseek.com/quick_start/pricing/) |
| Anthropic API | 現行の有料Max/Teamには月次API credits。無料開始APIや他社Proの特典ではない | 対象有料契約の付属特典として区別 | [契約付属credits](https://platform.claude.com/docs/en/about-claude/api-credits-for-subscribers) |
| AWS/Bedrock・Nova直接API | Bedrock向け新規Free planは最大$200・最大6か月。別にNova公式ガイドは直接APIの無料開発を案内 | クラウド試用と直接APIを区別。直接APIの枠・対象国・本番条件・課金境界は確認できず保留 | [Free plan](https://aws.amazon.com/about-aws/whats-new/2025/07/aws-free-tier-credits-month-free-plan/)、[Nova直接API案内](https://docs.aws.amazon.com/nova/latest/nova2-userguide/getting-started-nova-2.html) |
| Azure/Foundry | Free Trialは$200・30日。モデル別の適用条件は別。spending limit解除後は課金 | 期限付きクラウド試用 | [停止条件](https://learn.microsoft.com/en-us/azure/cost-management-billing/manage/subscription-disabled) |
| Alibaba Model Studio/Qwen | 対象モデルに通常各100万tokens程度・90日。標準は超過課金。Free Quota Onlyの反映中にも課金し得る | 無課金保証の候補から除外 | [無料枠と停止設定](https://www.alibabacloud.com/help/en/model-studio/new-free-quota) |
| IBM watsonx.ai | 300,000 tokens/月のFree Toolbox playground。本番向けはEssentials。新規Cloudアカウントはカード/PAYGだがLiteは利用可能 | Lite APIの公開本番利用と枠終了時の停止契約を確認できず保留 | [料金](https://www.ibm.com/products/watsonx-ai/pricing)、[アカウント](https://cloud.ibm.com/docs/account?locale=en&topic=account-accounts) |
| AI21 | カード不要の$10・7日間。評価製品は内部評価向け | 継続無料の公開本番枠ではない | [料金](https://www.ai21.com/pricing/)、[規約](https://www.ai21.com/terms-policies/terms-of-use/) |
| OVHcloud AI Endpoints | 初回Public Cloudクレジットは1か月。匿名playgroundは2回/分/IP/モデル。現在のレシピ向けGPT OSS等は有料 | 継続無料の公開チャットAPIとしては確認できず保留 | [無料API説明](https://www.ovhcloud.com/en-ca/public-cloud/free-ai-api/)、[制限](https://docs.ovhcloud.com/en/guides/public-cloud/ai-machine-learning/ai-endpoints-getting-started)、[カタログ](https://www.ovhcloud.com/en/public-cloud/ai-endpoints/catalog/) |
| Scaleway Generative APIs | 100万tokens無料、その後は課金。使用を止める請求上限を設定できない | 今回の追加課金禁止条件では除外。無料枠の更新周期は断定しない | [公式FAQ](https://www.scaleway.com/en/docs/generative-apis/faq/) |
| Tencent Hunyuan Lite/TokenHub | 旧プラットフォームは2026-09-30終了。移行用無料枠は3か月。後払いを有効にした移行手順では枠終了後に従量課金。TokenHubはhunyuan-lite非対応 | 旧Lite無料APIの紹介を現在の候補として使わない | [終了公告](https://cloud.tencent.com/announce/detail/2287)、[移行ガイド](https://cloud.tencent.com/document/product/1823/131382) |
| Baidu Qianfan ERNIE Speed/Lite/Tiny | 2025-04-11更新の公式公告は入出力単価0・長期提供予定。実名認証が必要 | 無料提供は確認。現在の対象API、日本からの認証、公開利用・保存条件を確認できず保留。国際向け有料ERNIE 5.0と区別 | [無料公告](https://ai.baidu.com/ai-doc/WENXINWORKSHOP/wlwg8f1i3)、[国際価格](https://intl.cloud.baidu.com/en/product/qianfan_campaign.html) |
| SiliconFlow中国版 | 実名認証後の無料モデル区分は請求0、限流超過429。学習なし・推論後削除を説明。エンドユーザー同意が必要 | 継続無料候補だが、現行無料ID・日本からの認証・価格変更時の請求停止を確認できず保留 | [利用制限](https://docs.siliconflow.cn/docs/userguide/faqs/rate-limit-and-upgradation)、[データ条件](https://docs.siliconflow.cn/docs/legals/privacy-policy) |
| SiliconFlow国際版 | 初回$1と従量後払い。月間支出上限はあるが、0ドル設定と完全停止の詳細は未確認 | 中国版の無料条件を流用しない | [料金・FAQ](https://www.siliconflow.com/pricing) |
| Perplexity API | 現行案内は無料APIクレジットなし。購入・自動補充の従量課金。APIデータの記録・学習はしないと説明 | 有料。消費者向け契約と区別 | [公式プラン比較](https://www.perplexity.ai/help-center/en/articles/11187416-which-perplexity-subscription-plan-is-right-for-you) |
| xAI API | 継続無料枠は確認できず。2024年の月$25施策は同年末まで。請求上限$0なら前払枯渇で拒否。学習同意と引換のcredit施策がある場合も | 現在の継続無料枠としては採用しない | [旧施策](https://x.ai/news/api)、[現行請求](https://docs.x.ai/console/billing)、[データFAQ](https://x.ai/legal/faq-enterprise) |
| DeepInfra | 一般向け継続無料枠は確認できず。DeepStartは創業2年以内・調達$250K〜$10M等の審査制、creditは1年失効 | 今回の一般公開アプリ向け無料枠とは区別。保存・学習方針には他社モデル等の例外あり | [DeepStart](https://deepinfra.com/deepstart)、[データ条件](https://docs.deepinfra.com/account/data-privacy) |
| Nebius Token Factory | カード必須の$1・30日間。残高マイナスは月初または閾値でカードへ自動請求 | 追加課金禁止条件では除外。旧「不足時停止」の説明を採用しない | [現行請求](https://docs.tokenfactory.nebius.com/other-capabilities/billing-new) |
| Replicate | 無料モデルは回数限定。前払でも処理が残高を超えると後日カード請求する例外あり | 継続無料・超過なしの条件では除外 | [無料枠](https://replicate.com/collections/try-for-free)、[前払仕様](https://replicate.com/docs/topics/billing/prepaid-credit) |
| Novita | 継続無料モデルは確認できず。紹介等による有限credit施策と、利用可能残高を要求するAPIは確認 | 無料専用の課金停止・公開利用・保存条件を確定できず保留 | [公式施策](https://blogs.novita.ai/earn-500-free-credits-build-faster-with-deepseek-llama-qwen-on-novita-ai/)、[導入資料](https://docs.novita.ai/guides/introduction) |

## モデルと送信先

### ローカル実行という別の選択肢

OllamaとLM Studioは利用者のPC上でモデルを動かしてローカルAPIを提供できる。
API提供元への従量課金を避けられる一方、モデルのライセンス、PCのメモリ・GPU・電力が必要になる。
公開Pages Functionから利用者のlocalhostを呼ぶ構成ではないため、そのまま公開APIの選択肢には追加しない。
[Ollama API](https://docs.ollama.com/api/introduction)、[LM Studio server](https://lmstudio.ai/docs/developer/core/server)。

WebLLMはWebGPUを使い、ブラウザ内でLlama・Gemma等を実行できる。
外部API料金を避ける候補だが、モデルのダウンロード・対応GPU・新しい推論runtimeが必要になる。
今回の小さなPages Function拡張とは別の設計判断として扱う。
[WebLLM](https://webllm.mlc.ai/docs/)。

### 今回の呼び出し候補

Cloudflareでは既存Llama 3.1に加え、Qwen3とGemma 4を固定候補にする。
Groqの追加にはFree契約の確認とサーバー側のsecretが必要。
ブラウザへAPI keyを渡さず、有料モデルへの自動fallback・自動retryは行わない。

旧`llama-3.1-8b-instruct-fast`は現在のモデルページで確認できなかったため、
現行の非fast FP8モデルへ置き換える。GroqのQwen3.8はPreviewで本番利用を勧めないため、
productionのGPT OSS 20Bへ変更する。これはGroqで動く公開weightモデルであり、OpenAI APIの残高は使わない。
[Llamaモデル](https://developers.cloudflare.com/workers-ai/models/llama-3.1-8b-instruct-fp8/)、
[Groqモデル区分](https://console.groq.com/docs/models)、[推論指定](https://console.groq.com/docs/reasoning)。

| モデルID | 上限・見積もり | 一次資料 |
| --- | --- | --- |
| `@cf/meta/llama-3.1-8b-instruct-fp8` | 現行のFP8モデル。context 32K、入力13,778・出力26,128 neurons/100万tokens | [料金](https://developers.cloudflare.com/workers-ai/platform/pricing/) |
| `@cf/qwen/qwen3-30b-a3b-fp8` | context 32,768、`max_tokens`を明示。入力4,625・出力30,475 neurons/100万tokens | [モデル](https://developers.cloudflare.com/workers-ai/models/qwen3-30b-a3b-fp8/)、[料金](https://developers.cloudflare.com/workers-ai/platform/pricing/) |
| `@cf/google/gemma-4-26b-a4b-it` | context 256K、`max_completion_tokens`を明示。入力9,091・出力27,273 neurons/100万tokens | [モデル](https://developers.cloudflare.com/workers-ai/models/gemma-4-26b-a4b-it/)、[料金](https://developers.cloudflare.com/workers-ai/platform/pricing/) |
| `openai/gpt-oss-20b` (Groq) | `max_completion_tokens`を固定。productionモデル。low reasoningとinclude_reasoning=false。TPMのため長文は単発でも制限され得る | [モデル](https://console.groq.com/docs/model/openai/gpt-oss-20b)、[API](https://console.groq.com/docs/api-reference) |

Cloudflareは標準推論の内容を保持・学習利用しないと説明する。保存・ログ・キャッシュの機能は別。
Groqも通常推論は保持しないが、障害・不正利用の調査で最大30日保存する場合がありopt-outを案内する。
送信先の変更は利用者へ表示する。
[Cloudflareのデータ方針](https://developers.cloudflare.com/workers-ai/platform/data-usage/)、
[Groqのデータ方針](https://console.groq.com/docs/your-data)。

## ChatGPT Proと62,500クレジット

ChatGPT/Codexの契約・creditsとPlatform APIのトークン課金は別の体系である。
62,500の表示元・単位・対象アカウント・期限が未確認なので、USDやAPI tokensへの換算を実装しない。
[契約とAPIの料金](https://learn.chatgpt.com/docs/pricing)、
[API料金](https://developers.openai.com/api/docs/pricing)。

公式Sign in with ChatGPTには利用者本人が認可するプラン共有の経路があるが、
所有者のPro資格情報を匿名の公開アプリ利用者へ共用する仕組みとしては扱わない。
remote-hosted appの適用手続きとログイン導入の判断が必要となる。
[公式の共有経路](https://developers.openai.com/siwc/token-sharing-open-source)、
[アカウント境界](https://developers.openai.com/siwc/token-sharing-open-source/profiles-and-sessions)。

APIのorg/project hard spend limitも、公式に反映遅延と少額超過が明記されている。
これだけで「62,500を絶対に超えない」と説明してはいけない。
追加支払いゼロが必須で残高・換算・価格の上限を確定できない間、OpenAI API送信は無効のままとする。
[公式spend limits](https://developers.openai.com/api/docs/guides/spend-limits)。

## 上限の設計

接続元ごとに1分3回・UTC日10回、アプリ全体はUTC日100回を初期上限とする。
さらにモデルの最大出力と入力の保守的な上限から、提供元ごとの使用量を送信前に予約する。
Cloudflare用の見積もりは日9,000 neuronsまで、Groq用は無料TPM/TPDより少ない枠を使う。
Groqのテンプレート分512tokensは実装上の余裕であり、公式に保証されたtoken上限ではない。
通常の生成依頼文が送れることをテストし、見積もりが単発枠を超える場合は待機を案内せず別モデルを案内する。
これは追加の過剰利用防止策であり、実際の課金停止には提供元のFree契約を維持する必要がある。
他のアプリによる同じアカウントの消費、料金改定、契約変更はこのアプリの台帳で制御できない。

D1の同一transactionで全bucketを予約し、CHECK制約に違反したら全体をrollbackする。
DB欠如・障害・未確認価格・不明モデルでは送信しない。
失敗・timeout・cancelでも上流が課金しなかった証拠にならないため予約を返却しない。
将来の残高予算は日次bucketと分離し、再deployや日付変更で復活させない。
[D1 transaction](https://developers.cloudflare.com/d1/worker-api/d1-database/#batch)、
[Pagesからのbinding](https://developers.cloudflare.com/pages/functions/bindings/#d1-databases)。

匿名のまま厳密な一人単位の制限はできない。直通Pagesの`CF-Connecting-IP`を
日替わりHMACで仮名化し、IPv6は/64でまとめる。NATでは複数人をまとめ、VPN等では回避され得る。
raw IP・食材・依頼文・回答は台帳に保存せず、期限切れのbucketは削除する。
同一zone Worker等のproxyを前段へ追加する場合は信頼境界を再検討する。
[Cloudflareのheader仕様](https://developers.cloudflare.com/fundamentals/reference/http-headers/#cf-connecting-ip)。
