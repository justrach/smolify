import { describe, expect, it } from "vitest";
import { buildDocsContext } from "./context";

function contextEnvironment() {
  return {
    DB: {
      prepare(sql: string) {
        return {
          bind(...values: unknown[]) {
            return {
              async all() {
                if (sql.includes("instr(char(10) || lower(p.symbols)")) {
                  return { results: [{
                    slug: "source/src/navigation",
                    title: "Source symbols: navigation.ts",
                    description: "Navigation symbols",
                    sourceFiles: "src/navigation.ts",
                    symbols: "navigateusingprefetchedroutetree",
                    score: -1000,
                    snippet: "Navigation symbols",
                  }] };
                }
                return { results: [{
                  slug: "docs/navigation",
                  title: "Navigation",
                  description: "How navigation works",
                  sourceFiles: "docs/navigation.md",
                  score: -12,
                  snippet: "Navigation guide",
                }] };
              },
              async first() {
                const slug = String(values[3]);
                const markdown = slug.startsWith("source/")
                  ? "# Source symbols\n\n`navigateUsingPrefetchedRouteTree` references `readRouteCacheEntry`."
                  : "# Navigation\n\nA prefetched route tree enables partial navigation.";
                return {
                  slug,
                  title: slug.startsWith("source/") ? "Source symbols" : "Navigation",
                  description: "Evidence",
                  sourceFiles: slug.startsWith("source/")
                    ? Array.from({ length: 20 }, (_, index) => `src/navigation-${index}.ts`).join("\n")
                    : "docs/navigation.md",
                  totalLength: markdown.length,
                  markdown,
                };
              },
            };
          },
        };
      },
    },
  } as unknown as CloudflareEnv;
}

describe("bounded documentation context", () => {
  it("packs exact identifiers before lexical evidence without embeddings", async () => {
    const context = await buildDocsContext(
      contextEnvironment(),
      "next-js",
      "Explain navigateUsingPrefetchedRouteTree during partial navigation",
      { maxTokens: 3_000, maxPages: 4 },
    );

    expect(context.strategy).toMatchObject({
      embeddings: false,
      answerModel: false,
      exactIdentifiers: ["navigateUsingPrefetchedRouteTree"],
    });
    expect(context.pages.map((page) => page.slug)).toEqual([
      "source/src/navigation",
      "docs/navigation",
    ]);
    expect(context.pages[0].retrieval).toBe("exact_identifier");
    expect(context.pages[0].sourceFiles).toHaveLength(8);
    expect(context.pages[0].sourceFileCount).toBe(20);
    expect(context.pages[0].sourceFilesTruncated).toBe(true);
    expect(context.pages[1].retrieval).toBe("bm25");
    expect(context.synthesisRequired).toBe(true);
  });
});
