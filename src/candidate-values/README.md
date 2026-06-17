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

候補絞り込みでは、将来的に以下を検索対象にします。

```txt
value + aliases + romaji
```

既存の `src/suggestions.ts` に接続するときは、`buildCandidateSearchSynonyms()` を使って `Record<string, string>` に変換できます。

## 一緒に出す料理の具体化

`pairing-targets.ts` では、ラーメン、パスタ、鍋、うどん、そば、カレー、ハンバーグ、オムライス、ドリア、ピザ、サンドイッチ、シチュー、グラタンなどを、一般的な主要バリエーションまで展開しています。

例:

- ラーメン → 醤油ラーメン、味噌ラーメン、塩ラーメン、豚骨ラーメン
- パスタ → ミートソースパスタ、カルボナーラ、ペペロンチーノ、和風パスタ
- 鍋 → 寄せ鍋、キムチ鍋、豆乳鍋、ちゃんこ鍋、水炊き
