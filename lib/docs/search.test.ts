import { describe, expect, it } from "vitest";
import { contextSearchFacets, exactIdentifierCandidates, pageToSearchDocument, toFtsMatch } from "./search";

describe("documentation search indexing", () => {
  it("adds aliases for code identifiers and source paths", () => {
    const indexed = pageToSearchDocument({
      slug: "users/create",
      title: "Create a user",
      description: "",
      markdown: "# Create user\n\nCall `createUserById` with `POST /v1/users`.",
      sourceFiles: ["src/api/userRoutes.ts"],
    });
    expect(indexed.headings).toContain("Create user");
    expect(indexed.symbols).toContain("create user by id");
    expect(indexed.symbols).toContain("user routes");
  });

  it("turns untrusted text into a quoted prefix expression", () => {
    expect(toFtsMatch('title:x OR "oops"')).not.toContain(" OR ");
    expect(toFtsMatch("getUserById")).toContain('"get" *');
    expect(toFtsMatch("getUserById", "any")).toContain(" OR ");
  });

  it("recognizes code identifiers without treating ordinary prose as exact", () => {
    expect(exactIdentifierCandidates("trace navigateUsingPrefetchedRouteTree and get_errors in packages/next/src/server.ts"))
      .toEqual([
        "navigateUsingPrefetchedRouteTree",
        "get_errors",
        "packages/next/src/server.ts",
    ]);
    expect(exactIdentifierCandidates("explain instant navigation behavior")).toEqual([]);
    expect(exactIdentifierCandidates(
      "Explain Next.js navigation with navigateUsingPrefetchedRouteTree, readRouteCacheEntry, and fetchServerResponse",
    )).toEqual([
      "navigateUsingPrefetchedRouteTree",
      "readRouteCacheEntry",
      "fetchServerResponse",
    ]);
  });

  it("turns natural tasks into focused retrieval facets", () => {
    expect(contextSearchFacets(
      "Explain Instant Navigation and Partial Prefetching; compare Stream, Cache, and Block; list flags and migration gotchas",
    )).toEqual([
      "Instant Navigation Partial Prefetching",
      "Stream Cache Block",
      "flags migration gotchas",
    ]);
  });
});
