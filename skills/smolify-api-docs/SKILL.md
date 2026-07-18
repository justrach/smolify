---
name: smolify-api-docs
description: Analyze an API repository with Codex, create or update safe Markdown documentation, validate a Smolify bundle, and publish it only after the user reviews the generated diff. Use when the user asks to document, refresh, audit, or publish an API with Smolify.
---

# Smolify API Docs

Turn an API implementation into accurate, reviewable documentation. The source
of truth is the repository, not model memory. Write Markdown only; never emit
runtime MDX, JSX, scripts, or unsanitized HTML.

## Preconditions

1. Confirm the current task uses GPT-5.6. If it does not, stop and ask the user
   to switch models before generation.
2. Read the repository's `AGENTS.md` and follow the closest applicable guidance.
3. Locate API evidence in this order:
   - OpenAPI/Swagger, GraphQL, protobuf, or RPC contracts
   - route/controller definitions
   - request and response schemas
   - authentication and authorization middleware
   - tests and fixtures
   - existing documentation and examples
4. Do not make network calls to the production API unless the user explicitly
   authorizes them and provides a safe test target.

## Workflow

### 1. Inventory

Create a compact route inventory containing method, path, authentication,
request schema, success response, error responses, and supporting source files.
Flag conflicts between contracts, code, and tests instead of guessing.

### 2. Plan

Propose a navigation tree. Prefer task-oriented guides plus a reference page per
endpoint group. Ask for clarification only when a product decision materially
changes the output; otherwise record the uncertainty in the generated page.

### 3. Generate

Write `.smolify/smolify.bundle.json` matching `references/bundle.schema.json`.

- Every page must contain useful prose, not placeholder sections.
- Include runnable examples only when values are supported by code or fixtures.
- Record supporting paths in `sourceFiles`.
- Never include secrets copied from environment files, fixtures, logs, or code.
- Use `generator.name = "codex"` and the exact active model identifier.
- Use ISO 8601 UTC for `generatedAt`.

### 4. Validate

Run:

```bash
node <skill-directory>/scripts/validate.mjs .smolify/smolify.bundle.json
```

Fix every validation failure. Then review the generated git diff for leaked
secrets, invented behavior, broken examples, duplicated slugs, and navigation
entries without pages.

### 5. Publish

Publishing changes external state. Do it only when the user explicitly asks to
publish after reviewing the diff.

Prefer the authenticated Smolify MCP tool `publish_docs` when it is available.
The MCP client completes OAuth authorization-code + PKCE in the browser; never
ask the user to paste its access or refresh token into chat. Pass the validated
bundle and project slug to the tool, then report its deployment ID and URL.

For headless CI or installations without the MCP, use the project-token
fallback below.

Require these environment variables:

- `SMOLIFY_PUBLISH_TOKEN` — project-scoped token from the Smolify dashboard
- `SMOLIFY_ENDPOINT` — optional; defaults to `https://smol.ly`
- `SMOLIFY_PROJECT` — the project slug

Then run:

```bash
node <skill-directory>/scripts/publish.mjs .smolify/smolify.bundle.json
```

Never print the publish token. Report the deployment ID and public URL returned
by the service.

## Updating existing docs

When `.smolify/smolify.bundle.json` already exists, preserve unaffected prose
and navigation. Use the git diff to determine which API surfaces changed, then
update only impacted pages unless a broader rewrite is necessary for accuracy.
