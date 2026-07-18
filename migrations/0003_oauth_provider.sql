-- Better Auth JWT + OAuth 2.1 Provider tables. Field names intentionally
-- follow Better Auth's default camelCase schema because the D1 adapter maps
-- them directly.
CREATE TABLE IF NOT EXISTS jwks (
  id TEXT PRIMARY KEY NOT NULL,
  publicKey TEXT NOT NULL,
  privateKey TEXT NOT NULL,
  createdAt INTEGER NOT NULL,
  expiresAt INTEGER
);

CREATE TABLE IF NOT EXISTS oauthClient (
  id TEXT PRIMARY KEY NOT NULL,
  clientId TEXT NOT NULL UNIQUE,
  clientSecret TEXT,
  disabled INTEGER DEFAULT 0,
  skipConsent INTEGER,
  enableEndSession INTEGER,
  subjectType TEXT,
  scopes TEXT,
  userId TEXT REFERENCES "user"(id) ON DELETE CASCADE,
  createdAt INTEGER,
  updatedAt INTEGER,
  name TEXT,
  uri TEXT,
  icon TEXT,
  contacts TEXT,
  tos TEXT,
  policy TEXT,
  softwareId TEXT,
  softwareVersion TEXT,
  softwareStatement TEXT,
  redirectUris TEXT NOT NULL,
  postLogoutRedirectUris TEXT,
  tokenEndpointAuthMethod TEXT,
  grantTypes TEXT,
  responseTypes TEXT,
  public INTEGER,
  type TEXT,
  requirePKCE INTEGER,
  referenceId TEXT,
  metadata TEXT
);
CREATE INDEX IF NOT EXISTS oauthClient_userId_idx ON oauthClient(userId);

CREATE TABLE IF NOT EXISTS oauthRefreshToken (
  id TEXT PRIMARY KEY NOT NULL,
  token TEXT NOT NULL UNIQUE,
  clientId TEXT NOT NULL REFERENCES oauthClient(clientId) ON DELETE CASCADE,
  sessionId TEXT REFERENCES session(id) ON DELETE SET NULL,
  userId TEXT NOT NULL REFERENCES "user"(id) ON DELETE CASCADE,
  referenceId TEXT,
  expiresAt INTEGER NOT NULL,
  createdAt INTEGER NOT NULL,
  revoked INTEGER,
  authTime INTEGER,
  scopes TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS oauthRefreshToken_clientId_idx ON oauthRefreshToken(clientId);
CREATE INDEX IF NOT EXISTS oauthRefreshToken_sessionId_idx ON oauthRefreshToken(sessionId);
CREATE INDEX IF NOT EXISTS oauthRefreshToken_userId_idx ON oauthRefreshToken(userId);

CREATE TABLE IF NOT EXISTS oauthAccessToken (
  id TEXT PRIMARY KEY NOT NULL,
  token TEXT NOT NULL UNIQUE,
  clientId TEXT NOT NULL REFERENCES oauthClient(clientId) ON DELETE CASCADE,
  sessionId TEXT REFERENCES session(id) ON DELETE SET NULL,
  userId TEXT REFERENCES "user"(id) ON DELETE CASCADE,
  referenceId TEXT,
  refreshId TEXT REFERENCES oauthRefreshToken(id) ON DELETE CASCADE,
  expiresAt INTEGER NOT NULL,
  createdAt INTEGER NOT NULL,
  scopes TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS oauthAccessToken_clientId_idx ON oauthAccessToken(clientId);
CREATE INDEX IF NOT EXISTS oauthAccessToken_sessionId_idx ON oauthAccessToken(sessionId);
CREATE INDEX IF NOT EXISTS oauthAccessToken_userId_idx ON oauthAccessToken(userId);
CREATE INDEX IF NOT EXISTS oauthAccessToken_refreshId_idx ON oauthAccessToken(refreshId);

CREATE TABLE IF NOT EXISTS oauthConsent (
  id TEXT PRIMARY KEY NOT NULL,
  clientId TEXT NOT NULL REFERENCES oauthClient(clientId) ON DELETE CASCADE,
  userId TEXT REFERENCES "user"(id) ON DELETE CASCADE,
  referenceId TEXT,
  scopes TEXT NOT NULL,
  createdAt INTEGER NOT NULL,
  updatedAt INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS oauthConsent_clientId_idx ON oauthConsent(clientId);
CREATE INDEX IF NOT EXISTS oauthConsent_userId_idx ON oauthConsent(userId);
