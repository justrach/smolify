import { describe, expect, it } from "vitest";
import type { PublicSymbolGraph } from "../imports/public-symbols";
import { packPublicSourceContext, type PublicSourceEvidenceItem } from "./source-context";

const commit = "abcdef0123456789abcdef0123456789abcdef01";
const sourceUrl = `https://github.com/example/runtime/blob/${commit}/src/navigation.ts`;

function graph(): PublicSymbolGraph {
  const definition = (name: string, line: number) => ({
    name,
    kind: "function",
    line,
    endLine: line + 10,
    exported: true,
    callable: true,
    path: `src/${name}.ts`,
    sourceUrl: `${sourceUrl}#L${line}`,
  });
  const edge = (from: string, to: string, line: number) => ({
    from,
    to,
    path: "src/navigation.ts",
    line,
    sourceUrl: `${sourceUrl}#L${line}`,
    scopeKind: "function",
    scopeStartLine: 1,
    scopeEndLine: 100,
  });
  return {
    definitionCoverage: {
      matched: ["readRouteCacheEntry", "fetchServerResponse"],
      unresolved: [],
    },
    definitions: [
      definition("readRouteCacheEntry", 10),
      definition("fetchServerResponse", 40),
    ],
    connectors: [{
      symbol: "navigateImpl",
      reaches: ["readRouteCacheEntry", "fetchServerResponse"],
      paths: [
        { target: "readRouteCacheEntry", symbols: ["navigateImpl", "readRouteCacheEntry"] },
        { target: "fetchServerResponse", symbols: ["navigateImpl", "navigateToUnknownRoute", "fetchServerResponse"] },
      ],
    }],
    callers: Array.from({ length: 12 }, (_, index) => edge(`caller${index}`, "readRouteCacheEntry", 60 + index)),
    callees: Array.from({ length: 12 }, (_, index) => edge("fetchServerResponse", `callee${index}`, 80 + index)),
  };
}

function evidence(): PublicSourceEvidenceItem[] {
  return [
    {
      path: "src/navigation.ts",
      symbols: ["readRouteCacheEntry"],
      sourceUrl: `${sourceUrl}#L1-L80`,
      returnedRange: { startLine: 1, endLine: 80 },
      content: `${"const route = readRouteCacheEntry()\n".repeat(80)}🐾`,
      truncated: false,
    },
    {
      path: "src/fetch.ts",
      symbols: ["fetchServerResponse"],
      sourceUrl: `${sourceUrl}#L100-L180`,
      returnedRange: { startLine: 100, endLine: 180 },
      content: "return fetchServerResponse()\n".repeat(80),
      truncated: false,
    },
  ];
}

describe("public source context packing", () => {
  it("enforces the serialized cap and prioritizes definitions and connectors", () => {
    const packed = packPublicSourceContext(graph(), evidence(), 4_000);

    expect(JSON.stringify({ graph: packed.graph, evidence: packed.evidence }).length).toBeLessThanOrEqual(4_000);
    expect(packed.charactersUsed).toBeLessThanOrEqual(4_000);
    expect(packed.graph.definitions.map((item) => item.name)).toEqual([
      "readRouteCacheEntry",
      "fetchServerResponse",
    ]);
    expect(packed.graph.connectors[0]?.symbol).toBe("navigateImpl");
    expect(packed.truncated).toBe(true);
  });

  it("keeps admitted graph arrays as prefixes when the budget grows", () => {
    const small = packPublicSourceContext(graph(), evidence(), 2_500);
    const large = packPublicSourceContext(graph(), evidence(), 7_000);

    for (const key of ["definitions", "connectors", "callers", "callees"] as const) {
      expect(large.graph[key].slice(0, small.graph[key].length)).toEqual(small.graph[key]);
    }
    expect(large.charactersUsed).toBeGreaterThanOrEqual(small.charactersUsed);
    expect(large.charactersUsed).toBeLessThanOrEqual(7_000);
  });

  it("never leaves a split unicode surrogate in a truncated excerpt", () => {
    const packed = packPublicSourceContext(graph(), evidence(), 3_000);
    for (const item of packed.evidence) {
      const last = item.content.charCodeAt(item.content.length - 1);
      expect(last >= 0xd800 && last <= 0xdbff).toBe(false);
    }
  });
});
