import { afterEach, describe, expect, it, vi } from "vitest";
import { buildPublicSourceEvidence, resolvePublicSymbols } from "./public-symbols";

const commit = "0123456789abcdef0123456789abcdef01234567";
const project = {
  sourceType: "github" as const,
  sourceUrl: "https://github.com/example/runtime",
  sourceCommit: commit,
  sourceRetention: "public-symbols" as const,
};
const navigationSource = [
  "import { fetchServerResponse } from './fetch-server-response'",
  "import { readRouteCacheEntry } from './cache'",
  "function navigateUsingPrefetchedRouteTree() {",
  "  const route = readRouteCacheEntry()",
  "  return navigateToUnknownRoute(route)",
  "}",
  "async function navigateToUnknownRoute(route: unknown) {",
  "  return fetchServerResponse(route)",
  "}",
].join("\n");

function githubFetch() {
  return vi.fn(async (input: RequestInfo | URL) => {
    const url = String(input);
    if (url.includes("/git/commits/")) return Response.json({ tree: { sha: "tree-sha" } });
    if (url.includes("/git/trees/")) {
      return Response.json({
        truncated: false,
        tree: [
          { path: "src/client/segment-cache/navigation.ts", type: "blob", size: navigationSource.length },
          { path: "src/client/segment-cache/cache.ts", type: "blob", size: 80 },
          { path: "src/unrelated.ts", type: "blob", size: 80 },
        ],
      });
    }
    if (url.endsWith("/src/client/segment-cache/navigation.ts")) return new Response(navigationSource);
    if (url.endsWith("/src/client/segment-cache/cache.ts")) {
      return new Response("export function readRouteCacheEntry() { return null }");
    }
    return new Response("export const unrelated = true");
  });
}

afterEach(() => vi.unstubAllGlobals());

describe("public symbol resolution", () => {
  it("finds an exact multi-symbol source file from a bounded ranked tree scan", async () => {
    vi.stubGlobal("fetch", githubFetch());
    const result = await resolvePublicSymbols(project, [
      "navigateUsingPrefetchedRouteTree",
      "readRouteCacheEntry",
      "fetchServerResponse",
    ]);

    expect(result.matched).toEqual([
      "navigateUsingPrefetchedRouteTree",
      "readRouteCacheEntry",
      "fetchServerResponse",
    ]);
    expect(result.files[0]).toMatchObject({
      path: "src/client/segment-cache/navigation.ts",
      matchedSymbols: [
        "navigateUsingPrefetchedRouteTree",
        "readRouteCacheEntry",
        "fetchServerResponse",
      ],
    });
    expect(result.scannedBytes).toBeLessThanOrEqual(4 * 1024 * 1024);
  });

  it("reports unresolved identifiers without exceeding the fallback scan caps", async () => {
    vi.stubGlobal("fetch", vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.includes("/git/commits/")) return Response.json({ tree: { sha: "tree-sha" } });
      if (url.includes("/git/trees/")) {
        return Response.json({
          truncated: false,
          tree: Array.from({ length: 120 }, (_, index) => ({
            path: `src/module-${index}/worker.ts`,
            type: "blob",
            size: 60_000,
          })),
        });
      }
      return new Response("export function ordinaryWorker() { return null }");
    }));

    const result = await resolvePublicSymbols(project, ["missingArchitectureSymbol"]);

    expect(result.unresolved).toEqual(["missingArchitectureSymbol"]);
    expect(result.scannedFiles).toBeLessThanOrEqual(96);
    expect(result.scannedBytes).toBeLessThanOrEqual(4 * 1024 * 1024);
  });

  it("packs commit-pinned implementation evidence without retaining a corpus", async () => {
    vi.stubGlobal("fetch", githubFetch());
    const result = await buildPublicSourceEvidence(
      project,
      ["navigateUsingPrefetchedRouteTree", "readRouteCacheEntry", "fetchServerResponse"],
      { maxCharacters: 4_000 },
    );

    expect(result.evidence[0].content).toContain("navigateUsingPrefetchedRouteTree");
    expect(result.evidence[0].content).toContain("fetchServerResponse");
    expect(result.evidence[0].sourceUrl).toContain(`/blob/${commit}/src/client/segment-cache/navigation.ts#L1-L9`);
  });

  it("uses the second evidence slot for a newly covered symbol in the main flow", async () => {
    const spacedNavigation = [
      "function navigateUsingPrefetchedRouteTree() {",
      "  return readRouteCacheEntry()",
      "}",
      ...Array.from({ length: 90 }, () => "// spacing"),
      "async function navigateToUnknownRoute(route: unknown) {",
      "  return fetchServerResponse(route)",
      "}",
    ].join("\n");
    vi.stubGlobal("fetch", vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.includes("/git/commits/")) return Response.json({ tree: { sha: "tree-sha" } });
      if (url.includes("/git/trees/")) {
        return Response.json({
          truncated: false,
          tree: [
            { path: "src/client/segment-cache/navigation.ts", type: "blob", size: spacedNavigation.length },
            { path: "src/client/fetch-server-response.ts", type: "blob", size: 80 },
          ],
        });
      }
      if (url.endsWith("/src/client/segment-cache/navigation.ts")) return new Response(spacedNavigation);
      return new Response("export async function fetchServerResponse() { return null }");
    }));

    const result = await buildPublicSourceEvidence(
      project,
      ["navigateUsingPrefetchedRouteTree", "readRouteCacheEntry", "fetchServerResponse"],
      { maxCharacters: 5_000, pathHints: ["src/client/segment-cache/navigation.ts"] },
    );

    expect(result.evidence).toHaveLength(2);
    expect(result.evidence[0].symbols).toEqual(expect.arrayContaining([
      "navigateUsingPrefetchedRouteTree",
      "readRouteCacheEntry",
    ]));
    expect(result.evidence[1]).toMatchObject({
      path: "src/client/segment-cache/navigation.ts",
      symbols: ["fetchServerResponse"],
    });
    expect(result.evidence[1].content).toContain("return fetchServerResponse(route)");
    expect(result.resolution.scannedFiles).toBe(1);
    expect(result.resolution.scannedBytes).toBe(spacedNavigation.length);
  });
});
