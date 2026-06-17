import { describe, expect, test } from "vitest";
import {
  buildCompactRecipeCandidateInput,
  parseAiRecipeCandidateRequest,
  parseAiRecipeCandidatesJson,
  parseAiRecipeCandidatesModelOutput,
  parseAiRecipeCandidatesResponse,
  validateAiRecipeCandidatesForRequest,
} from "../../src/ai-recipe-schema";
import type { AiRecipeCandidatesResponse, AiRecipeMaterialInput } from "../../src/types";

const validCandidates = {
  items: [
    {
      id: "a",
      title: "豆腐のあんかけ",
      time: 15,
      badges: ["no_shop", "quick"],
      use: ["豆腐"],
      miss: [],
      why: "豆腐を主役にして短時間で作れます。",
      ing: ["豆腐", "片栗粉", "しょうゆ"],
      steps: ["豆腐を温める", "あんを作る", "かける"],
    },
    {
      id: "b",
      title: "キャベツ炒め",
      time: 12,
      badges: ["easy"],
      use: ["キャベツ"],
      miss: ["卵"],
      why: "少ない材料で主菜寄りにできます。",
      ing: ["キャベツ", "油", "塩"],
      steps: ["切る", "炒める", "味を調える"],
    },
    {
      id: "c",
      title: "豆腐スープ",
      time: 10,
      badges: ["no_shop", "few_dishes"],
      use: ["豆腐", "キャベツ"],
      miss: [],
      why: "鍋ひとつでありものを使えます。",
      ing: ["豆腐", "キャベツ", "だし"],
      steps: ["煮る", "味を調える"],
    },
  ],
} satisfies AiRecipeCandidatesResponse;

function materials(...names: string[]): AiRecipeMaterialInput[] {
  return names.map((name) => ({ name, usage: "auto" }));
}

