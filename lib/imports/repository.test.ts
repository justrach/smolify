import { describe, expect, it } from "vitest";
import { strToU8, zipSync } from "fflate";
import {
  buildRepositoryBundle,
  parseGithubRepositoryUrl,
  snapshotFromZip,
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
    expect(bundle.generator).toEqual({ name: "smolify", model: "deterministic-repository-import-v1" });
    expect(bundle.pages.map((page) => page.slug)).toEqual(["introduction", "repository-map", "development"]);
    expect(bundle.pages[0].markdown).toContain("Use it carefully");
    expect(bundle.pages[1].markdown).toContain("src/routes/users.ts");
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
  });
});
