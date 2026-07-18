import { describe, expect, it } from "vitest";
import { renderMarkdown } from "./markdown";

describe("renderMarkdown", () => {
  it("derives stable headings and search text", async () => {
    const result = await renderMarkdown("# API\n\n## List pets\n\nHello **Mochi**.\n\n### Errors\n\nNot found.");

    expect(result.tableOfContents).toEqual([
      { id: "user-content-list-pets", label: "List pets", depth: 2 },
      { id: "user-content-errors", label: "Errors", depth: 3 },
    ]);
    expect(result.html).toContain('<h2 id="user-content-list-pets">List pets</h2>');
    expect(result.searchText).toContain("Hello Mochi");
  });

  it("does not execute embedded HTML or javascript URLs", async () => {
    const result = await renderMarkdown(
      "# Unsafe\n\n<script>alert(1)</script>\n\n[click](javascript:alert(1))\n\n<img src=x onerror=alert(1)>",
    );

    expect(result.html).not.toMatch(/script|javascript:|onerror/i);
  });
});
