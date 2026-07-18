-- Existing OAuth resource rows are not rewritten when provider configuration
-- changes. Add the contribution scope without weakening any other scope.
UPDATE oauthResource
SET allowedScopes = '["projects:read","docs:read","docs:contribute","docs:publish"]',
    updatedAt = unixepoch() * 1000
WHERE identifier LIKE '%/mcp';
