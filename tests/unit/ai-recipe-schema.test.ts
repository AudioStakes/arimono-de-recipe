import { describe, expect, test } from "vitest";
import {
  buildCompactRecipeCandidateInput,
  parseAiRecipeCandidateRequest,
  parseAiRecipeCandidatesJson,
  parseAiRecipeCandidatesResponse,
  validateAiRecipeCandidatesForRequest,
} from "../../src/ai-recipe-schema";
import type { AiRecipeCandidatesResponse } from "../../src/types";

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

describe("ai recipe schema", () => {
  test("candidate requestを検証し、compact model inputを作る", () => {
    const parsed = parseAiRecipeCandidateRequest({
      mode: "candidates",
      materials: ["豆腐", "キャベツ"],
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
      '{"m":["豆腐","キャベツ"],"sv":"2人分","t":"20分以内","d":["あっさり"],"tl":["フライパン"],"ng":["にんにく"],"n":"薄味"}',
    );
  });

  test("unknown fieldsや空材料を拒否する", () => {
    expect(
      parseAiRecipeCandidateRequest({
        mode: "candidates",
        materials: ["豆腐"],
        prompt: "legacy prompt",
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
    expect(
      parseAiRecipeCandidatesResponse({
        items: [
          validCandidates.items[0],
          { ...validCandidates.items[1], badges: ["no_shop"], miss: ["卵"] },
          validCandidates.items[2],
        ],
      }).ok,
    ).toBe(false);
  });

  test("request材料にないuseやavoidとの衝突を拒否する", () => {
    const [first, second, third] = validCandidates.items;
    if (!first || !second || !third) {
      throw new Error("candidate fixture must include three items.");
    }

    expect(
      validateAiRecipeCandidatesForRequest(validCandidates, {
        mode: "candidates",
        materials: ["豆腐", "キャベツ"],
      }).ok,
    ).toBe(true);

    expect(
      validateAiRecipeCandidatesForRequest(
        {
          items: [{ ...first, use: ["豚肉"] }, second, third],
        },
        {
          mode: "candidates",
          materials: ["豆腐", "キャベツ"],
        },
      ).ok,
    ).toBe(false);

    expect(
      validateAiRecipeCandidatesForRequest(
        {
          items: [{ ...first, use: ["油"] }, second, third],
        },
        {
          mode: "candidates",
          materials: ["油揚げ", "キャベツ"],
        },
      ).ok,
    ).toBe(false);

    expect(
      validateAiRecipeCandidatesForRequest(
        {
          items: [{ ...first, miss: ["豆腐"] }, second, third],
        },
        {
          mode: "candidates",
          materials: ["豆腐", "キャベツ"],
        },
      ).ok,
    ).toBe(false);

    expect(
      validateAiRecipeCandidatesForRequest(
        {
          items: [{ ...first, ing: ["豆腐", "豚肉"] }, second, third],
        },
        {
          mode: "candidates",
          materials: ["豆腐", "キャベツ"],
        },
      ).ok,
    ).toBe(false);

    expect(
      validateAiRecipeCandidatesForRequest(validCandidates, {
        mode: "candidates",
        materials: ["豆腐", "キャベツ"],
        notes: "必須:豆腐 / 使切:キャベツ",
      }).ok,
    ).toBe(false);

    expect(
      validateAiRecipeCandidatesForRequest(validCandidates, {
        mode: "candidates",
        materials: ["豆腐", "キャベツ"],
        avoid: ["しょうゆ"],
      }).ok,
    ).toBe(false);

    expect(
      validateAiRecipeCandidatesForRequest(validCandidates, {
        mode: "candidates",
        materials: ["豆腐", "キャベツ"],
        avoid: ["卵"],
      }).ok,
    ).toBe(false);
  });
});
