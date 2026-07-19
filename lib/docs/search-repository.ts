import { exactIdentifierCandidates, toFtsMatch } from "./search";

export type SearchRow = {
  slug: string;
  title: string;
  description: string;
  score: number;
  snippet: string;
  sourceFiles: string[];
  matchReason: "exact_identifier" | "all_terms" | "any_term";
  matchedIdentifiers: string[];
};

type SearchDatabaseRow = Omit<SearchRow, "sourceFiles" | "matchReason" | "matchedIdentifiers"> & {
  sourceFiles: string;
};

type ExactSearchDatabaseRow = SearchDatabaseRow & { symbols: string };

const SEARCH_SQL = `
  SELECT p.slug, p.title, p.description, p.source_files AS sourceFiles,
    bm25(doc_pages_fts, 0, 0, 0, 8.0, 3.0, 5.0, 10.0, 1.0, 2.0) AS score,
    snippet(doc_pages_fts, 7, '<mark>', '</mark>', '…', 36) AS snippet
  FROM doc_pages_fts
  JOIN doc_pages p ON p.rowid = doc_pages_fts.rowid
  JOIN projects project ON project.id = p.project_id
  WHERE doc_pages_fts MATCH ?
    AND project.slug = ?
    AND project.active_deployment_id = p.deployment_id
    AND project.deleted_at IS NULL
  ORDER BY score
  LIMIT ?`;

const EXACT_IDENTIFIER_SQL = `
  SELECT p.slug, p.title, p.description, p.source_files AS sourceFiles,
    p.symbols, -1000.0 AS score, substr(p.description, 1, 280) AS snippet
  FROM doc_pages p
  JOIN projects project ON project.id = p.project_id
  WHERE instr(char(10) || lower(p.symbols) || char(10), char(10) || lower(?) || char(10)) > 0
    AND project.slug = ?
    AND project.active_deployment_id = p.deployment_id
    AND project.deleted_at IS NULL
  ORDER BY p.rowid
  LIMIT ?`;

async function searchExactIdentifiers(
  env: CloudflareEnv,
  project: string,
  identifiers: string[],
  limit: number,
): Promise<SearchRow[]> {
  if (!identifiers.length) return [];
  const matches = new Map<string, ExactSearchDatabaseRow & { matchedIdentifiers: string[] }>();
  for (const identifier of identifiers) {
    const result = await env.DB.prepare(EXACT_IDENTIFIER_SQL)
      .bind(identifier, project, limit)
      .all<ExactSearchDatabaseRow>();
    for (const row of result.results) {
      const existing = matches.get(row.slug);
      if (existing) {
        existing.matchedIdentifiers.push(identifier);
      } else {
        matches.set(row.slug, { ...row, matchedIdentifiers: [identifier] });
      }
    }
  }
  return [...matches.values()]
    .sort((a, b) => b.matchedIdentifiers.length - a.matchedIdentifiers.length || a.slug.localeCompare(b.slug))
    .slice(0, limit)
    .map((row) => ({
      slug: row.slug,
      title: row.title,
      description: row.description,
      score: row.score - row.matchedIdentifiers.length,
      snippet: `Exact identifier match: ${row.matchedIdentifiers.map((identifier) => `\`${identifier}\``).join(", ")}. ${row.snippet}`.trim(),
      sourceFiles: row.sourceFiles.split("\n").filter(Boolean),
      matchReason: "exact_identifier" as const,
      matchedIdentifiers: row.matchedIdentifiers,
    }));
}

export async function searchActiveDocs(
  env: CloudflareEnv,
  project: string,
  query: string,
  limit: number,
  requestedIdentifiers = exactIdentifierCandidates(query),
) {
  const exactResults = await searchExactIdentifiers(env, project, requestedIdentifiers, limit);
  if (exactResults.length) {
    const matched = new Set(exactResults.flatMap((result) => result.matchedIdentifiers));
    return {
      query,
      matchMode: "exact_identifier" as const,
      confidence: "high" as const,
      fallbackUsed: false,
      fallbackReason: null,
      identifierCoverage: {
        requested: requestedIdentifiers,
        matched: requestedIdentifiers.filter((identifier) => matched.has(identifier)),
        unmatched: requestedIdentifiers.filter((identifier) => !matched.has(identifier)),
      },
      results: exactResults,
    };
  }

  return searchBm25Docs(env, project, query, limit, requestedIdentifiers);
}

export async function searchBm25Docs(
  env: CloudflareEnv,
  project: string,
  query: string,
  limit: number,
  requestedIdentifiers = exactIdentifierCandidates(query),
) {
  let matchMode: "all_terms" | "any_term" = "all_terms";
  let result = await env.DB.prepare(SEARCH_SQL)
    .bind(toFtsMatch(query), project, limit)
    .all<SearchDatabaseRow>();
  if (!result.results.length) {
    matchMode = "any_term";
    result = await env.DB.prepare(SEARCH_SQL)
      .bind(toFtsMatch(query, "any"), project, limit)
      .all<SearchDatabaseRow>();
  }
  return {
    query,
    matchMode,
    confidence: matchMode === "all_terms" ? "medium" as const : "low" as const,
    fallbackUsed: matchMode === "any_term",
    fallbackReason: matchMode === "any_term" ? "No active page matched every query term." : null,
    identifierCoverage: {
      requested: requestedIdentifiers,
      matched: [],
      unmatched: requestedIdentifiers,
    },
    results: result.results.map((row) => ({
      ...row,
      sourceFiles: row.sourceFiles.split("\n").filter(Boolean),
      matchReason: matchMode,
      matchedIdentifiers: [],
    })),
  };
}

export async function getActiveDocPage(
  env: CloudflareEnv,
  project: string,
  slug: string,
  offset: number,
  length: number,
) {
  const page = await env.DB.prepare(
    `SELECT p.slug, p.title, p.description, p.source_files AS sourceFiles,
       length(p.markdown) AS totalLength,
       substr(p.markdown, ?, ?) AS markdown
     FROM doc_pages p
     JOIN projects project ON project.id = p.project_id
     WHERE project.slug = ?
       AND project.active_deployment_id = p.deployment_id
       AND p.slug = ?
       AND project.deleted_at IS NULL`,
  )
    .bind(offset + 1, length, project, slug)
    .first<{
      slug: string;
      title: string;
      description: string;
      sourceFiles: string;
      totalLength: number;
      markdown: string;
    }>();
  return page ? {
    ...page,
    sourceFiles: page.sourceFiles.split("\n").filter(Boolean),
  } : null;
}

export async function listActiveDocPages(env: CloudflareEnv, project: string) {
  const result = await env.DB.prepare(
    `SELECT p.slug, p.title, p.description, p.source_files AS sourceFiles
     FROM doc_pages p
     JOIN projects project ON project.id = p.project_id
     WHERE project.slug = ?
       AND project.active_deployment_id = p.deployment_id
       AND project.deleted_at IS NULL
     ORDER BY p.rowid
     LIMIT 500`,
  )
    .bind(project)
    .all<{ slug: string; title: string; description: string; sourceFiles: string }>();
  return result.results.map((page) => ({
    ...page,
    sourceFiles: page.sourceFiles.split("\n").filter(Boolean),
  }));
}
