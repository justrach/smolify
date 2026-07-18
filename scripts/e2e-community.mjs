import assert from "node:assert/strict";
import { createHash, randomBytes } from "node:crypto";
import { readFile } from "node:fs/promises";
import { strToU8, zipSync } from "fflate";

const baseURL = (process.env.SMOLIFY_E2E_URL ?? "http://localhost:8787").replace(/\/$/, "");
const suffix = Date.now().toString(36);

function cookies(response) {
  const values = response.headers.getSetCookie?.() ?? [];
  return values.map((value) => value.split(";", 1)[0]).join("; ");
}

async function json(response, label) {
  const payload = await response.json().catch(() => null);
  assert.ok(response.ok, `${label} failed (${response.status}): ${JSON.stringify(payload)}`);
  return payload;
}

async function signup(label) {
  const response = await fetch(`${baseURL}/api/auth/sign-up/email`, {
    method: "POST",
    headers: { "content-type": "application/json", origin: baseURL },
    body: JSON.stringify({
      name: label,
      email: `${label.toLowerCase().replace(/\s+/g, "-")}-${suffix}@example.test`,
      password: "correct-horse-battery-staple",
    }),
  });
  await json(response, `sign up ${label}`);
  const cookie = cookies(response);
  assert.ok(cookie, `${label} sign up did not set a cookie`);
  return cookie;
}

async function importArchive(cookie, name, visibility) {
  const archive = zipSync({
    [`${name}/README.md`]: strToU8(`# ${name}\n\nRepository evidence for ${name}.`),
    [`${name}/package.json`]: strToU8(JSON.stringify({
      name,
      description: `${name} test repository`,
      scripts: { test: "vitest run" },
      dependencies: { zod: "4" },
    })),
    [`${name}/src/routes/users.ts`]: strToU8("export const route = '/users';"),
    [`${name}/tests/users.test.ts`]: strToU8("test('users route', () => {});"),
  });
  const form = new FormData();
  form.set("repository", new File([archive], `${name}.zip`, { type: "application/zip" }));
  form.set("visibility", visibility);
  return json(await fetch(`${baseURL}/api/v1/imports/archive`, {
    method: "POST",
    headers: { cookie, origin: baseURL },
    body: form,
  }), `import ${visibility} archive`);
}

async function oauthToken(cookie, label) {
  const redirectUri = "http://127.0.0.1/callback";
  const requestedScopes = "openid profile offline_access projects:read docs:read docs:contribute docs:publish";
  const registration = await json(await fetch(`${baseURL}/api/auth/oauth2/register`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      client_name: label,
      redirect_uris: [redirectUri],
      token_endpoint_auth_method: "none",
      grant_types: ["authorization_code", "refresh_token"],
      response_types: ["code"],
      scope: requestedScopes,
    }),
  }), "dynamic client registration");
  assert.match(registration.scope ?? "", /docs:contribute/, `registered scopes: ${JSON.stringify(registration)}`);
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
  const authorizeResponse = await fetch(authorize, { headers: { cookie, accept: "text/html" }, redirect: "manual" });
  const authorizePayload = authorizeResponse.status === 200 ? await authorizeResponse.json() : null;
  const consentLocation = authorizeResponse.headers.get("location") ?? authorizePayload?.url;
  assert.ok(consentLocation, "OAuth authorization did not reach consent");
  const consentURL = new URL(consentLocation, baseURL);
  const consent = await json(await fetch(`${baseURL}/api/auth/oauth2/consent`, {
    method: "POST",
    headers: { "content-type": "application/json", cookie, origin: baseURL },
    body: JSON.stringify({ accept: true, oauth_query: consentURL.search.slice(1) }),
  }), "OAuth consent");
  const code = new URL(consent.url ?? consent.redirect_uri).searchParams.get("code");
  assert.ok(code, "OAuth consent did not return a code");
  const token = await json(await fetch(`${baseURL}/api/auth/oauth2/token`, {
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
  }), "OAuth token exchange");
  const claims = JSON.parse(Buffer.from(token.access_token.split(".")[1], "base64url").toString("utf8"));
  assert.match(String(claims.scope ?? claims.scopes ?? ""), /docs:contribute/, `token claims: ${JSON.stringify(claims)}`);
  return token;
}

function mcpClient(accessToken) {
  let id = 0;
  return async (method, params) => json(await fetch(`${baseURL}/mcp`, {
    method: "POST",
    headers: {
      authorization: `Bearer ${accessToken}`,
      "content-type": "application/json",
      accept: "application/json, text/event-stream",
      "mcp-protocol-version": "2025-06-18",
    },
    body: JSON.stringify({ jsonrpc: "2.0", id: ++id, method, params }),
  }), `MCP ${method}`);
}

const ownerCookie = await signup("Community Owner");
const reviewerCookie = await signup("Community Reviewer");
const publicImport = await importArchive(ownerCookie, `public-api-${suffix}`, "public");
const privateImport = await importArchive(ownerCookie, `private-api-${suffix}`, "private");
const publicProject = publicImport.project.slug;
const privateProject = privateImport.project.slug;

const publicExplore = await fetch(`${baseURL}/explore/${publicProject}`);
assert.equal(publicExplore.status, 200, "public project profile should be anonymous");
assert.match(await publicExplore.text(), new RegExp(publicProject));
const publicDocs = await fetch(`${baseURL}/${publicProject}/introduction`);
assert.equal(publicDocs.status, 200, "public docs should be anonymous");
assert.match(await publicDocs.text(), /Repository evidence/);
const publicSearch = await fetch(`${baseURL}/api/v1/projects/${publicProject}/search?q=users`);
assert.equal(publicSearch.status, 200, "public search should be anonymous");

