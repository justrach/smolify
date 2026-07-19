import { contextSearchFacets, exactIdentifierCandidates } from "./search";
import { getActiveDocPage, searchActiveDocs, searchBm25Docs, type SearchRow } from "./search-repository";

type ContextCandidate = SearchRow & {
  retrieval: "exact_identifier" | "bm25";
  matchedFacets: string[];
  allTermsFacetCount: number;
};

function lowValuePenalty(slug: string) {
  if (slug.startsWith("files/")) return 4;
  if (slug === "repository-map") return 3;
  if (slug === "introduction") return 2;
  return 0;
}

export async function buildDocsContext(
  env: CloudflareEnv,
  project: string,
  task: string,
  options: { maxTokens: number; maxPages: number },
) {
  const identifiers = exactIdentifierCandidates(task).slice(0, 3);
  const facets = contextSearchFacets(task);
  const [primary, ...lexical] = await Promise.all([
    searchActiveDocs(env, project, task, Math.max(options.maxPages * 2, 8), identifiers),
    ...facets.map((facet) => searchBm25Docs(
      env,
      project,
      facet,
      Math.max(options.maxPages, 6),
      identifiers,
    )),
  ]);
  const candidates = new Map<string, ContextCandidate>();
  const addCandidate = (
    result: SearchRow,
    facet: string,
    allTerms: boolean,
    retrieval: ContextCandidate["retrieval"],
  ) => {
    const existing = candidates.get(result.slug);
    if (existing) {
      if (!existing.matchedFacets.includes(facet)) existing.matchedFacets.push(facet);
      if (allTerms) existing.allTermsFacetCount += 1;
      existing.score = Math.min(existing.score, result.score);
      existing.matchedIdentifiers = [...new Set([...existing.matchedIdentifiers, ...result.matchedIdentifiers])];
      if (retrieval === "exact_identifier") existing.retrieval = retrieval;
      return;
    }
    candidates.set(result.slug, {
      ...result,
      retrieval,
      matchedFacets: [facet],
      allTermsFacetCount: allTerms ? 1 : 0,
    });
  };

  if (primary.matchMode === "exact_identifier") {
    for (const result of primary.results) addCandidate(result, "exact identifiers", true, "exact_identifier");
  }
  lexical.forEach((response, index) => {
    for (const result of response.results) {
      addCandidate(result, facets[index], response.matchMode === "all_terms", "bm25");
    }
  });
  if (!candidates.size) {
    for (const result of primary.results) addCandidate(
      result,
      "full task fallback",
      primary.matchMode === "all_terms",
      result.matchReason === "exact_identifier" ? "exact_identifier" : "bm25",
    );
  }

  const ordered = [...candidates.values()].sort((left, right) => {
    if (left.retrieval !== right.retrieval) return left.retrieval === "exact_identifier" ? -1 : 1;
    const penalty = lowValuePenalty(left.slug) - lowValuePenalty(right.slug);
    if (penalty) return penalty;
    if (left.allTermsFacetCount !== right.allTermsFacetCount) return right.allTermsFacetCount - left.allTermsFacetCount;
    if (left.matchedFacets.length !== right.matchedFacets.length) return right.matchedFacets.length - left.matchedFacets.length;
    return left.score - right.score;
  });
  const maxCharacters = options.maxTokens * 4;
  let remaining = Math.max(0, maxCharacters - 2_400);
  const maxPackedPages = Math.min(
    options.maxPages,
    ordered.length,
    Math.max(1, Math.floor(maxCharacters / 4_500)),
  );
  const pages: Array<{
    slug: string;
    title: string;
    description: string;
    sourceFiles: string[];
    sourceFileCount: number;
    sourceFilesTruncated: boolean;
    retrieval: "exact_identifier" | "bm25";
    matchReason: SearchRow["matchReason"];
    matchedIdentifiers: string[];
    matchedFacets: string[];
    totalLength: number;
    markdown: string;
    truncated: boolean;
  }> = [];
  const omitted: Array<{ slug: string; reason: string }> = [];

  for (const candidate of ordered) {
    if (pages.length >= maxPackedPages) {
      omitted.push({ slug: candidate.slug, reason: "max_pages" });
      continue;
    }
    if (remaining < 750) {
      omitted.push({ slug: candidate.slug, reason: "token_budget" });
      continue;
    }
    const slots = Math.max(1, maxPackedPages - pages.length);
    const requestedLength = Math.min(12_000, Math.max(750, Math.floor(remaining / slots)));
    const page = await getActiveDocPage(env, project, candidate.slug, 0, requestedLength);
    if (!page) {
      omitted.push({ slug: candidate.slug, reason: "page_unavailable" });
      continue;
    }
    const sourceFiles: string[] = [];
    let sourceFileCharacters = 0;
    for (const sourceFile of page.sourceFiles) {
      if (sourceFiles.length >= 8 || sourceFileCharacters + sourceFile.length > 1_000) break;
      sourceFiles.push(sourceFile);
      sourceFileCharacters += sourceFile.length;
    }
    const pageOverhead = page.slug.length + page.title.length + page.description.length
      + sourceFileCharacters + 320;
    const markdownBudget = remaining - pageOverhead;
    if (markdownBudget < 300) {
      omitted.push({ slug: candidate.slug, reason: "token_budget" });
      continue;
    }
    const markdown = page.markdown.slice(0, markdownBudget);
    pages.push({
      slug: page.slug,
      title: page.title,
      description: page.description,
      sourceFiles,
      sourceFileCount: page.sourceFiles.length,
      sourceFilesTruncated: sourceFiles.length < page.sourceFiles.length,
      retrieval: candidate.retrieval,
      matchReason: candidate.matchReason,
      matchedIdentifiers: candidate.matchedIdentifiers,
      matchedFacets: candidate.matchedFacets,
      totalLength: page.totalLength,
      markdown,
      truncated: markdown.length < page.totalLength,
    });
    remaining -= pageOverhead + markdown.length;
  }

  return {
    project,
    task,
    strategy: {
      embeddings: false,
      answerModel: false,
      exactIdentifiers: identifiers,
      facets,
      retrieval: ["exact_identifier", "fts5_bm25"],
      packing: "facet-diverse, value-ordered bounded page slices",
    },
    retrieval: {
      primaryMatchMode: primary.matchMode,
      facetMatches: lexical.map((response, index) => ({
        facet: facets[index],
        matchMode: response.matchMode,
        fallbackUsed: response.fallbackUsed,
      })),
      lexicalFallbackUsed: lexical.some((response) => response.fallbackUsed),
      candidateCount: ordered.length,
    },
    pages,
    omitted: omitted.slice(0, 8),
    omittedCount: omitted.length,
    omittedTruncated: omitted.length > 8,
    approximateTokensUsed: Math.ceil((maxCharacters - remaining) / 4),
    synthesisRequired: true,
    instruction: "Synthesize an answer from these pages, cite sourceFiles, label uncertainty, and use read_public_source only when exact implementation lines are necessary.",
  };
}
