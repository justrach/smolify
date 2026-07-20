import { describe, expect, it } from "vitest";
import { analyzeSourceStructure, maskSourceForStructure } from "./source-analysis";

describe("value-free source structure analysis", () => {
  it("extracts scoped TypeScript calls and ignores string, comment, and regex decoys", () => {
    const source = [
      "import {",
      "  readRouteCacheEntry,",
      "} from './cache'",
      "import { fetchServerResponse } from '../router/fetch-server-response'",
      "function navigateImpl() {",
      "  const text = 'fetchServerResponse()'",
      "  const expression = /readRouteCacheEntry\\(/",
      "  // navigateUsingPrefetchedRouteTree()",
      "  const route = readRouteCacheEntry()",
      "  if (route) return navigateUsingPrefetchedRouteTree(route)",
      "  return navigateToUnknownRoute()",
      "}",
      "function navigateUsingPrefetchedRouteTree(route: unknown) {",
      "  return navigateToKnownRoute(route)",
      "}",
      "async function navigateToUnknownRoute() {",
      "  return fetchServerResponse()",
      "}",
    ].join("\n");
    const analysis = analyzeSourceStructure(source, "src/segment-cache/navigation.ts", [
      "readRouteCacheEntry",
      "navigateUsingPrefetchedRouteTree",
      "fetchServerResponse",
    ]);

    expect(analysis.imports).toEqual(expect.arrayContaining([
      expect.objectContaining({ symbol: "readRouteCacheEntry", module: "./cache" }),
      expect.objectContaining({ symbol: "fetchServerResponse", module: "../router/fetch-server-response" }),
    ]));
    expect(analysis.definitions).toEqual(expect.arrayContaining([
      expect.objectContaining({ name: "navigateImpl", line: 5, endLine: 12, callable: true }),
      expect.objectContaining({ name: "navigateToUnknownRoute", line: 16, endLine: 18, callable: true }),
    ]));
    expect(analysis.calls.filter((call) => call.scopeName === "navigateImpl").map((call) => call.name))
      .toEqual(["readRouteCacheEntry", "navigateUsingPrefetchedRouteTree", "navigateToUnknownRoute"]);
    expect(analysis.calls.filter((call) => call.scopeName === "navigateToUnknownRoute").map((call) => call.name))
      .toEqual(["fetchServerResponse"]);
    expect(analysis.occurrences.filter((occurrence) => occurrence.symbol === "fetchServerResponse"))
      .toEqual([
        expect.objectContaining({ line: 4, kind: "import" }),
        expect.objectContaining({ line: 17, kind: "reference", scopeName: "navigateToUnknownRoute" }),
      ]);
  });

  it("tracks Python indentation scopes while excluding comments and docstrings", () => {
    const source = [
      "def route():",
      "    \"\"\"fake_call() in documentation\"\"\"",
      "    # fake_call() in a comment",
      "    return register_rule()",
      "",
      "def register_rule():",
      "    return dispatch_request()",
    ].join("\n");
    const analysis = analyzeSourceStructure(source, "app/routes.py", ["register_rule", "fake_call"]);

    expect(analysis.calls.map((call) => `${call.scopeName}:${call.name}`)).toEqual([
      "route:register_rule",
      "register_rule:dispatch_request",
    ]);
    expect(analysis.occurrences.some((occurrence) => occurrence.symbol === "fake_call")).toBe(false);
    expect(analysis.definitions.find((definition) => definition.name === "route")?.endLine).toBe(5);
  });

  it("degrades safely on malformed source", () => {
    const source = "function incomplete() {\n  targetCall(\n  const text = 'unterminated";
    expect(() => analyzeSourceStructure(source, "src/incomplete.ts", ["targetCall"])).not.toThrow();
    expect(analyzeSourceStructure(source, "src/incomplete.ts", ["targetCall"]).calls[0])
      .toMatchObject({ name: "targetCall", scopeName: "incomplete" });
  });

  it("preserves line boundaries while masking untrusted literal text", () => {
    const source = "const a = \"secretCall()\";\nrealCall();\n/* fakeCall() */";
    const masked = maskSourceForStructure(source, "src/example.ts");
    expect(masked.split("\n")).toHaveLength(source.split("\n").length);
    expect(masked).toContain("realCall()");
    expect(masked).not.toContain("secretCall");
    expect(masked).not.toContain("fakeCall");
  });
});
