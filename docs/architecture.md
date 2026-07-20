# Smolify architecture

## Product boundary

Smolify has five cooperating parts:

1. A repository-local Codex skill analyzes an API and writes human-reviewed
   Markdown plus a versioned `smolify.bundle.json`. Codex already has local
   filesystem access; Smolify never needs it.
2. A remote Smolify MCP server is the agent-facing control plane. Agents connect
   over stateless Streamable HTTP. Public discovery and reads are anonymous;
   OAuth is requested at the HTTP layer only for private or mutating tools.
3. A TypeScript SDK exposes the same operations for CI and other agents.
4. A hosted Next.js application validates bundles, stores immutable source in
   R2, indexes active pages in D1 FTS5, and renders a safe docs site.
5. A bounded repository importer creates an immediate deterministic scaffold
   from a public GitHub URL or an uploaded ZIP. It does not call a model or
   retain the source archive. Public GitHub imports may retain value-free
   declaration and call-relationship metadata with commit-pinned links;
   private GitHub and ZIP imports remain metadata-only.

The hosted service does not execute generated code and does not require a
customer OpenAI API key.

## Cloudflare topology

- One OpenNext Cloudflare Worker serves the dashboard and all public docs.
- D1 stores Better Auth tables, organizations, projects, visibility, domain
  mappings, deployments, searchable page text, ratings, proposal state, and
  publish-token hashes.
- R2 stores immutable bundle versions and generated assets under
  `projects/{projectId}/deployments/{deploymentId}/...`.
- A custom Cloudflare Worker entry can resolve `project.smol.ly` and active
  D1-backed custom hostnames into the tenant route before calling the generated
  OpenNext handler. The current production deployment uses stable
  `app.smol.ly/{project}/...` paths until a proxied wildcard DNS route is added.
  A Cloudflare for SaaS adapter creates customer hostnames, persists
  DNS/certificate validation instructions, and synchronizes activation status.
- Documentation generation happens in Codex. A future Queue/Workflow may run
  indexing or post-publish checks; it is separate from OpenNext ISR queues.

## Repository import boundary

Public GitHub import accepts only a repository-root URL. It reads repository
metadata, up to 30,000 balanced supported text paths, up to 132 balanced
first-party guides, up to 24 ecosystem READMEs, and up to 96 balanced public
source files for symbol extraction. Guide content is capped at 8 MB and public
source analysis at 2 MB, both read in batches of eight. ZIP upload enforces
compressed, expanded, entry-count, per-file, and decoded-byte limits; path
traversal and generated dependency/build directories are ignored.

The deterministic importer emits an introduction, balanced repository map,
optional package-derived development page, source-grounded guide pages, and
chunked file-index pages. For public GitHub repositories it also emits bounded
source-symbol pages containing declaration names, import module names,
call-reference names, source line numbers, and commit-pinned GitHub links. It
does not copy implementations or literal values. Every page is schema-bounded
and unsafe HTML schemes are escaped before storage. It never claims inferred
runtime behavior. README/package/guide content and source metadata may appear
in the generated docs bundle; source archives and arbitrary source contents are
not retained. Private GitHub imports and ZIP uploads never emit symbol pages.

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

The remote MCP publishes OAuth 2.1 protected-resource metadata, but
authentication is optional for `initialize`, tool discovery, and public read
tools. An unauthenticated call to a private or mutating tool receives an HTTP
401 with `resource_metadata`, allowing a compatible client to start OAuth only
when needed. Better Auth's OAuth Provider plugin supplies authorization-code +
PKCE, consent, dynamic public-client registration, refresh tokens, revocation,
and discovery metadata. MCP access tokens are short-lived and scoped
(`docs:read`, `docs:contribute`, `docs:publish`, and `projects:read`). CI may
continue to use a revocable project token, but a human connecting Codex should
not paste a long-lived API key into a chat.

## Agent surface

The MCP surface stays deliberately narrow:

- `search_docs(project, query, limit)` returns ranked summaries and a short
  highlighted passage.
- `build_docs_context(project, task, maxTokens, maxPages)` combines exact
  identifier hits with focused BM25 facets, penalizes structural/file-map
  noise, and packs diverse bounded page and eligible source slices for the
  calling agent to synthesize. It calls no embedding or answer model.
- `get_doc_page(project, slug, offset, length)` returns a bounded Markdown slice
  plus total length and source-file provenance.
- `read_public_source(project, path, startLine, lineCount)` reads at most 200
  explicit lines from the imported GitHub commit. It is disabled for private,
  uploaded, and metadata-only sources.
- `resolve_public_symbols(project, symbols, pathHints?, maxResults)` checks
  exact source-file hints first, then ranks paths from the pinned public GitHub
  tree and scans at most 96 files/4 MB. It returns value-free occurrences and
  commit-pinned links, and reports unresolved identifiers explicitly.
