import { describe, expect, test } from "vitest";
import { recipeMarkdownHtml } from "../../src/recipe-markdown";

describe("AI回答のMarkdown", () => {
  test("見出し・段落・リスト・表を構造化する", () => {
    const html = recipeMarkdownHtml(
      "# 豆腐の料理\n\n**材料**\n\n- 豆腐\n\n1. 温める\n\n| 材料 | 分量 |\n| --- | --- |\n| 豆腐 | 1丁 |",
    );
    expect(html).toContain("<h1>豆腐の料理</h1>");
    expect(html).toContain("<strong>材料</strong>");
    expect(html).toContain("<ul>");
    expect(html).toContain("<ol>");
    expect(html).toContain("<table>");
  });

  test("生HTMLを文字列にし、Markdown画像を生成しない", () => {
    const html = recipeMarkdownHtml(
      '<img src="https://example.test/a" onerror="alert(1)">\n\n![画像](https://example.test/b)',
    );
    expect(html).toContain("&lt;img");
    expect(html).not.toContain("<img");
    expect(html).not.toContain("<script");
  });

  test.each(["", " \n ", "あ".repeat(20001)])("空・上限超過の回答を解析しない", (markdown) => {
    expect(recipeMarkdownHtml(markdown)).toBeNull();
  });

  test("20,000文字の回答を省略しない", () => {
    const markdown = "あ".repeat(20000);
    expect(recipeMarkdownHtml(markdown)).toContain(markdown);
  });
  test("短い行の列補完も計上し、表の総セル数を制限する", () => {
    const header = `${"|a".repeat(20)}|\n`;
    const separator = `${"|-".repeat(20)}|\n`;
    expect(recipeMarkdownHtml(header + separator + "|a|\n".repeat(49))).not.toBeNull();
    expect(recipeMarkdownHtml(header + separator + "|a|\n".repeat(50))).toBeNull();
  });

  test("上限を超える列の表はHTMLを膨張させず拒否する", () => {
    const columns = 65;
    expect(
      recipeMarkdownHtml(`${"|a".repeat(columns)}|\n${"|-".repeat(columns)}|\n|a|\n`),
    ).toBeNull();
  });
  test("別の表でも総セル数の予算をリセットしない", () => {
    const table = (rows: number) =>
      `${"|a".repeat(20)}|\n${"|-".repeat(20)}|\n${"|a|\n".repeat(rows)}`;
    expect(recipeMarkdownHtml(`${table(24)}\n区切り\n\n${table(24)}`)).not.toBeNull();
    expect(recipeMarkdownHtml(`${table(25)}\n区切り\n\n${table(25)}`)).toBeNull();
  });
});
