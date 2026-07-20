import { afterEach, describe, expect, it, vi } from "vitest";
import { buildDocsContext } from "../docs/context";
import { buildPublicSourceEvidence, resolvePublicSymbols } from "../imports/public-symbols";
import { evaluateContextParity, evaluateSourceParity } from "./retrieval-parity";

const commit = "abcdef0123456789abcdef0123456789abcdef01";
const project = {
  sourceType: "github" as const,
  sourceUrl: "https://github.com/example/navigation-runtime",
  sourceCommit: commit,
  sourceRetention: "public-symbols" as const,
};
const navigationPath = "src/client/segment-cache/navigation.ts";
const cachePath = "src/client/segment-cache/cache.ts";
const fetchPath = "src/client/router/fetch-server-response.ts";
const navigation = [
  "import { readRouteCacheEntry } from './cache'",
  "import { fetchServerResponse } from '../router/fetch-server-response'",
  "function navigateImpl() {",
  "  const route = readRouteCacheEntry()",
  "  if (route) return navigateUsingPrefetchedRouteTree(route)",
  "  return navigateToUnknownRoute()",
  "}",
  "function navigateUsingPrefetchedRouteTree(route: unknown) {",
  "  return navigateToKnownRoute(route)",
  "}",
  ...Array.from({ length: 90 }, () => "// intentionally spaced implementation"),
  "async function navigateToUnknownRoute() {",
  "  const decoy = 'fetchServerResponse()'",
  "  return fetchServerResponse()",
  "}",
].join("\n");
const cache = "export function readRouteCacheEntry() { return routeCacheMap.get('route') }";
const fetcher = "export async function fetchServerResponse() { return requestFlightData() }";

