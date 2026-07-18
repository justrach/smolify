-- Better Auth 1.7 records the algorithm and curve alongside each signing
-- key so a resource server can select and verify rotating keys correctly.
ALTER TABLE jwks ADD COLUMN alg TEXT;
ALTER TABLE jwks ADD COLUMN crv TEXT;