const privateDocs = await fetch(`${baseURL}/${privateProject}/introduction`, { redirect: "manual" });
assert.ok([302, 303, 307, 308].includes(privateDocs.status), `private docs returned ${privateDocs.status}`);
assert.match(privateDocs.headers.get("location") ?? "", /\/login\?returnTo=/);
const privateSearch = await fetch(`${baseURL}/api/v1/projects/${privateProject}/search?q=users`);
assert.equal(privateSearch.status, 404, "private search leaked anonymously");
const ownerPrivateDocs = await fetch(`${baseURL}/${privateProject}/introduction`, { headers: { cookie: ownerCookie } });
assert.equal(ownerPrivateDocs.status, 200, "owner could not read private docs");

const reviewerToken = await oauthToken(reviewerCookie, "Smolify Community Reviewer E2E");
const rpc = mcpClient(reviewerToken.access_token);
const initialized = await rpc("initialize", { protocolVersion: "2025-06-18", capabilities: {}, clientInfo: { name: "community-e2e", version: "1.0.0" } });
assert.equal(initialized.result.serverInfo.name, "smolify");
const tools = await rpc("tools/list", {});
assert.deepEqual(tools.result.tools.map((tool) => tool.name).sort(), [
  "discover_public_projects",
  "get_doc_page",
  "list_projects",
  "propose_doc_improvement",
  "publish_docs",
  "rate_docs",
  "search_docs",
]);
const discovered = await rpc("tools/call", { name: "discover_public_projects", arguments: { query: suffix } });
const discoveredSlugs = discovered.result.structuredContent.projects.map((project) => project.slug);
assert.ok(discoveredSlugs.includes(publicProject), "public project was not discoverable");
assert.ok(!discoveredSlugs.includes(privateProject), "private project leaked through discovery");

const invalidRating = await rpc("tools/call", {
  name: "rate_docs",
  arguments: { project: publicProject, score: 5, model: "gpt-5.4" },
});
assert.equal(invalidRating.result.isError, true, "non-GPT-5.6 rating was accepted");
const rating = await rpc("tools/call", {
  name: "rate_docs",
  arguments: { project: publicProject, score: 5, notes: "Source-grounded start.", model: "gpt-5.6-sol" },
});
assert.ok(rating.result.structuredContent, `rating failed: ${JSON.stringify(rating)}`);
assert.equal(rating.result.structuredContent.aggregate.count, 1);

const improvedBundle = JSON.parse(await readFile(new URL("../examples/pawprint/smolify.bundle.json", import.meta.url)));
improvedBundle.project.name = `Improved ${publicProject}`;
improvedBundle.project.description = "Owner-reviewed community improvement.";
improvedBundle.generatedAt = new Date().toISOString();
improvedBundle.generator.model = "gpt-5.6-sol";
improvedBundle.pages[0].markdown += "\n\n## Community verified\n\nThis improvement passed the owner review gate.";
const proposal = await rpc("tools/call", {
  name: "propose_doc_improvement",
  arguments: {
    project: publicProject,
    model: "gpt-5.6-sol",
    summary: "Add an owner-verifiable community review section",
    rationale: "The imported page explains the repository but does not record that an outside agent verified the flow against the public source.",
    bundle: improvedBundle,
  },
});
assert.equal(proposal.result.structuredContent.publicationChanged, false);
const beforeApproval = await fetch(`${baseURL}/${publicProject}/introduction`);
assert.doesNotMatch(await beforeApproval.text(), /Community verified/);

const proposalId = proposal.result.structuredContent.proposalId;
const ownerInbox = await fetch(`${baseURL}/dashboard?project=${publicProject}`, { headers: { cookie: ownerCookie } });
assert.equal(ownerInbox.status, 200, "owner proposal inbox did not render");
const ownerInboxHtml = await ownerInbox.text();
assert.match(ownerInboxHtml, /Add an owner-verifiable community review section/);
assert.match(ownerInboxHtml, /Preview complete bundle/);
const blindAccept = await fetch(`${baseURL}/api/v1/projects/${publicProject}/proposals/${proposalId}`, {
  method: "PATCH",
  headers: { "content-type": "application/json", cookie: ownerCookie },
  body: JSON.stringify({ decision: "accept" }),
});
assert.equal(blindAccept.status, 409, "proposal could be accepted without previewing its bundle hash");
const preview = await json(await fetch(`${baseURL}/api/v1/projects/${publicProject}/proposals/${proposalId}`, {
  headers: { cookie: ownerCookie },
}), "preview proposal");
assert.equal(preview.bundle.pages.length, improvedBundle.pages.length);
const accepted = await json(await fetch(`${baseURL}/api/v1/projects/${publicProject}/proposals/${proposalId}`, {
  method: "PATCH",
  headers: { "content-type": "application/json", cookie: ownerCookie },
  body: JSON.stringify({ decision: "accept", bundleHash: preview.bundleHash }),
}), "accept proposal");
assert.equal(accepted.status, "accepted");
assert.ok(accepted.deployment.deploymentId);
const afterApproval = await fetch(`${baseURL}/${publicProject}/introduction`);
assert.match(await afterApproval.text(), /Community verified/);

console.log(JSON.stringify({
  ok: true,
  publicProject,
  privateProject,
  ratingCount: rating.result.structuredContent.aggregate.count,
  proposalId,
  acceptedDeploymentId: accepted.deployment.deploymentId,
  tools: tools.result.tools.map((tool) => tool.name),
}));
