import { describe, expect, test } from "vitest";
import { buildPrompt, makeEmptyPromptData } from "../../src/prompt";
import { promptEvaluationCases } from "../fixtures/prompt-evaluation";

describe("buildPrompt", () => {
  test("ケース1: 基本入力ありの構造化プロンプトを出力する", () => {
    const prompt = buildPrompt(
      makeEmptyPromptData({
        requestIntent: "pairing",
        materials: ["しろ菜", "しめじ", "豆腐150g"],
        materialUseMode: "specified",
        materialRequests: [
          {
            id: "material-1",
            name: "しろ菜",
            usage: "required",
            useUpAmountMode: "as-written",
            useUpAmount: "",
          },
          {
            id: "material-2",
            name: "豆腐150g",
            usage: "use-up",
            useUpAmountMode: "as-written",
            useUpAmount: "",
          },
        ],
        recipeCount: "one",
        recipeRoles: ["副菜・一品"],
        cookingTools: ["ヘルシオ ホットクック"],
        pairingTargets: ["餃子"],
        servings: "大人2人、子供1人、幼児1人",
        servingsMode: "custom",
        recipeDirections: ["あっさり"],
      }),
    );

    expect(prompt).toContain("## 出力テンプレート");
    expect(prompt).toContain("## 入力条件");
    expect(prompt).not.toContain("### 今回やりたいこと");
    expect(prompt).toContain("### 家にある食材・材料");
    expect(prompt).toContain("- しろ菜（必ず使う・記載量を使う）");
    expect(prompt).toContain("- 豆腐150g（使い切る・記載量を使う）");
    expect(prompt).not.toContain("### 作りたい品数\n\n1品だけ");
    expect(prompt).not.toContain("### 料理の役割・量感\n\n- 副菜・一品");
    expect(prompt).toContain("### 調理方法・調理器具");
    expect(prompt).not.toContain("### 一緒に出す料理");
    expect(prompt).toContain("### 人数・分量");
    expect(prompt).not.toContain("### 調理時間");
    expect(prompt).not.toContain("### 一緒に出す料理との相性");
    expect(prompt).toContain("加熱は指定した調理方法・調理器具だけ。");
    expect(prompt).not.toContain("★");
  });

  test("ケース2: 食材なしなら食材固有の項目を出さない", () => {
    const prompt = buildPrompt(makeEmptyPromptData({ supplementalNotes: "カレーを作りたい。" }));
    expect(prompt).toContain("### その他の要望\n\nカレーを作りたい。");
    for (const title of [
      "家にある食材・材料",
      "指定材料の扱い",
      "必ず使う食材・材料",
      "使い切りたい食材・材料",
      "作りたい料理",
    ])
      expect(prompt).not.toContain(`### ${title}`);
    expect(prompt).toContain("入力にない食材（米・麺・肉・野菜・乳製品等）は使用禁止。");
  });

  test("ケース3: 使えない食材はその他の要望として反映する", () => {
    const prompt = buildPrompt(
      makeEmptyPromptData({ supplementalNotes: "にんにくと唐辛子は使わない。" }),
    );
    expect(prompt).toContain("### その他の要望\n\nにんにくと唐辛子は使わない。");
    expect(prompt).toContain("その他の要望を守る。調味料の追加可よりも、禁止指定を優先する。");
    expect(prompt).not.toContain("## 回答前の内部確認");
    expect(prompt).not.toContain("使えない・持っていない食材・調味料");
  });

  test("ケース4: 子供・幼児ありなら配慮ルールを出す", () => {
    const prompt = buildPrompt(
      makeEmptyPromptData({
        servings: "大人2人、子供1人、幼児1人",
        servingsMode: "custom",
      }),
    );

    expect(prompt).toContain("子供・幼児には薄味で辛くせず、柔らかく小さく切る。");
    expect(prompt.match(/子供・幼児には/g)).toHaveLength(1);
    expect(prompt).toContain("〈入力の人数・分量に合う量〉");
  });

  test("ケース5: 調理時間の希望はその他の要望として出す", () => {
    const prompt = buildPrompt(makeEmptyPromptData({ supplementalNotes: "20分以内。" }));
    expect(prompt).toContain("### その他の要望\n\n20分以内。");
    expect(prompt).not.toContain("### 調理時間");
    expect(prompt).toContain("その他の要望を守る。調味料の追加可よりも、禁止指定を優先する。");
  });

  test("ケース6: 条件衝突時の出力形式を含む", () => {
    const prompt = buildPrompt(makeEmptyPromptData());

    expect(prompt).toContain("## 条件を満たせない場合");
    expect(prompt).toContain("### 難しい理由");
    expect(prompt).toContain("### 衝突している条件");
  });

  test("入力が空の項目は入力条件セクションに出さない", () => {
    const prompt = buildPrompt(
      makeEmptyPromptData({
        materials: ["豆腐"],
        supplementalNotes: "味は濃くしすぎない。",
      }),
    );

    expect(prompt).toContain("### 家にある食材・材料");
    expect(prompt).toContain("### その他の要望");
    expect(prompt).not.toContain("### 作りたい料理");
    expect(prompt).not.toContain("### 調理時間");
    expect(prompt.trimStart().startsWith("## 出力テンプレート")).toBe(true);
  });

  test("完全に未指定なら任意項目の見出しとルールを出さない", () => {
    const prompt = buildPrompt(makeEmptyPromptData());

    expect(prompt).not.toContain("## 入力条件");
    expect(prompt).not.toContain("### 今回やりたいこと");
    expect(prompt).not.toContain("- 今回やりたいこと:");
    expect(prompt).not.toContain("### 家にある食材・材料");
    expect(prompt).not.toContain("### 指定材料の扱い");
    expect(prompt).not.toContain("### 一緒に出す料理との相性");
    expect(prompt).not.toContain("### 調理器具の補足");
    expect(prompt).not.toContain("### 条件に合わせた調理のポイント");
  });

  test("食材ありなら家にない主材料を追加しないルールを出す", () => {
    const prompt = buildPrompt(
      makeEmptyPromptData({
        materials: ["卵2個", "豆腐150g"],
      }),
    );

    expect(prompt).toContain("### 家にある食材・材料");
    expect(prompt).toContain("- 卵2個");
    expect(prompt).toContain("- 豆腐150g");
    expect(prompt).toContain(
      "材料欄・手順・味の調整のすべてで、入力にない食材（米・麺・肉・野菜・乳製品等）は使用禁止。",
    );
    expect(prompt).toContain("買い足しは提案しない。");
  });

  test("合わせたい料理はその他の要望に記入し、専用の見出しへ分類しない", () => {
    const prompt = buildPrompt(
      makeEmptyPromptData({ supplementalNotes: "餃子と焼き魚に合う副菜を作りたい。" }),
    );
    expect(prompt).toContain("### その他の要望\n\n餃子と焼き魚に合う副菜を作りたい。");
    expect(prompt).not.toContain("### 一緒に出す料理");
    expect(prompt).not.toContain("### 調理器具の補足");
    expect(prompt).not.toContain("加熱は指定した調理方法・調理器具だけ。");
  });

  test("旧intentや料理・役割の値は現在のプロンプトに出さない", () => {
    expect(
      buildPrompt(
        makeEmptyPromptData({
          requestIntent: "target-dish",
          targetDish: ["カレー"],
          pairingTargets: ["餃子"],
          recipeCount: "multiple",
          recipeRoles: ["副菜・一品"],
        }),
      ),
    ).toBe(buildPrompt(makeEmptyPromptData()));
  });

  test("使い切りたい量を別指定する場合は量をそのまま出す", () => {
    const prompt = buildPrompt(
      makeEmptyPromptData({
        materials: ["キャベツ"],
        materialUseMode: "specified",
        materialRequests: [
          {
            id: "material-1",
            name: "キャベツ",
            usage: "use-up",
            useUpAmountMode: "custom",
            useUpAmount: "1/4玉",
          },
        ],
      }),
    );

    expect(prompt).toContain("- キャベツ（使い切る量: 1/4玉）");
    expect(prompt).not.toContain("キャベツ1/4玉");
  });

  test("材料をおまかせで使う場合も入力した量を依頼文に残す", () => {
    const prompt = buildPrompt(
      makeEmptyPromptData({
        materials: ["豆腐", "キャベツ"],
        materialUseMode: "specified",
        materialRequests: [
          {
            id: "material-1",
            name: "豆腐",
            usage: "auto",
            useUpAmountMode: "custom",
            useUpAmount: " 150g ",
          },
        ],
      }),
    );

    expect(prompt).toContain("### 家にある食材・材料\n\n- 豆腐（量: 150g）\n- キャベツ");
    expect(prompt).not.toContain("### 必ず使う食材・材料");
    expect(prompt).not.toContain("### 使い切りたい食材・材料");
  });

  test("材料の使い方がおまかせなら古い材料リクエストは出さない", () => {
    const prompt = buildPrompt(
      makeEmptyPromptData({
        materials: ["キャベツ"],
        materialUseMode: "auto",
        materialRequests: [
          {
            id: "material-1",
            name: "キャベツ",
            usage: "use-up",
            useUpAmountMode: "custom",
            useUpAmount: "1/4玉",
          },
        ],
      }),
    );

    expect(prompt).toContain("### 家にある食材・材料\n\n- キャベツ");
    expect(prompt).not.toContain("### 使い切りたい食材・材料");
    expect(prompt).not.toContain("1/4玉");
  });

  test("複数品の希望は自由記入のまま伝え、1品へ固定しない", () => {
    const notes = "生姜焼きに合う副菜と汁物を1品ずつ作りたい。";
    const prompt = buildPrompt(makeEmptyPromptData({ supplementalNotes: notes }));
    expect(prompt).toContain(notes);
    expect(prompt).toContain(
      "複数品は料理ごとに同じ形式にし、求められた追加説明だけ末尾へ付けてください。",
    );
    expect(prompt).not.toContain("### 作りたい品数");
    expect(prompt).not.toContain("### 料理の役割・量感");
    expect(prompt).not.toContain("レシピを1つ提案");
  });
});

