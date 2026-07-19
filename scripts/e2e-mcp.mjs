import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { createHash, randomBytes } from "node:crypto";

const baseURL = (process.env.SMOLIFY_E2E_URL ?? "http://localhost:8787").replace(/\/$/, "");
const suffix = Date.now().toString(36);
const email = `mcp-e2e-${suffix}@example.test`;
const project = `mcp-e2e-${suffix}`;

function cookies(response) {
  const values = response.headers.getSetCookie?.() ?? [];
  return values.map((value) => value.split(";", 1)[0]).join("; ");
}

async function json(response, label) {
  const payload = await response.json().catch(() => null);
  assert.ok(response.ok, `${label} failed (${response.status}): ${JSON.stringify(payload)}`);
  return payload;
}

const signupResponse = await fetch(`${baseURL}/api/auth/sign-up/email`, {
  method: "POST",
  headers: { "content-type": "application/json", origin: baseURL },
  body: JSON.stringify({ name: "MCP E2E", email, password: "correct-horse-battery-staple" }),
});
await json(signupResponse, "sign up");
const cookie = cookies(signupResponse);
assert.ok(cookie, "sign up did not set a session cookie");

await json(
  await fetch(`${baseURL}/api/v1/projects`, {
    method: "POST",
    headers: { "content-type": "application/json", cookie },
    body: JSON.stringify({ name: "MCP E2E API", slug: project }),
  }),
  "create project",
);

const redirectUri = "http://127.0.0.1/callback";
const requestedScopes = "openid profile offline_access projects:read docs:read docs:contribute docs:publish";
const registration = await json(
  await fetch(`${baseURL}/api/auth/oauth2/register`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      client_name: "Smolify MCP E2E",
      redirect_uris: [redirectUri],
      token_endpoint_auth_method: "none",
      grant_types: ["authorization_code", "refresh_token"],
      response_types: ["code"],
      scope: requestedScopes,
    }),
  }),
  "dynamic client registration",
);
assert.ok(registration.client_id, "registration did not return client_id");

const verifier = randomBytes(48).toString("base64url");
const challenge = createHash("sha256").update(verifier).digest("base64url");
const authorize = new URL(`${baseURL}/api/auth/oauth2/authorize`);
authorize.search = new URLSearchParams({
  response_type: "code",
  client_id: registration.client_id,
  redirect_uri: redirectUri,
  scope: requestedScopes,
  state: randomBytes(16).toString("hex"),
  code_challenge: challenge,
  code_challenge_method: "S256",
  resource: `${baseURL}/mcp`,
}).toString();

const authorizeResponse = await fetch(authorize, {
  headers: { cookie, accept: "text/html" },
  redirect: "manual",
});
const authorizePayload = authorizeResponse.status === 200
  ? await authorizeResponse.json()
  : null;
assert.ok(
  authorizeResponse.status === 200 || authorizeResponse.status === 302,
  `authorize returned ${authorizeResponse.status}`,
);
const consentLocation = authorizeResponse.headers.get("location") ?? authorizePayload?.url;
assert.ok(consentLocation, "authorize did not redirect to consent");
const consentURL = new URL(consentLocation, baseURL);
assert.equal(consentURL.pathname, "/consent");

const consent = await json(
  await fetch(`${baseURL}/api/auth/oauth2/consent`, {
    method: "POST",
    headers: { "content-type": "application/json", cookie, origin: baseURL },
    body: JSON.stringify({ accept: true, oauth_query: consentURL.search.slice(1) }),
  }),
  "consent",
);
const callback = new URL(consent.url ?? consent.redirect_uri);
const code = callback.searchParams.get("code");
assert.ok(code, "consent callback did not include an authorization code");

const token = await json(
  await fetch(`${baseURL}/api/auth/oauth2/token`, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "authorization_code",
      client_id: registration.client_id,
      redirect_uri: redirectUri,
      code,
      code_verifier: verifier,
      resource: `${baseURL}/mcp`,
    }),
  }),
  "token exchange",
);
assert.ok(token.access_token, "token exchange did not return an access token");
assert.ok(token.refresh_token, "offline_access did not return a refresh token");
const accessTokenClaims = JSON.parse(
  Buffer.from(token.access_token.split(".")[1], "base64url").toString("utf8"),
);

let rpcId = 0;
async function rpc(method, params) {
  const response = await fetch(`${baseURL}/mcp`, {
    method: "POST",
    headers: {
      authorization: `Bearer ${token.access_token}`,
      "content-type": "application/json",
      accept: "application/json, text/event-stream",
      "mcp-protocol-version": "2025-06-18",
    },
    body: JSON.stringify({ jsonrpc: "2.0", id: ++rpcId, method, params }),
  });
  return json(response, `MCP ${method}; claims=${JSON.stringify(accessTokenClaims)}`);
}

const initialized = await rpc("initialize", {
  protocolVersion: "2025-06-18",
  capabilities: {},
  clientInfo: { name: "smolify-e2e", version: "1.0.0" },
});
assert.equal(initialized.result.serverInfo.name, "smolify");

const tools = await rpc("tools/list", {});
assert.deepEqual(
  tools.result.tools.map((tool) => tool.name).sort(),
  ["discover_public_projects", "get_doc_page", "list_projects", "propose_doc_improvement", "publish_docs", "rate_docs", "read_docs_structure", "search_docs", "whoami"],
);

const bundle = JSON.parse(await readFile(new URL("../examples/pawprint/smolify.bundle.json", import.meta.url)));
const published = await rpc("tools/call", {
  name: "publish_docs",
  arguments: { project, bundle },
});
assert.ok(published.result.structuredContent.deploymentId);

const searched = await rpc("tools/call", {
  name: "search_docs",
  arguments: { project, query: "Pawprint API contract", limit: 5 },
});
assert.equal(searched.result.structuredContent.results[0].slug, "introduction");

const page = await rpc("tools/call", {
  name: "get_doc_page",
  arguments: { project, slug: "introduction", length: 12000 },
});
assert.match(page.result.structuredContent.markdown, /Build something pawsome/);

console.log(JSON.stringify({
  ok: true,
  project,
  tools: tools.result.tools.map((tool) => tool.name),
  deploymentId: published.result.structuredContent.deploymentId,
}));
