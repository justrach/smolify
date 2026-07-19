ALTER TABLE projects ADD COLUMN source_commit TEXT;
ALTER TABLE projects ADD COLUMN source_retention TEXT NOT NULL DEFAULT 'metadata-only'
  CHECK (source_retention IN ('metadata-only', 'public-symbols'));