describe("makeEmptyPromptData", () => {
  test("空の初期値を返し、上書きだけを反映する", () => {
    const data = makeEmptyPromptData({
      materials: ["豆腐"],
      servings: "大人2人",
    });

    expect(data.materials).toEqual(["豆腐"]);
    expect(data.servings).toBe("大人2人");
    expect(data.requestIntent).toBe("auto");
    expect(data.materialUseMode).toBe("auto");
    expect(data.materialRequests).toEqual([]);
    expect(data.targetDish).toEqual([]);
    expect(data.recipeRoles).toEqual([]);
    expect(data.cookTime).toBe("");
    expect(data.supplementalNotes).toBe("");
    expect(data.recipeDirections).toEqual([]);
    expect(data.ngFoodsAndSeasonings).toEqual([]);
  });
});

describe("output-template-first prompt contract", () => {
  test.each(promptEvaluationCases)(
    "$id: compact goal first, one entry per material",
    ({ data }) => {
      const prompt = buildPrompt(makeEmptyPromptData(data));
      expect(prompt.startsWith("## 出力テンプレート\n")).toBe(true);
      expect(prompt.indexOf("### 味の調整")).toBeLessThan(prompt.indexOf("## 入力条件"));
      expect(prompt.length).toBeLessThan(900);
      for (const title of ["レシピ名", "使う材料", "作り方", "調理のポイント", "味の調整"])
        expect(prompt.split(`### ${title}\n`)).toHaveLength(2);
      for (const material of data.materials ?? [])
        expect(prompt.split("\n").filter((line) => line.startsWith(`- ${material}`))).toHaveLength(
          1,
        );
      for (const removed of [
        "## 役割",
        "## 目的",
        "## 条件の解釈",
        "## 回答前の内部確認",
        "## 出力しないもの",
      ])
        expect(prompt).not.toContain(removed);
    },
  );

  test("template expresses cooking and completed-dish adjustment without a second checklist", () => {
    const prompt = buildPrompt(makeEmptyPromptData());
    expect(prompt).toContain(
      "加熱は時間・火力と完了の目安を明記。肉・魚は中心まで、卵は固まるまで加熱し、半生・半熟は勧めない",
    );
    expect(prompt).toContain(
      "完成後に水・湯で薄める。できない料理は「調整できない」。食材追加は禁止",
    );
    expect(prompt).not.toContain("子供・幼児には");
    expect(prompt).not.toContain("下ごしらえ道具");
    expect(prompt).not.toContain("使用指定のない食材");
    expect(prompt).not.toContain("その他の要望");
    expect(prompt).not.toContain("入力の人数・分量に合う量");
  });

  test("use-up total applies only to an explicitly selected material", () => {
    const auto = buildPrompt(makeEmptyPromptData({ materials: ["豆腐150g"] }));
    expect(auto).toContain("食材の記載量は全品合計の上限");
    expect(auto).not.toContain("使い切る");
    const useUp = buildPrompt(makeEmptyPromptData(promptEvaluationCases[1]?.data));
    expect(useUp).toContain("使い切る量は各品へ重複計上せず、合計で使い切る");
  });

  test("required custom amounts are retained once without normalizing the text", () => {
    const prompt = buildPrompt(
      makeEmptyPromptData({
        materials: ["木綿豆腐"],
        materialUseMode: "specified",
        materialRequests: [
          {
            id: "tofu",
            name: "木綿豆腐",
            usage: "required",
            useUpAmountMode: "custom",
            useUpAmount: " １５０ｇ（1/2丁） ",
          },
        ],
      }),
    );
    expect(prompt).toContain("- 木綿豆腐（必ず使う・使う量: １５０ｇ（1/2丁））");
    expect(prompt.split("１５０ｇ（1/2丁）")).toHaveLength(2);
    expect(prompt).not.toContain("使用指定のない食材");
  });

  test("stale material requests cannot add absent ingredients or usage rules", () => {
    const prompt = buildPrompt(
      makeEmptyPromptData({
        materials: ["卵"],
        materialUseMode: "specified",
        materialRequests: [
          {
            id: "stale",
            name: "古い豆腐",
            usage: "use-up",
            useUpAmountMode: "custom",
            useUpAmount: "150g",
          },
        ],
      }),
    );
    expect(prompt).toContain("- 卵");
    expect(prompt).not.toContain("古い豆腐");
    expect(prompt).not.toContain("150g");
    expect(prompt).not.toContain("使い切る");
    expect(prompt).toContain("使用指定のない食材は、全部・全量を使う必要はない。");
  });
});
