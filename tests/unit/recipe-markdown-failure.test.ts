import { micromark } from "micromark";
import { describe, expect, test, vi } from "vitest";
import { recipeMarkdownHtml } from "../../src/recipe-markdown";

vi.mock("micromark", () => ({ micromark: vi.fn() }));

describe("Markdown parserの失敗境界", () => {
  test("parser例外をUIへ投げず表示失敗として返す", () => {
    vi.mocked(micromark).mockImplementationOnce(() => {
      throw new Error("Parser failed");
    });
    expect(recipeMarkdownHtml("# 回答")).toBeNull();
  });

  test("生成HTMLが上限を超えたらDOMへ渡さない", () => {
    vi.mocked(micromark).mockReturnValueOnce("a".repeat(200_001));
    expect(recipeMarkdownHtml("# 回答")).toBeNull();
  });
});
