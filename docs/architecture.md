# Smolify architecture

## Product boundary

Smolify has five cooperating parts:

1. A repository-local Codex skill analyzes an API and writes human-reviewed
   Markdown plus a versioned `smolify.bundle.json`. Codex already has local
   filesystem access; Smolify never needs it.
2. A remote Smolify MCP server is the agent-facing control plane. Codex connects
   over Streamable HTTP with OAuth, then publishes and searches through a small
   set of bounded tools.
3. A TypeScript SDK exposes the same operations for CI and other agents.
4. A hosted Next.js application validates bundles, stores immutable source in
   R2, indexes active pages in D1 FTS5, and renders a safe docs site.
5. A bounded repository importer creates an immediate deterministic scaffold
   from a public GitHub URL or an uploaded ZIP. It does not call a model or
   retain the source archive.

The hosted service does not execute generated code and does not require a
customer OpenAI API key.

## Cloudflare topology

- One OpenNext Cloudflare Worker serves the dashboard and all public docs.
- D1 stores Better Auth tables, organizations, projects, visibility, domain
  mappings, deployments, searchable page text, ratings, proposal state, and
  publish-token hashes.
- R2 stores immutable bundle versions and generated assets under
  `projects/{projectId}/deployments/{deploymentId}/...`.
- A custom Cloudflare Worker entry resolves `project.smol.ly` and active
  D1-backed custom hostnames into the tenant route before calling the generated
  OpenNext handler. A Cloudflare for SaaS adapter creates hostnames, persists
  DNS/certificate validation instructions, and synchronizes activation status.
- Documentation generation happens in Codex. A future Queue/Workflow may run
  indexing or post-publish checks; it is separate from OpenNext ISR queues.

## Repository import boundary

Public GitHub import accepts only a repository-root URL. It reads repository
metadata, a bounded file tree, and a small allowlist of useful text files. ZIP
upload enforces compressed, expanded, entry-count, per-file, and decoded-byte
limits; path traversal and generated dependency/build directories are ignored.

The deterministic importer emits an introduction, repository map, and optional
package-derived development page. It never claims inferred runtime behavior.
README/package content and source paths may appear in the generated docs bundle;
the source archive and arbitrary source contents are not retained.

## Rendering boundary

Runtime content is Markdown, not MDX. The renderer uses a unified syntax tree,
GitHub-flavored Markdown, stable heading slugs, a strict sanitization schema,
and HTML serialization. Navigation and search text are derived from the same
tree so rendered content and indexes cannot drift.

## Auth boundary

Better Auth handles dashboard sessions at the application origin. Public docs
and custom domains are anonymous. Private projects require organization
membership across rendered pages, search/page APIs, and MCP reads. A private
subdomain redirects to the app origin so host-only cookies are never widened.
Auth cookies remain host-only; cross-subdomain cookies are intentionally
disabled so customer domains and
public documentation hosts never receive dashboard credentials.

The remote MCP is an OAuth 2.1 protected resource. Better Auth's OAuth Provider
plugin supplies authorization-code + PKCE, consent, dynamic public-client
registration, refresh tokens, revocation, and discovery metadata. MCP access
tokens are short-lived and scoped (`docs:read`, `docs:contribute`,
`docs:publish`, and `projects:read`). CI may continue to use a revocable project
token, but a human connecting Codex should not paste a long-lived API key into
a chat.

## Agent surface

The MCP surface stays deliberately narrow:

- `search_docs(project, query, limit)` returns ranked summaries and a short
  highlighted passage.
- `get_doc_page(project, slug, offset, length)` returns a bounded Markdown slice
  plus total length and source-file provenance.
- `publish_docs(project, bundle)` validates and activates an immutable bundle.
- `list_projects()` returns the projects available to the OAuth subject.
- `discover_public_projects(query?)` lists public contribution targets.
- `rate_docs(project, score, notes, model)` upserts one authenticated GPT-5.6
  rating per user and project.
- `propose_doc_improvement(...)` validates and stores an immutable replacement
  bundle for review without changing `active_deployment_id`.

The local skill owns repo inspection and authoring. MCP owns authorization,
hosted corpus operations, and publication. The SDK is a transport-neutral
client for those application services; MCP handlers should use shared services
instead of duplicating business logic.

## Contribution review boundary

Model provenance is agent-reported and recorded; Smolify cannot cryptographically
attest which remote model ran. The contribution API currently accepts model
identifiers in the GPT-5.6 family. Ratings are attributable to the OAuth user.

An improvement is a complete bundle stored under
`projects/{projectId}/proposals/{proposalId}/bundle.json`. Owners fetch and
preview that bundle, receive its SHA-256 hash, and must return the hash when
accepting. Acceptance is atomically claimed before publication to prevent two
reviewers from publishing the same proposal concurrently. Rejection never
touches the live deployment.

## Search and indexing

The search design follows the useful parts of `justrach/sglaw`:

1. Every page is normalized into title, description, headings, symbols, body,
   and source-file fields during publish.
2. An external-content FTS5 table uses one Porter + Unicode tokenizer. Triggers
   keep it synchronized with `doc_pages`.
3. BM25 weights favor API symbols, then titles and headings, over prose.
   Identifier aliases split `getUserById`, `get_user_by_id`, paths, and source
   filenames so agents can search with either code or natural words.
4. Search tries all terms first and only falls back to any term on zero hits.
   The response explicitly identifies the match mode.
5. Results are bounded. Agents search first, then fetch a page slice; a tool
   call never dumps the entire corpus into context.
6. A deployment is fully indexed before `active_deployment_id` changes. Search
   sees the old complete corpus or the new complete corpus, never a partial one.

D1 is the derived, query-optimized index. R2 remains the immutable source bundle
that can be re-indexed when ranking changes. Search eval fixtures should become
a release gate for API identifiers, endpoint paths, error names, and common
natural-language tasks.

## Custom domains

Wrangler custom domains are deployment configuration, not SaaS onboarding.
The authenticated project-domain API calls Cloudflare for SaaS with a narrowly
scoped server-side token, returns CNAME/TXT instructions, stores the hostname
and certificate lifecycle in D1, and polls status on explicit dashboard action.
Only `active` custom hostnames route to a project. The API never exposes the
Cloudflare token and never edits Wrangler configuration.