describe("ai recipe schema", () => {
  test("candidate requestを検証し、compact model inputを作る", () => {
    const parsed = parseAiRecipeCandidateRequest({
      mode: "candidates",
      materials: materials("豆腐", "キャベツ"),
      servings: "2人分",
      time: "20分以内",
      directions: ["あっさり"],
      tools: ["フライパン"],
      avoid: ["にんにく"],
      notes: "薄味",
    });

    expect(parsed.ok).toBe(true);
    if (!parsed.ok) throw new Error(parsed.reason);
    expect(buildCompactRecipeCandidateInput(parsed.value)).toBe(
      '{"m":[["豆腐","auto"],["キャベツ","auto"]],"sv":"2人分","t":"20分以内","d":["あっさり"],"tl":["フライパン"],"ng":["にんにく"],"n":"薄味"}',
    );
  });

  test("compact model inputに必須・使い切り材料をrqとして含める", () => {
    const parsed = parseAiRecipeCandidateRequest({
      mode: "candidates",
      materials: [
        { name: "豆腐", usage: "required" },
        { name: "キャベツ", usage: "use_up", amount: "1/4玉" },
      ],
      notes: "薄味",
    });

    expect(parsed.ok).toBe(true);
    if (!parsed.ok) throw new Error(parsed.reason);
    expect(buildCompactRecipeCandidateInput(parsed.value)).toBe(
      '{"m":[["豆腐","required"],["キャベツ","use_up","1/4玉"]],"rq":["豆腐","キャベツ"],"n":"薄味"}',
    );
  });

  test("材料usageと分量の組み合わせを検証する", () => {
    const parsed = parseAiRecipeCandidateRequest({
      mode: "candidates",
      materials: [
        { name: "豆腐", usage: "auto", amount: "150g" },
        { name: "キャベツ", usage: "required" },
        { name: "卵", usage: "required", amount: "2個" },
        { name: "もやし", usage: "use_up", amount: "1袋" },
      ],
    });

    expect(parsed.ok).toBe(true);
    if (!parsed.ok) throw new Error(parsed.reason);
    expect(parsed.value.materials).toEqual([
      { name: "豆腐", usage: "auto", amount: "150g" },
      { name: "キャベツ", usage: "required" },
      { name: "卵", usage: "required", amount: "2個" },
      { name: "もやし", usage: "use_up", amount: "1袋" },
    ]);
  });

  test("unknown fieldsや不正な材料指定を拒否する", () => {
    expect(
      parseAiRecipeCandidateRequest({
        mode: "candidates",
        materials: materials("豆腐"),
        prompt: "legacy prompt",
      }).ok,
    ).toBe(false);
    expect(parseAiRecipeCandidateRequest({ mode: "candidates", materials: ["豆腐"] }).ok).toBe(
      false,
    );
    expect(
      parseAiRecipeCandidateRequest({
        mode: "candidates",
        materials: [{ name: "豆腐", usage: "use_up" }],
      }).ok,
    ).toBe(false);
    expect(parseAiRecipeCandidateRequest({ mode: "candidates", materials: [] }).ok).toBe(false);
  });

  test("valid candidate JSONを3件に正規化する", () => {
    const parsed = parseAiRecipeCandidatesJson(JSON.stringify(validCandidates));

    expect(parsed.ok).toBe(true);
    if (!parsed.ok) throw new Error(parsed.reason);
    expect(parsed.value.items).toHaveLength(3);
    expect(parsed.value.items[0]?.title).toBe("豆腐のあんかけ");
  });

  test("JSON Modeのobject応答を3件に正規化する", () => {
    const parsed = parseAiRecipeCandidatesModelOutput(validCandidates);

    expect(parsed.ok).toBe(true);
    if (!parsed.ok) throw new Error(parsed.reason);
    expect(parsed.value.items.map((item) => item.id)).toEqual(["a", "b", "c"]);
  });

  test("AI応答のコードフェンスや前置き付きJSONを受け入れる", () => {
    expect(
      parseAiRecipeCandidatesJson(`\`\`\`json\n${JSON.stringify(validCandidates)}\n\`\`\``).ok,
    ).toBe(true);
    expect(parseAiRecipeCandidatesJson(`候補です。\n${JSON.stringify(validCandidates)}`).ok).toBe(
      true,
    );
  });

  test("4件以上は全件検証後に3件へ切る", () => {
    const parsed = parseAiRecipeCandidatesResponse({
      items: [
        ...validCandidates.items,
        {
          ...validCandidates.items[0],
          id: "d",
          title: "豆腐焼き",
        },
      ],
    });

    expect(parsed.ok).toBe(true);
    if (!parsed.ok) throw new Error(parsed.reason);
    expect(parsed.value.items.map((item) => item.id)).toEqual(["a", "b", "c"]);
  });

  test("AI応答の重複idを表示用idへ正規化する", () => {
    const parsed = parseAiRecipeCandidatesResponse({
      items: validCandidates.items.map((item) => ({ ...item, id: "c" })),
    });

    expect(parsed.ok).toBe(true);
    if (!parsed.ok) throw new Error(parsed.reason);
    expect(parsed.value.items.map((item) => item.id)).toEqual(["a", "b", "c"]);
  });

  test("missing fields, invalid badges, fewer than 3 candidatesを拒否する", () => {
    expect(parseAiRecipeCandidatesResponse({ items: [validCandidates.items[0]] }).ok).toBe(false);
    expect(
      parseAiRecipeCandidatesResponse({
        items: [
          { ...validCandidates.items[0], badges: ["unknown"] },
          validCandidates.items[1],
          validCandidates.items[2],
        ],
      }).ok,
    ).toBe(false);
    expect(
      parseAiRecipeCandidatesResponse({
        items: [
          { ...validCandidates.items[0], steps: [] },
          validCandidates.items[1],
          validCandidates.items[2],
        ],
      }).ok,
    ).toBe(false);
  });

  test("request材料にないingやavoidとの衝突を拒否する", () => {
    const [first, second, third] = validCandidates.items;
    if (!first || !second || !third) {
      throw new Error("candidate fixture must include three items.");
    }

    expect(
      validateAiRecipeCandidatesForRequest(validCandidates, {
        mode: "candidates",
        materials: materials("豆腐", "キャベツ"),
      }).ok,
    ).toBe(true);

    const normalizedUse = validateAiRecipeCandidatesForRequest(
      {
        items: [{ ...first, use: ["豚肉"] }, second, third],
      },
      {
        mode: "candidates",
        materials: materials("豆腐", "キャベツ"),
      },
    );
    expect(normalizedUse.ok).toBe(true);
    if (!normalizedUse.ok) {
      throw new Error(normalizedUse.reason);
    }
    expect(normalizedUse.value.items[0]?.use).toEqual(["豆腐"]);

    expect(
      validateAiRecipeCandidatesForRequest(
        {
          items: [{ ...first, use: ["油"] }, second, third],
        },
        {
          mode: "candidates",
          materials: materials("油揚げ", "キャベツ"),
        },
      ).ok,
    ).toBe(false);

    const normalizedMissingRequestMaterial = validateAiRecipeCandidatesForRequest(
      {
        items: [{ ...first, miss: ["豆腐"] }, second, third],
      },
      {
        mode: "candidates",
        materials: materials("豆腐", "キャベツ"),
      },
    );
    expect(normalizedMissingRequestMaterial.ok).toBe(true);
    if (!normalizedMissingRequestMaterial.ok) {
      throw new Error(normalizedMissingRequestMaterial.reason);
    }
    expect(normalizedMissingRequestMaterial.value.items[0]?.miss).toEqual([]);

    expect(
      validateAiRecipeCandidatesForRequest(
        {
          items: [{ ...first, ing: ["豆腐", "豚肉"] }, second, third],
        },
        {
          mode: "candidates",
          materials: materials("豆腐", "キャベツ"),
        },
      ).ok,
    ).toBe(false);

    expect(
      validateAiRecipeCandidatesForRequest(validCandidates, {
        mode: "candidates",
        materials: [
          { name: "豆腐", usage: "required" },
          { name: "キャベツ", usage: "use_up", amount: "1/4玉" },
        ],
      }).ok,
    ).toBe(false);

    expect(
      validateAiRecipeCandidatesForRequest(validCandidates, {
        mode: "candidates",
        materials: materials("豆腐", "キャベツ"),
        avoid: ["しょうゆ"],
      }).ok,
    ).toBe(false);

    expect(
      validateAiRecipeCandidatesForRequest(validCandidates, {
        mode: "candidates",
        materials: materials("豆腐", "キャベツ"),
        avoid: ["キャベツ"],
      }).ok,
    ).toBe(false);
  });

  test("request材料がmissに混ざったAI応答を正規化する", () => {
    const [first, second, third] = validCandidates.items;
    if (!first || !second || !third) {
      throw new Error("candidate fixture must include three items.");
    }

    const parsed = validateAiRecipeCandidatesForRequest(
      {
        items: [
          { ...first, badges: ["quick", "miss_optional"], use: ["豆腐"], miss: ["キャベツ"] },
          second,
          third,
        ],
      },
      {
        mode: "candidates",
        materials: materials("豆腐", "キャベツ"),
      },
    );

    expect(parsed.ok).toBe(true);
    if (!parsed.ok) throw new Error(parsed.reason);
    expect(parsed.value.items[0]?.miss).toEqual([]);
    expect(parsed.value.items[0]?.badges).toEqual(["quick"]);
  });

  test("avoid条件がmissに混ざったAI応答を正規化する", () => {
    const [first, second, third] = validCandidates.items;
    if (!first || !second || !third) {
      throw new Error("candidate fixture must include three items.");
    }

    const parsed = validateAiRecipeCandidatesForRequest(
      {
        items: [{ ...first, badges: ["miss_optional"], miss: ["辛い味"] }, second, third],
      },
      {
        mode: "candidates",
        materials: materials("豆腐", "キャベツ"),
        avoid: ["辛い味"],
      },
    );

    expect(parsed.ok).toBe(true);
    if (!parsed.ok) throw new Error(parsed.reason);
    expect(parsed.value.items[0]?.miss).toEqual([]);
    expect(parsed.value.items[0]?.badges).toEqual([]);
  });

  test("useに混ざった入力外材料を落とし、ingのrequest材料をuseへ補完する", () => {
    const [first, second, third] = validCandidates.items;
    if (!first || !second || !third) {
      throw new Error("candidate fixture must include three items.");
    }

    const parsed = validateAiRecipeCandidatesForRequest(
      {
        items: [
          {
            ...first,
            use: ["豆腐", "みりん"],
            ing: ["豆腐 150g", "キャベツ 1枚", "みりん 大さじ1"],
          },
          second,
          third,
        ],
      },
      {
        mode: "candidates",
        materials: [
          { name: "豆腐", usage: "auto" },
          { name: "キャベツ", usage: "required" },
        ],
      },
    );

    expect(parsed.ok).toBe(true);
    if (!parsed.ok) throw new Error(parsed.reason);
    expect(parsed.value.items[0]?.use).toEqual(["豆腐", "キャベツ"]);
  });

  test("ingの分量付き材料と常備調味料をrequest材料として扱う", () => {
    const realisticCandidates = {
      items: [
        {
          id: "a",
          title: "鶏もも親子煮",
          time: 18,
          badges: ["no_shop", "quick"],
          use: ["鶏もも肉", "玉ねぎ", "卵"],
          miss: [],
          why: "家の材料だけで主菜になります。",
          ing: ["鶏もも肉 200g", "玉ねぎ 1/2個", "卵 2個", "しょうゆ 大さじ1"],
          steps: ["鶏肉と玉ねぎを煮る", "卵を回し入れる", "火を止める"],
        },
        {
          id: "b",
          title: "鶏玉炒め",
          time: 15,
          badges: ["no_shop", "easy"],
          use: ["鶏もも肉", "玉ねぎ", "卵"],
          miss: [],
          why: "フライパンだけで短時間にできます。",
          ing: ["鶏もも肉 180g", "玉ねぎ 1/2個", "卵 2個", "油 小さじ1"],
          steps: ["材料を切る", "炒める", "卵を絡める"],
        },
        {
          id: "c",
          title: "鶏肉の卵とじ",
          time: 20,
          badges: ["no_shop", "few_dishes"],
          use: ["鶏もも肉", "玉ねぎ", "卵"],
          miss: [],
          why: "汁気があり食べやすいです。",
          ing: ["鶏もも肉 200g", "玉ねぎ 1個", "卵 2個", "みりん 大さじ1"],
          steps: ["具材を煮る", "味を調える", "卵でとじる"],
        },
      ],
    } satisfies AiRecipeCandidatesResponse;

    expect(
      validateAiRecipeCandidatesForRequest(realisticCandidates, {
        mode: "candidates",
        materials: [
          { name: "鶏もも肉", usage: "required" },
          { name: "玉ねぎ", usage: "auto" },
          { name: "卵", usage: "auto" },
        ],
      }).ok,
    ).toBe(true);
  });
});
