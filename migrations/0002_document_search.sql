-- A deployment is immutable. Search always joins through the project's active
-- deployment, so an index can be built completely before one pointer flips.
CREATE TABLE IF NOT EXISTS doc_pages (
  id TEXT PRIMARY KEY NOT NULL,
  project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  deployment_id TEXT NOT NULL REFERENCES deployments(id) ON DELETE CASCADE,
  slug TEXT NOT NULL,
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  headings TEXT NOT NULL,
  symbols TEXT NOT NULL,
  body_text TEXT NOT NULL,
  source_files TEXT NOT NULL,
  markdown TEXT NOT NULL,
  UNIQUE(deployment_id, slug)
);
CREATE INDEX IF NOT EXISTS doc_pages_project_deployment_idx
  ON doc_pages(project_id, deployment_id);

-- This deliberately mirrors sglaw: an external-content FTS5 index, one
-- tokenizer everywhere, and per-field BM25 weights at query time.
CREATE VIRTUAL TABLE IF NOT EXISTS doc_pages_fts USING fts5(
  project_id UNINDEXED,
  deployment_id UNINDEXED,
  slug UNINDEXED,
  title,
  description,
  headings,
  symbols,
  body_text,
  source_files,
  content='doc_pages',
  content_rowid='rowid',
  tokenize='porter unicode61 remove_diacritics 1'
);

CREATE TRIGGER IF NOT EXISTS doc_pages_ai AFTER INSERT ON doc_pages BEGIN
  INSERT INTO doc_pages_fts(
    rowid, project_id, deployment_id, slug, title, description,
    headings, symbols, body_text, source_files
  ) VALUES (
    new.rowid, new.project_id, new.deployment_id, new.slug, new.title,
    new.description, new.headings, new.symbols, new.body_text, new.source_files
  );
END;

CREATE TRIGGER IF NOT EXISTS doc_pages_ad AFTER DELETE ON doc_pages BEGIN
  INSERT INTO doc_pages_fts(
    doc_pages_fts, rowid, project_id, deployment_id, slug, title,
    description, headings, symbols, body_text, source_files
  ) VALUES (
    'delete', old.rowid, old.project_id, old.deployment_id, old.slug,
    old.title, old.description, old.headings, old.symbols, old.body_text,
    old.source_files
  );
END;

CREATE TRIGGER IF NOT EXISTS doc_pages_au AFTER UPDATE ON doc_pages BEGIN
  INSERT INTO doc_pages_fts(
    doc_pages_fts, rowid, project_id, deployment_id, slug, title,
    description, headings, symbols, body_text, source_files
  ) VALUES (
    'delete', old.rowid, old.project_id, old.deployment_id, old.slug,
    old.title, old.description, old.headings, old.symbols, old.body_text,
    old.source_files
  );
  INSERT INTO doc_pages_fts(
    rowid, project_id, deployment_id, slug, title, description,
    headings, symbols, body_text, source_files
  ) VALUES (
    new.rowid, new.project_id, new.deployment_id, new.slug, new.title,
    new.description, new.headings, new.symbols, new.body_text, new.source_files
  );
END;
