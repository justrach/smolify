-- OAuth Provider 1.7 resource binding. This release binds authorization codes
-- and refresh tokens to the resource requested during consent (RFC 8707).
ALTER TABLE oauthClient ADD COLUMN backchannelLogoutUri TEXT;
ALTER TABLE oauthClient ADD COLUMN backchannelLogoutSessionRequired INTEGER;
ALTER TABLE oauthClient ADD COLUMN jwks TEXT;
ALTER TABLE oauthClient ADD COLUMN jwksUri TEXT;
ALTER TABLE oauthClient ADD COLUMN dpopBoundAccessTokens INTEGER DEFAULT 0;

CREATE TABLE IF NOT EXISTS oauthResource (
  id TEXT PRIMARY KEY NOT NULL,
  identifier TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  accessTokenTtl INTEGER,
  refreshTokenTtl INTEGER,
  signingAlgorithm TEXT,
  signingKeyId TEXT,
  allowedScopes TEXT,
  customClaims TEXT,
  dpopBoundAccessTokensRequired INTEGER DEFAULT 0,
  disabled INTEGER DEFAULT 0,
  createdAt INTEGER,
  updatedAt INTEGER,
  policyVersion INTEGER DEFAULT 1,
  metadata TEXT
);

CREATE TABLE IF NOT EXISTS oauthClientResource (
  id TEXT PRIMARY KEY NOT NULL,
  clientId TEXT NOT NULL REFERENCES oauthClient(clientId) ON DELETE CASCADE,
  resourceId TEXT NOT NULL REFERENCES oauthResource(identifier) ON DELETE CASCADE,
  metadata TEXT,
  createdAt INTEGER
);
CREATE INDEX IF NOT EXISTS oauthClientResource_clientId_idx ON oauthClientResource(clientId);
CREATE INDEX IF NOT EXISTS oauthClientResource_resourceId_idx ON oauthClientResource(resourceId);

ALTER TABLE oauthRefreshToken ADD COLUMN authorizationCodeId TEXT;
ALTER TABLE oauthRefreshToken ADD COLUMN resources TEXT;
ALTER TABLE oauthRefreshToken ADD COLUMN requestedUserInfoClaims TEXT;
ALTER TABLE oauthRefreshToken ADD COLUMN rotatedAt INTEGER;
ALTER TABLE oauthRefreshToken ADD COLUMN rotationReplayResponse TEXT;
ALTER TABLE oauthRefreshToken ADD COLUMN rotationReplayExpiresAt INTEGER;
ALTER TABLE oauthRefreshToken ADD COLUMN confirmation TEXT;
CREATE INDEX IF NOT EXISTS oauthRefreshToken_authorizationCodeId_idx
  ON oauthRefreshToken(authorizationCodeId);

ALTER TABLE oauthAccessToken ADD COLUMN authorizationCodeId TEXT;
ALTER TABLE oauthAccessToken ADD COLUMN resources TEXT;
ALTER TABLE oauthAccessToken ADD COLUMN requestedUserInfoClaims TEXT;
ALTER TABLE oauthAccessToken ADD COLUMN revoked INTEGER;
ALTER TABLE oauthAccessToken ADD COLUMN confirmation TEXT;
CREATE INDEX IF NOT EXISTS oauthAccessToken_authorizationCodeId_idx
  ON oauthAccessToken(authorizationCodeId);

ALTER TABLE oauthConsent ADD COLUMN resources TEXT;
ALTER TABLE oauthConsent ADD COLUMN requestedUserInfoClaims TEXT;

CREATE TABLE IF NOT EXISTS oauthClientAssertion (
  id TEXT PRIMARY KEY NOT NULL,
  expiresAt INTEGER NOT NULL
);
