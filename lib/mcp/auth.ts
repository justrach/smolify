import { createLocalJWKSet, jwtVerify, type JWTPayload } from "jose";

export type McpPrincipal = {
  userId: string;
  clientId?: string;
  scopes: Set<string>;
  token: JWTPayload;
};

function claimScopes(payload: JWTPayload): Set<string> {
  const value = payload.scope ?? payload.scopes;
  if (Array.isArray(value)) return new Set(value.filter((item): item is string => typeof item === "string"));
  if (typeof value === "string") return new Set(value.split(/\s+/).filter(Boolean));
  return new Set();
}

export async function verifyMcpAccessToken(
  env: CloudflareEnv,
  token: string,
  origin: string,
): Promise<McpPrincipal> {
  const keys = await env.DB.prepare(
    `SELECT id, publicKey FROM jwks
     WHERE expiresAt IS NULL OR expiresAt > ?`,
  )
    .bind(Date.now())
    .all<{ id: string; publicKey: string }>();
  const jwks = {
    keys: keys.results.map((row) => ({
      ...JSON.parse(row.publicKey),
      kid: row.id,
    })),
  };
  const verified = await jwtVerify(token, createLocalJWKSet(jwks), {
    issuer: origin,
    audience: `${origin}/mcp`,
  });
  const expectedAudience = `${origin}/mcp`;
  const audiences = Array.isArray(verified.payload.aud)
    ? verified.payload.aud
    : verified.payload.aud
      ? [verified.payload.aud]
      : [];
  // OpenID access tokens also target the provider's userinfo endpoint. The
  // MCP resource must be an audience, but it does not need to be the only one.
  if (!audiences.includes(expectedAudience)) {
    throw new Error("OAuth token is not bound to the Smolify MCP resource");
  }
  if (!verified.payload.sub) throw new Error("OAuth access token has no subject");
  return {
    userId: verified.payload.sub,
    clientId: typeof verified.payload.azp === "string" ? verified.payload.azp : undefined,
    scopes: claimScopes(verified.payload),
    token: verified.payload,
  };
}

export function unauthorizedMcpResponse(origin: string) {
  const metadata = `${origin}/.well-known/oauth-protected-resource/mcp`;
  return Response.json(
    {
      jsonrpc: "2.0",
      error: { code: -32001, message: "OAuth authentication required" },
      id: null,
    },
    {
      status: 401,
      headers: { "WWW-Authenticate": `Bearer resource_metadata="${metadata}"` },
    },
  );
}
