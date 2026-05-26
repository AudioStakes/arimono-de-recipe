import { describe, expect, test } from "vitest";
import { clampServingCount, formatServings } from "../../src/servings";

describe("formatServings", () => {
  test("人数・分量が未指定なら空文字になる", () => {
    expect(formatServings({})).toBe("");
  });

  test("人数のあるグループだけを大人・シニア・子供・幼児の順で整形する", () => {
    expect(
      formatServings({
        toddlerCount: 1,
        adultCount: 2,
        childCount: 1,
        seniorCount: 3,
      }),
    ).toBe("大人2人、シニア(60歳以上)3人、子供(12歳以下)1人、幼児(5歳以下)1人");
  });

  test("0人指定は出力しない", () => {
    expect(
      formatServings({
        adultCount: 0,
        seniorCount: 3,
      }),
    ).toBe("シニア(60歳以上)3人");
  });

  test("人数は0未満にならず10人を超えない", () => {
    expect(clampServingCount(-1)).toBe(0);
    expect(clampServingCount(0)).toBe(0);
    expect(clampServingCount(4)).toBe(4);
    expect(clampServingCount(11)).toBe(10);
  });
});
