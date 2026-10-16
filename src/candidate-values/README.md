# candidate-values

レシピ項目ごとの候補値を管理するためのファイル群です。

`src/data.ts` から読み取る候補値を、シンプルな `CandidateValue[]` として定義しています。

## 方針

YAGNI を優先します。

- `CandidateValueGroup` は持たない
- `keywords` は持たない
- `itemTypes` は持たない
- 候補値はレシピ項目ごとの `CandidateValue[]` として管理する
- `使えない・持っていない食材・調味料` だけ、`食材・材料 + 調味料` から合成する
- カテゴリ表示やグルーピングが必要になったら、その時点で追加する

## 型

```ts
export type CandidateValue = {
  readonly value: string;
  readonly aliases?: readonly string[];
  readonly romaji?: readonly string[];
  readonly priority?: number;
};
```

## 対応するレシピ項目

- `food-materials.ts`: 食材・材料
- `seasonings.ts`: 調味料
- `ng-foods-and-seasonings.ts`: 使えない・持っていない食材・調味料
- `target-dishes.ts`: 作りたい料理
- `dish-types.ts`: 旧候補値（現在のフォームでは直接表示しない）
- `cooking-methods-and-tools.ts`: 調理方法・調理器具
- `pairing-targets.ts`: 一緒に出す料理
- `cook-times.ts`: 調理時間
- `ease.ts`: 旧候補値（現在のフォームでは直接表示しない）
- `recipe-directions.ts`: レシピの方向性
- `other-request-examples.ts`: その他の要望の入力例

## 検索用テキスト

候補絞り込みでは、以下を検索対象にします。

```txt
value + aliases + romaji
```

`buildCandidateSearchSynonyms()` で `Record<string, string>` に変換し、`src/suggestions.ts` から利用します。

## 食材・材料の初期候補

`src/data.ts` の `featuredComboOptions.materials` に、卵・豆腐・肉・魚・野菜を組み合わせた日常向けの20件を定義します。
未入力時はこの20件から選択済みの材料を除いて表示します。
検索時は材料一覧全体を対象に、一致する初期候補を設定順で先に、その他の一致候補を従来の五十音順で続けます。検索結果は最大40件です。

選定には[タキイ種苗の2025年度野菜調査](https://www.takii.co.jp/info/news_251211.html)、[農畜産業振興機構の鶏肉・鶏卵購買調査](https://www.alic.go.jp/joho-c/joho05_003998.html)、[マイボイスコムの豆腐調査](https://www.myvoice.co.jp/biz/surveys/24602/index.html)、[水産庁の水産物消費資料](https://www.jfa.maff.go.jp/j/kikaku/wpaper/r02_h/trend/1/t1_1_2.html)を参考にしています。
調査時点・対象・指標が異なるため、全国の料理での使用頻度上位20品を表す統計ランキングではありません。

## 一緒に出す料理の具体化

`pairing-targets.ts` では、ラーメン、パスタ、鍋、うどん、そば、カレー、ハンバーグ、オムライス、ドリア、ピザ、サンドイッチ、シチュー、グラタンなどを、一般的な主要バリエーションまで展開しています。

例:

- ラーメン → 醤油ラーメン、味噌ラーメン、塩ラーメン、豚骨ラーメン
- パスタ → ミートソースパスタ、カルボナーラ、ペペロンチーノ、和風パスタ
- 鍋 → 寄せ鍋、キムチ鍋、豆乳鍋、ちゃんこ鍋、水炊き
