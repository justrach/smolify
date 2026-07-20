import { afterEach, describe, expect, it, vi } from "vitest";
import { readPublicSource } from "./public-source";

const commit = "0123456789abcdef0123456789abcdef01234567";
const publicProject = {
  sourceType: "github" as const,
  sourceUrl: "https://github.com/example/runtime",
  sourceCommit: commit,
  sourceRetention: "public-symbols" as const,
};

afterEach(() => vi.unstubAllGlobals());

describe("commit-pinned public source reads", () => {
  it("returns only the requested bounded lines and a commit link", async () => {
    const fetchMock = vi.fn(async () => new Response([
      "export function navigate() {",
      "  return readRouteCacheEntry()",
      "}",
      "fetchServerResponse()",
    ].join("\n")));
    vi.stubGlobal("fetch", fetchMock);

    const result = await readPublicSource(publicProject, {
      path: "src/navigation.ts",
      startLine: 2,
      endLine: 3,
    });

    expect(fetchMock).toHaveBeenCalledWith(
      `https://raw.githubusercontent.com/example/runtime/${commit}/src/navigation.ts`,
      expect.objectContaining({ redirect: "manual" }),
    );
    expect(result.content).toBe("  return readRouteCacheEntry()\n}");
    expect(result.returnedRange).toEqual({ startLine: 2, endLine: 3 });
    expect(result.sourceUrl).toContain(`/blob/${commit}/src/navigation.ts#L2-L3`);
    expect(result.truncated).toBe(false);
  });

  it("refuses metadata-only projects and unsafe paths before fetching", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    await expect(readPublicSource(
      { ...publicProject, sourceRetention: "metadata-only" },
      { path: "src/navigation.ts", startLine: 1, endLine: 10 },
    )).rejects.toThrow("metadata-only");
    await expect(readPublicSource(
      publicProject,
      { path: "../.env", startLine: 1, endLine: 10 },
    )).rejects.toThrow("safe source-code paths");
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("enforces the 200-line read boundary", async () => {
    await expect(readPublicSource(
      publicProject,
      { path: "src/navigation.ts", startLine: 1, endLine: 201 },
    )).rejects.toThrow("200 consecutive lines");
  });

  it("rejects oversized upstream files before decoding", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response("x", {
      headers: { "content-length": String(512 * 1024 + 1) },
    })));
    await expect(readPublicSource(
      publicProject,
      { path: "src/navigation.ts", startLine: 1, endLine: 10 },
    )).rejects.toThrow("512 KB");
  });

  it("does not follow upstream redirects", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response(null, {
      status: 302,
      headers: { location: "https://example.invalid/source.ts" },
    })));
    await expect(readPublicSource(
      publicProject,
      { path: "src/navigation.ts", startLine: 1, endLine: 10 },
    )).rejects.toThrow("Public source read failed (302)");
  });
});
