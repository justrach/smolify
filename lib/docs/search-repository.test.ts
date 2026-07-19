import { describe, expect, it } from "vitest";
import { searchActiveDocs } from "./search-repository";

function searchEnvironment(
  handler: (sql: string, values: unknown[]) => Promise<{ results: Array<Record<string, unknown>> }>,
) {
  return {
    DB: {
      prepare(sql: string) {
        return {
          bind(...values: unknown[]) {
            return {
              all: () => handler(sql, values),
            };
          },
        };
      },
    },
  } as unknown as CloudflareEnv;
}

describe("active documentation search", () => {
  it("returns exact source-symbol matches before BM25", async () => {
    const env = searchEnvironment(async (sql) => {
      expect(sql).toContain("instr(char(10) || lower(p.symbols)");
      return {
        results: [{
          slug: "source/packages/next/navigation",
          title: "Source symbols: navigation.ts",
          description: "Navigation declarations",
          sourceFiles: "packages/next/navigation.ts",
          symbols: "navigateusingprefetchedroutetree\nnavigate using prefetched route tree",
          score: -1000,
          snippet: "Navigation declarations",
        }],
      };
    });

    const result = await searchActiveDocs(env, "next-js", "navigateUsingPrefetchedRouteTree", 8);
    expect(result.matchMode).toBe("exact_identifier");
    expect(result.confidence).toBe("high");
    expect(result.fallbackUsed).toBe(false);
    expect(result.identifierCoverage.matched).toEqual(["navigateUsingPrefetchedRouteTree"]);
    expect(result.results[0]).toMatchObject({
      matchReason: "exact_identifier",
      sourceFiles: ["packages/next/navigation.ts"],
      matchedIdentifiers: ["navigateUsingPrefetchedRouteTree"],
    });
  });

  it("labels a broad any-term fallback as low confidence", async () => {
    let calls = 0;
    const env = searchEnvironment(async (sql) => {
      expect(sql).toContain("doc_pages_fts MATCH");
      calls += 1;
      if (calls === 1) return { results: [] };
      return {
        results: [{
          slug: "docs/navigation",
          title: "Navigation",
          description: "Navigation guide",
          sourceFiles: "docs/navigation.mdx",
          score: -2,
          snippet: "A partial match",
        }],
      };
    });

    const result = await searchActiveDocs(env, "next-js", "instant navigation behavior", 8);
    expect(result.matchMode).toBe("any_term");
    expect(result.confidence).toBe("low");
    expect(result.fallbackUsed).toBe(true);
    expect(result.fallbackReason).toContain("matched every query term");
    expect(result.results[0]).toMatchObject({
      matchReason: "any_term",
      sourceFiles: ["docs/navigation.mdx"],
    });
  });
});