- `inspect_public_symbols(project, symbols, pathHints?, maxResults)` adds exact
  definitions, scoped callers/callees, and short connector paths. It follows
  relative imports before using the same bounded fallback scan and persists no
  fetched source body.
- `read_docs_structure(project)` lists the active pages and provenance without
  dumping their Markdown.
- `publish_docs(project, bundle)` validates and activates an immutable bundle.
- `list_projects()` returns the projects available to the OAuth subject.
- `discover_public_projects(query?)` lists public contribution targets.
- `whoami()` reports the connected identity, OAuth scopes, and the assurance
  level used by the community-review threshold.
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

Trust is intentionally split into separate dimensions. Ten independent
GitHub-linked or verified-email identities produce a **Community reviewed**
documentation status; ordinary accounts remain attributable but do not advance
that threshold. **Official source** is different: it means the GitHub repository
owner's immutable numeric ID appears in Smolify's curated publisher registry.
The launch registry includes Cloudflare, OpenAI, Vercel, and Model Context
Protocol. Neither status claims that the repository or its generated docs are
secure.

An improvement is a complete bundle stored under
`projects/{projectId}/proposals/{proposalId}/bundle.json`. Owners fetch and
preview that bundle, receive its SHA-256 hash, and must return the hash when
accepting. Acceptance is atomically claimed before publication to prevent two
reviewers from publishing the same proposal concurrently. Rejection never
touches the live deployment.

## Search and indexing

The search design combines FTS5/BM25 with the useful no-embedding structural
retrieval pattern from `justrach/codedb`:

1. Every page is normalized into title, description, headings, symbols, body,
   and source-file fields during publish.
2. An external-content FTS5 table uses one Porter + Unicode tokenizer. Triggers
   keep it synchronized with `doc_pages`.
3. BM25 weights favor API symbols, then titles and headings, over prose.
   Identifier aliases split `getUserById`, `get_user_by_id`, paths, and source
   filenames so agents can search with either code or natural words.
4. Search detects code-shaped query tokens and checks exact symbol aliases
   first. If no exact symbol matches, it tries all BM25 terms and only falls
   back to any term on zero hits. Every response reports match mode, confidence,
   whether a fallback occurred, identifier coverage, per-result match reason,
   and machine-readable source files.
5. `build_docs_context` removes prompt boilerplate, searches up to four focused
   task facets, merges exact and lexical candidates, penalizes introduction and
   file-map noise, de-duplicates pages, and gives selected pages fair shares of
   an explicit token-derived character budget.
6. For public code-shaped queries, exact source page paths become resolver
   hints. The resolver checks those paths, follows relative imports for
   requested definitions, and only then uses a bounded ranked scan of the
   pinned GitHub tree. A value-free structural pass masks comments, strings,
   and regular expressions before deriving exact definitions, scoped call
   edges, and connector paths. The graph and complementary implementation
   ranges are admitted by value under one hard serialized context cap. Smolify
   returns evidence; the calling agent performs synthesis.
7. Results are bounded. Agents search first, then fetch a page slice or at most
   200 commit-pinned public source lines; a tool call never dumps the entire
   corpus or repository into context.
8. A deployment is fully indexed before `active_deployment_id` changes. Search
   sees the old complete corpus or the new complete corpus, never a partial one.

D1 is the active query layer: project metadata, ownership, OAuth state,
publisher provenance, searchable pages, FTS5/BM25 indexes, ratings, proposals,
and the pointer to the live deployment. R2 is the immutable artifact layer: it
stores complete versioned deployment and proposal bundles so an owner can
review, roll back, re-index, or publish the exact bytes that were generated.
Repository source archives and private source contents are not retained.
Public source-symbol pages contain metadata and commit-pinned links, not code
implementations or literal values. D1 retains the eligible public commit and
retention mode. Explicit source-line and symbol-resolution reads fetch safe
code paths directly from that immutable public GitHub commit, reject
sensitive/config paths, cap each upstream file at 512 KB, cap resolver scans at
96 files/4 MB, and return bounded ranges; they do not persist fetched bodies.
Current D1 project and
introduction metadata overlays the immutable R2 payload at render time so the
catalog, SEO, and hosted docs stay consistent without rewriting history.
Search eval fixtures should become a release gate for API identifiers, endpoint
paths, error names, and common natural-language tasks.

The retrieval parity suite is such a release gate for code-architecture tasks.
Its deterministic fixtures cover decoy-resistant parsing, definition and edge
recall, connector paths, explicit misses, provenance, authorization, MCP tool
metadata, and monotonic hard-budget packing. An opt-in live test repeats the
Next.js navigation trace against the current public canary commit.

## Custom domains

Wrangler custom domains are deployment configuration, not SaaS onboarding.
The authenticated project-domain API calls Cloudflare for SaaS with a narrowly
scoped server-side token, returns CNAME/TXT instructions, stores the hostname
and certificate lifecycle in D1, and polls status on explicit dashboard action.
Only `active` custom hostnames route to a project. The API never exposes the
Cloudflare token and never edits Wrangler configuration.
