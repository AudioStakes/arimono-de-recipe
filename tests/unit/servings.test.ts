import { describe, expect, test } from "vitest";
import { buildServingsText } from "../../src/servings";

describe("buildServingsText", () => {
  test("人数のあるグループだけを順に整形する", () => {
    expect(
      buildServingsText({
        adultCount: 2,
        childCount: 1,
      }),
    ).toBe("大人2人、子供(12歳以下)1人");
  });

  test("0人指定は出力しない", () => {
    expect(
      buildServingsText({
        adultCount: 0,
        seniorCount: 3,
      }),
    ).toBe("シニア(60歳以上)3人");
  });
});
