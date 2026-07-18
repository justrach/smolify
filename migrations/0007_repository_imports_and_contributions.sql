ALTER TABLE projects ADD COLUMN visibility TEXT NOT NULL DEFAULT 'public'
  CHECK (visibility IN ('public', 'private'));
ALTER TABLE projects ADD COLUMN source_type TEXT NOT NULL DEFAULT 'manual'
  CHECK (source_type IN ('manual', 'github', 'archive'));
ALTER TABLE projects ADD COLUMN source_url TEXT;
ALTER TABLE projects ADD COLUMN source_revision TEXT;
ALTER TABLE projects ADD COLUMN source_file_count INTEGER NOT NULL DEFAULT 0;
ALTER TABLE projects ADD COLUMN imported_at TEXT;

CREATE INDEX IF NOT EXISTS projects_visibility_updated_at_idx
  ON projects(visibility, updated_at DESC);

CREATE TABLE IF NOT EXISTS doc_ratings (
  id TEXT PRIMARY KEY NOT NULL,
  project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL REFERENCES "user"(id) ON DELETE CASCADE,
  score INTEGER NOT NULL CHECK (score BETWEEN 1 AND 5),
  notes TEXT,
  model TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  UNIQUE(project_id, user_id)
);
CREATE INDEX IF NOT EXISTS doc_ratings_project_id_idx
  ON doc_ratings(project_id, updated_at DESC);

CREATE TABLE IF NOT EXISTS doc_improvement_proposals (
  id TEXT PRIMARY KEY NOT NULL,
  project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  author_user_id TEXT NOT NULL REFERENCES "user"(id) ON DELETE CASCADE,
  base_deployment_id TEXT,
  object_key TEXT NOT NULL UNIQUE,
  model TEXT NOT NULL,
  summary TEXT NOT NULL,
  rationale TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'accepted', 'rejected')),
  created_at TEXT NOT NULL,
  reviewed_at TEXT,
  reviewed_by TEXT REFERENCES "user"(id) ON DELETE SET NULL
);
CREATE INDEX IF NOT EXISTS doc_improvement_proposals_project_status_idx
  ON doc_improvement_proposals(project_id, status, created_at DESC);
