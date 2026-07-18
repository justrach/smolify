import { toFtsMatch } from "./search";

export type SearchRow = {
  slug: string;
  title: string;
  description: string;
  score: number;
  snippet: string;
};

const SEARCH_SQL = `
  SELECT p.slug, p.title, p.description,
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

export async function searchActiveDocs(
  env: CloudflareEnv,
  project: string,
  query: string,
  limit: number,
) {
  let matchMode: "all_terms" | "any_term" = "all_terms";
  let result = await env.DB.prepare(SEARCH_SQL)
    .bind(toFtsMatch(query), project, limit)
    .all<SearchRow>();
  if (!result.results.length) {
    matchMode = "any_term";
    result = await env.DB.prepare(SEARCH_SQL)
      .bind(toFtsMatch(query, "any"), project, limit)
      .all<SearchRow>();
  }
  return { query, matchMode, results: result.results };
}

export async function getActiveDocPage(
  env: CloudflareEnv,
  project: string,
  slug: string,
  offset: number,
  length: number,
) {
  return env.DB.prepare(
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
}
