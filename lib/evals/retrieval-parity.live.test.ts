import { describe, expect, it } from "vitest";
import { buildPublicSourceEvidence } from "../imports/public-symbols";
import { buildRepositoryBundle, fetchGithubSnapshot } from "../imports/repository";
import { evaluateSourceParity } from "./retrieval-parity";

const runLive = process.env.SMOLIFY_LIVE_PARITY === "1";
const identifiers = [
  "navigateUsingPrefetchedRouteTree",
  "readRouteCacheEntry",
  "fetchServerResponse",
  "navigateToUnknownRoute",
  "startPPRNavigation",
];
const navigationPath = "packages/next/src/client/components/segment-cache/navigation.ts";

describe.runIf(runLive)("live Next.js retrieval parity", () => {
  it("captures the architecture symbols and passes the pinned source-graph gate", async () => {
    const accessToken = process.env.GITHUB_TOKEN?.trim() || undefined;
    const snapshot = await fetchGithubSnapshot("https://github.com/vercel/next.js", accessToken);
    const bundle = buildRepositoryBundle(snapshot);
    const captured = identifiers.filter((identifier) =>
      bundle.pages.some((page) => page.markdown.includes(identifier)),
    );
    expect(captured).toEqual(identifiers);
    expect(snapshot.sourceCommit).toMatch(/^[a-f0-9]{40}$/);

    const evidence = await buildPublicSourceEvidence({
      sourceType: "github",
      sourceUrl: snapshot.sourceUrl,
      sourceCommit: snapshot.sourceCommit ?? null,
      sourceRetention: snapshot.sourceRetention ?? "metadata-only",
    }, identifiers.slice(0, 3), {
      maxCharacters: 6_000,
      pathHints: [navigationPath],
    }, accessToken);
    const result = evaluateSourceParity(evidence, {
      id: "live_next_navigation_trace",
      requiredSymbols: identifiers.slice(0, 3),
      requiredDefinitionPaths: {
        navigateUsingPrefetchedRouteTree: navigationPath,
        readRouteCacheEntry: "packages/next/src/client/components/segment-cache/cache.ts",
        fetchServerResponse: "packages/next/src/client/components/router-reducer/fetch-server-response.ts",
      },
      requiredEdges: [
        { from: "navigateImpl", to: "readRouteCacheEntry" },
        { from: "navigateImpl", to: "navigateUsingPrefetchedRouteTree" },
        { from: "navigateToUnknownRoute", to: "fetchServerResponse" },
      ],
      requiredConnector: { symbol: "navigateImpl", reaches: identifiers.slice(0, 3) },
      requiredEvidenceTerms: identifiers.slice(0, 3),
      maxScannedFiles: 6,
      maxScannedBytes: 4 * 1024 * 1024,
      maxEvidenceCharacters: 6_000,
    });

    expect(result.passed, JSON.stringify(result.checks.filter((check) => !check.passed))).toBe(true);
  }, 60_000);
});
