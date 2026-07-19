import { describe, expect, it } from "vitest";
import { strToU8, zipSync } from "fflate";
import {
  buildRepositoryBundle,
  parseGithubRepositoryUrl,
  selectGithubSourceContentCandidates,
  snapshotFromZip,
  type RepositoryFile,
} from "./repository";

describe("repository imports", () => {
  it("accepts only GitHub repository root URLs", () => {
    expect(parseGithubRepositoryUrl("https://github.com/justrach/smolify.git")).toEqual({
      owner: "justrach",
      repository: "smolify",
      url: "https://github.com/justrach/smolify",
    });
    expect(() => parseGithubRepositoryUrl("https://example.com/owner/repo")).toThrow();
    expect(() => parseGithubRepositoryUrl("https://github.com/owner/repo/issues")).toThrow();
  });

  it("turns a repository snapshot into useful, source-grounded pages", () => {
    const bundle = buildRepositoryBundle({
      name: "Tiny API",
      description: "A tiny API",
      sourceUrl: "https://github.com/example/tiny-api",
      revision: "main",
      totalFiles: 4,
      files: [
        { path: "README.md", content: "# Tiny API\n\nUse it carefully." },
        { path: "package.json", content: JSON.stringify({ scripts: { test: "vitest" }, dependencies: { zod: "4" } }) },
        { path: "src/routes/users.ts", content: "export const users = true" },
        { path: "tests/users.test.ts", content: "test('users', () => {})" },
      ],
    });
    expect(bundle.generator).toEqual({ name: "smolify", model: "deterministic-repository-import-v2" });
    expect(bundle.pages.map((page) => page.slug)).toEqual(expect.arrayContaining([
      "introduction",
      "repository-map",
      "development",
      "files/src",
    ]));
    expect(bundle.pages[0].markdown).toContain("Use it carefully");
    expect(bundle.pages[1].markdown).toContain("src/routes/users.ts");
    expect(bundle.pages.some((page) => page.slug.startsWith("source/"))).toBe(false);
  });

  it("creates value-free symbol and call-relationship pages only for public source", () => {
    const bundle = buildRepositoryBundle({
      name: "Public runtime",
      description: "A public source import",
      sourceUrl: "https://github.com/example/runtime",
      revision: "main@abc123",
      sourceCommit: "abc123",
      sourceRetention: "public-symbols",
      totalFiles: 3,
      files: [
        { path: "README.md", content: "# Runtime" },
        {
          path: "src/navigation.ts",
          content: [
            "import { readRouteCacheEntry } from './cache'",
            "export async function navigateUsingPrefetchedRouteTree() {",
            "  const secret = 'must-not-be-retained'",
            "  const entry = readRouteCacheEntry()",
            "  return fetchServerResponse(entry)",
            "}",
            "// ignoredCommentCall()",
            "const prose = 'ignoredStringCall()'",
          ].join("\n"),
        },
        {
          path: "src/worker.py",
          content: [
            "def run_worker():",
            "    \"\"\"ignoredDocstringCall()",
            "    stillIgnoredCall()\"\"\"",
            "    # ignoredHashCall()",
            "    return real_worker_call()",
          ].join("\n"),
        },
      ],
    });
    const source = bundle.pages.find((page) => page.slug === "source/src/navigation");
    expect(source?.markdown).toContain("`navigateUsingPrefetchedRouteTree`");
    expect(source?.markdown).toContain("`readRouteCacheEntry`");
    expect(source?.markdown).toContain("`fetchServerResponse`");
    expect(source?.markdown).toContain("exported function at line 2; references `readRouteCacheEntry`, `fetchServerResponse`");
    expect(source?.markdown).not.toContain("ignoredCommentCall");
    expect(source?.markdown).not.toContain("ignoredStringCall");
    expect(source?.markdown).toContain("/blob/abc123/src/navigation.ts#L2");
    expect(source?.markdown).not.toContain("must-not-be-retained");
    expect(source?.sourceFiles).toEqual(["src/navigation.ts"]);
    const pythonSource = bundle.pages.find((page) => page.slug === "source/src/worker");
    expect(pythonSource?.markdown).toContain("`real_worker_call`");
    expect(pythonSource?.markdown).not.toContain("ignoredDocstringCall");
    expect(pythonSource?.markdown).not.toContain("stillIgnoredCall");
    expect(pythonSource?.markdown).not.toContain("ignoredHashCall");
    expect(bundle.navigation.some((group) => group.label === "Source symbols")).toBe(true);
  });

  it("reserves public source sampling capacity for high-value navigation internals", () => {
    const ordinary = Array.from({ length: 180 }, (_, index) => ({
      path: `packages/package-${String(index).padStart(3, "0")}/src/utils/helper-${index}.ts`,
      type: "blob" as const,
      size: 8_000,
    }));
    const navigation = {
      path: "packages/next/src/client/components/segment-cache/navigation.ts",
      type: "blob" as const,
      size: 32_000,
    };
    const selected = selectGithubSourceContentCandidates([...ordinary, navigation]);

    expect(selected).toHaveLength(96);
    expect(selected.map((entry) => entry.path)).toContain(navigation.path);
    expect(selected.slice(0, 40).map((entry) => entry.path)).toContain(navigation.path);
  });

  it("turns repository guides into searchable pages and balances large file maps", () => {
    const files: RepositoryFile[] = Array.from({ length: 700 }, (_, index) => ({
      path: `.agents/skills/skill-${index}/SKILL.md`,
    }));
    files.push(
      { path: "docs/gateway/authentication.md", content: "---\ntitle: \"Authentication\"\nsummary: \"Gateway connection authentication and pairing\"\n---\n\nPair devices with signed challenges.\n\n```bash\n# This must not become the title\n```\n\n<script>unsafe()</script>\n[jump](javascript:unsafe())" },
      { path: "package.json", content: JSON.stringify({ scripts: { test: "vitest" } }) },
      { path: "src/gateway/server.ts" },
      { path: "extensions/discord/index.ts" },
    );
    files.push(...Array.from({ length: 130 }, (_, index) => ({ path: `packages/package-${index}/package.json` })));
    const bundle = buildRepositoryBundle({
      name: "Large repository",
      description: "A representative import test",
      sourceUrl: "https://github.com/example/large",
      revision: "main",
      totalFiles: files.length,
      files,
    });
    const guide = bundle.pages.find((page) => page.slug === "docs/gateway/authentication");
    expect(guide?.markdown).toContain("signed challenges");
    expect(guide?.markdown).not.toContain("title:");
    expect(guide?.markdown).not.toMatch(/<script\b|javascript:/i);
    expect(guide?.title).toBe("Authentication");
    expect(guide?.description).toBe("Gateway connection authentication and pairing");
    const map = bundle.pages.find((page) => page.slug === "repository-map");
    expect(map?.markdown).toContain("src/gateway/server.ts");
    expect(map?.markdown).toContain("extensions/discord/index.ts");
    expect(bundle.pages.some((page) => page.slug === "files/src")).toBe(true);
    expect(bundle.pages.every((page) => page.description.length <= 240)).toBe(true);
    expect(bundle.pages.every((page) => page.sourceFiles.length <= 100)).toBe(true);
  });

  it("imports a bounded ZIP without retaining the archive", () => {
    const zip = zipSync({
      "private-repo/README.md": strToU8("# Private API"),
      "private-repo/package.json": strToU8(JSON.stringify({ name: "private-api", description: "Secret source, public description" })),
      "private-repo/src/index.ts": strToU8("export const answer = 42"),
      "../outside.txt": strToU8("must not escape"),
    });
    const snapshot = snapshotFromZip(zip, "private-repo.zip");
    expect(snapshot.name).toBe("private-api");
    expect(snapshot.sourceUrl).toBeNull();
    expect(snapshot.files.map((file) => file.path)).toContain("README.md");
    expect(snapshot.files.some((file) => file.path.includes(".."))).toBe(false);
    expect(snapshot.sourceRetention).toBe("metadata-only");
    const bundle = buildRepositoryBundle(snapshot);
    expect(bundle.pages.some((page) => page.slug.startsWith("source/"))).toBe(false);
  });
});
