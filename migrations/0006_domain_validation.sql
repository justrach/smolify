-- Persist Cloudflare for SaaS validation instructions and the latest status
-- check so onboarding survives dashboard reloads.
ALTER TABLE domains ADD COLUMN validation_records TEXT;
ALTER TABLE domains ADD COLUMN last_checked_at TEXT;
