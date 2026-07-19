ALTER TABLE projects ADD COLUMN source_owner_github_id INTEGER;
ALTER TABLE projects ADD COLUMN source_owner_login TEXT;
ALTER TABLE projects ADD COLUMN source_owner_type TEXT
  CHECK (source_owner_type IN ('Organization', 'User'));

CREATE INDEX IF NOT EXISTS projects_source_owner_github_id_idx
  ON projects(source_owner_github_id);

-- "Official" is source provenance, not a security claim. Numeric GitHub IDs
-- prevent a renamed or lookalike account from inheriting the badge.
CREATE TABLE IF NOT EXISTS github_official_publishers (
  github_owner_id INTEGER PRIMARY KEY NOT NULL,
  login TEXT NOT NULL COLLATE NOCASE UNIQUE,
  display_name TEXT NOT NULL,
  website_url TEXT NOT NULL,
  github_url TEXT NOT NULL,
  verification_method TEXT NOT NULL DEFAULT 'curated_github_org_id'
    CHECK (verification_method IN ('curated_github_org_id')),
  verified_at TEXT NOT NULL
);

INSERT OR IGNORE INTO github_official_publishers
  (github_owner_id, login, display_name, website_url, github_url, verified_at)
VALUES
  (314135, 'cloudflare', 'Cloudflare', 'https://www.cloudflare.com', 'https://github.com/cloudflare', '2026-07-19T00:00:00.000Z'),
  (14957082, 'openai', 'OpenAI', 'https://openai.com', 'https://github.com/openai', '2026-07-19T00:00:00.000Z'),
  (14985020, 'vercel', 'Vercel', 'https://vercel.com', 'https://github.com/vercel', '2026-07-19T00:00:00.000Z'),
  (182288589, 'modelcontextprotocol', 'Model Context Protocol', 'https://modelcontextprotocol.io', 'https://github.com/modelcontextprotocol', '2026-07-19T00:00:00.000Z');

-- Backfill the public launch catalog. Future imports use owner data returned
-- by GitHub's repository API instead of trusting the URL string alone.
UPDATE projects SET source_owner_github_id = 314135, source_owner_login = 'cloudflare', source_owner_type = 'Organization'
  WHERE lower(source_url) LIKE 'https://github.com/cloudflare/%';
UPDATE projects SET source_owner_github_id = 14957082, source_owner_login = 'openai', source_owner_type = 'Organization'
  WHERE lower(source_url) LIKE 'https://github.com/openai/%';
UPDATE projects SET source_owner_github_id = 14985020, source_owner_login = 'vercel', source_owner_type = 'Organization'
  WHERE lower(source_url) LIKE 'https://github.com/vercel/%';
UPDATE projects SET source_owner_github_id = 182288589, source_owner_login = 'modelcontextprotocol', source_owner_type = 'Organization'
  WHERE lower(source_url) LIKE 'https://github.com/modelcontextprotocol/%';
