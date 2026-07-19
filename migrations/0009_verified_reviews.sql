ALTER TABLE doc_ratings ADD COLUMN identity_assurance TEXT NOT NULL DEFAULT 'account'
  CHECK (identity_assurance IN ('account', 'verified_email', 'github'));

CREATE INDEX IF NOT EXISTS doc_ratings_project_assurance_idx
  ON doc_ratings(project_id, identity_assurance, updated_at DESC);