function sourceFetch() {
  return vi.fn(async (input: RequestInfo | URL) => {
    const url = String(input);
    if (url.includes("/git/commits/")) return Response.json({ tree: { sha: "tree-sha" } });
    if (url.includes("/git/trees/")) {
      return Response.json({
        truncated: false,
        tree: [
          { path: navigationPath, type: "blob", size: navigation.length },
          { path: cachePath, type: "blob", size: cache.length },
          { path: fetchPath, type: "blob", size: fetcher.length },
          { path: "tests/navigation.test.ts", type: "blob", size: 200 },
          ...Array.from({ length: 80 }, (_, index) => ({
            path: `src/unrelated/module-${index}.ts`, type: "blob", size: 2_000,
          })),
        ],
      });
    }
    if (url.endsWith(`/${navigationPath}`)) return new Response(navigation);
    if (url.endsWith(`/${cachePath}`)) return new Response(cache);
    if (url.endsWith(`/${fetchPath}`)) return new Response(fetcher);
    return new Response("export function unrelatedWorker() { return null }");
  });
}

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
                    slug: "source/src/client/segment-cache/navigation",
                    title: "Source symbols: navigation.ts",
                    description: "Navigation relationships",
                    sourceFiles: navigationPath,
                    symbols: "navigateusingprefetchedroutetree\nreadroutecacheentry\nfetchserverresponse",
                    score: -1000,
                    snippet: "Exact identifiers",
                  }] };
                }
                const query = String(values[0]);
                const migration = query.includes("migration");
                return { results: [{
                  slug: migration ? "docs/adopting-partial-prefetching" : "docs/instant-navigation",
                  title: migration ? "Adopting Partial Prefetching" : "Instant Navigation",
                  description: migration ? "Flags and migration" : "Stream Cache and Block",
                  sourceFiles: migration ? "docs/adopting.mdx" : "docs/instant.mdx",
                  score: migration ? -10 : -12,
                  snippet: migration ? "migration gotchas" : "Stream Cache Block",
                }] };
              },
              async first() {
                const slug = String(values[3]);
                const markdown = slug.startsWith("source/")
                  ? "# Source relationships\n\n`navigateImpl` calls `readRouteCacheEntry` and `navigateUsingPrefetchedRouteTree`."
                  : slug.includes("adopting")
                    ? "# Adopting\n\nEnable flags and migrate links."
                    : "# Instant Navigation\n\nCompare Stream, Cache, and Block.";
                return {
                  slug,
                  title: slug,
                  description: "Parity evidence",
                  sourceFiles: slug.startsWith("source/") ? navigationPath : `${slug}.mdx`,
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

afterEach(() => vi.unstubAllGlobals());

describe("DeepWiki and CodeDB retrieval parity gates", () => {
  it("passes an implementation-trace gate with definitions, scoped edges, a connector, and pinned evidence", async () => {
    vi.stubGlobal("fetch", sourceFetch());
    const evidence = await buildPublicSourceEvidence(project, [
      "navigateUsingPrefetchedRouteTree",
      "readRouteCacheEntry",
      "fetchServerResponse",
    ], { maxCharacters: 6_000, pathHints: [navigationPath] });
    const result = evaluateSourceParity(evidence, {
      id: "next_navigation_trace",
      requiredSymbols: [
        "navigateUsingPrefetchedRouteTree",
        "readRouteCacheEntry",
        "fetchServerResponse",
      ],
      requiredDefinitionPaths: {
        navigateUsingPrefetchedRouteTree: navigationPath,
        readRouteCacheEntry: cachePath,
        fetchServerResponse: fetchPath,
      },
      requiredEdges: [
        { from: "navigateImpl", to: "readRouteCacheEntry" },
        { from: "navigateImpl", to: "navigateUsingPrefetchedRouteTree" },
        { from: "navigateToUnknownRoute", to: "fetchServerResponse" },
      ],
      requiredConnector: {
        symbol: "navigateImpl",
        reaches: ["navigateUsingPrefetchedRouteTree", "readRouteCacheEntry", "fetchServerResponse"],
      },
      requiredEvidenceTerms: ["readRouteCacheEntry", "navigateUsingPrefetchedRouteTree", "fetchServerResponse"],
      maxScannedFiles: 3,
      maxScannedBytes: navigation.length + cache.length + fetcher.length,
      maxEvidenceCharacters: 6_000,
    });

    expect(result.passed, JSON.stringify(result.checks.filter((check) => !check.passed))).toBe(true);
    expect(result.score).toBe(1);
  });

  it("keeps unresolved-symbol and scan-cap behavior explicit under adversarial misses", async () => {
    vi.stubGlobal("fetch", sourceFetch());
    const result = await resolvePublicSymbols(project, ["missingArchitectureSymbol"], {
      includeRelationships: true,
      maxFiles: 24,
    });

    expect(result.matched).toEqual([]);
    expect(result.unresolved).toEqual(["missingArchitectureSymbol"]);
    expect(result.graph.definitionCoverage.unresolved).toEqual(["missingArchitectureSymbol"]);
    expect(result.scannedFiles).toBeLessThanOrEqual(24);
    expect(result.scannedBytes).toBeLessThanOrEqual(4 * 1024 * 1024);
  });

  it("preserves higher-value graph sections as evidence budgets increase", async () => {
    vi.stubGlobal("fetch", sourceFetch());
    const small = await buildPublicSourceEvidence(project, [
      "navigateUsingPrefetchedRouteTree", "readRouteCacheEntry", "fetchServerResponse",
    ], { maxCharacters: 1_200, pathHints: [navigationPath] });
    vi.stubGlobal("fetch", sourceFetch());
    const large = await buildPublicSourceEvidence(project, [
      "navigateUsingPrefetchedRouteTree", "readRouteCacheEntry", "fetchServerResponse",
    ], { maxCharacters: 6_000, pathHints: [navigationPath] });

    expect(large.resolution.graph.definitionCoverage).toEqual(small.resolution.graph.definitionCoverage);
    expect(large.evidence.reduce((sum, item) => sum + item.content.length, 0))
      .toBeGreaterThanOrEqual(small.evidence.reduce((sum, item) => sum + item.content.length, 0));
    expect(small.evidence.reduce((sum, item) => sum + item.content.length, 0)).toBeLessThanOrEqual(1_200);
    expect(large.evidence.reduce((sum, item) => sum + item.content.length, 0)).toBeLessThanOrEqual(6_000);
  });

  it("passes a multi-page conceptual synthesis gate without embeddings", async () => {
    const context = await buildDocsContext(
      contextEnvironment(),
      "next-js",
      "Explain navigateUsingPrefetchedRouteTree, readRouteCacheEntry, and fetchServerResponse; compare Stream, Cache, and Block; list flags and migration gotchas",
      { maxTokens: 6_000, maxPages: 5 },
    );
    const result = evaluateContextParity(context, {
      id: "instant_navigation_synthesis",
      requiredPageSlugs: [
        "source/src/client/segment-cache/navigation",
        "docs/instant-navigation",
        "docs/adopting-partial-prefetching",
      ],
      requiredFacets: ["Stream Cache Block", "flags migration gotchas"],
      maxTokens: 6_000,
    });

    expect(result.passed, JSON.stringify(result.checks.filter((check) => !check.passed))).toBe(true);
  });
});
