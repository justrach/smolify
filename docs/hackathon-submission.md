# Docs get stale. AI answers guess. Smolify makes both show their work.

Mintlify showed me how polished developer documentation could feel. DeepWiki
showed me how useful repository-aware answers could be for coding agents.

But I kept coming back to one missing property: **proof**.

If an agent writes the docs, can I review every change before it publishes? If
another agent answers a question, can it retrieve the exact implementation
evidence instead of asking me to trust a black box? Can a community improve
open-source documentation without taking control away from maintainers?

That became **Smolify**: an open-source, local-first documentation platform that
turns a repository into polished docs for people and bounded, commit-pinned
evidence for coding agents.

[Try Smolify](https://app.smol.ly) ·
[Browse the Pawprint demo](https://app.smol.ly/pawprint/introduction) ·
[See the reproducible benchmark](../BENCHMARK.md)

## The 30-second version

```bash
bunx smolify install --agent codex
codex mcp login smolify
```

Open an API repository and ask Codex to document it. Codex reads the real
implementation on your device—routes, schemas, authentication, middleware,
tests, and examples—and generates a portable Markdown bundle with source
provenance.

You review the complete Git diff. Nothing publishes until you approve it.

Once approved, Smolify validates and hosts the bundle. People browse the docs
on the web; coding agents search the same deployment through MCP and retrieve
only the evidence relevant to their task.

One repository. One reviewed artifact. Two interfaces. No silent publishing.

## Proof, not a promise

![Smolify's pinned Next.js retrieval benchmark; exact results follow below.](../public/brand/smolify-nextjs-retrieval-trace.png)

I tested the branch-local retrieval pipeline on a real architecture question
against the July 19, 2026 `vercel/next.js` canary snapshot, pinned at commit
`0491db047b8f9c4a5f9d0285ad9ed514bb134873`.

| Audited check | Result |
| --- | ---: |
| Sampled identifiers captured | **5/5** |
| Query definitions resolved | **3/3** |
| Relationship scan | **3 files · 204,948 tree-accounted bytes** |
| Cross-file connector | **`navigateImpl` reaches all 3 requested symbols** |
| Evidence provenance | **2 commit-pinned excerpts** |
| Embeddings / hosted answer model | **None / none** |

Smolify performed bounded deterministic retrieval; the connected coding agent
did the final synthesis. This is evidence-level performance on one audited
architecture task, not a claim that Smolify universally outperforms DeepWiki,
CodeDB, embeddings, or every other retrieval design.

The recorded public deployment predates these branch-local relationship tools;
a fresh import and deployment are required to reproduce the same trace through
the hosted MCP.

That narrow result is exactly why I like it: every number has a pinned corpus,
a reproducible command, and an explicit limitation.

## What Smolify does

Smolify turns the reviewed bundle into:

- A fast, publicly searchable documentation website
- Structured API reference pages rendered from safe Markdown
- D1 FTS5/BM25 search for people and agents
- Bounded MCP tools for search, page retrieval, source definitions, callers,
  callees, and connector paths
- Commit-pinned source provenance for eligible public imports
- Immutable deployment history and reversible releases
- Project subdomains and custom domains
- Community ratings and complete-bundle improvement proposals
- Separate official-source and community-review trust signals

The important part is that the website and the agent interface do not drift
into separate products. They use the same reviewed deployment.

## Why it is different

### The repository stays local

In the local-first documentation workflow, private source code does not need to
cross a new hosted trust boundary. Codex analyzes it on the developer's machine,
and Smolify receives only the portable docs bundle the developer reviewed.

### Generated docs behave like code

Documentation is versioned, validated, attributable, diffable, and reversible.
The bundle contains Markdown, never executable MDX or arbitrary JSX. Smolify
validates every publish payload and sanitizes rendered HTML.

### Retrieval is bounded and inspectable

Agents search before they read. FTS5/BM25 narrows the documentation, structural
tools resolve exact identifiers and relationships, and source reads have hard
file, byte, and line caps. The calling agent synthesizes from that evidence.

### Agents can contribute without taking over

Authenticated agents can review public docs and propose a complete improved
bundle. A proposal never replaces the live deployment automatically. The owner
previews the exact immutable bundle and chooses whether to publish it.

## How I built it

Smolify is a multi-tenant Next.js and TypeScript application deployed to
Cloudflare through OpenNext.

- **Next.js and React** power the application and documentation renderer.
- **Cloudflare Workers** host the application, API, and MCP endpoint.
- **Cloudflare D1** stores tenant-scoped metadata and FTS5/BM25 search indexes.
- **Cloudflare R2** stores immutable bundles and large documents.
- **Better Auth** handles accounts, organizations, GitHub OAuth, and MCP OAuth
  2.1 authorization.
- **Cloudflare for SaaS** handles customer custom domains.
- **Model Context Protocol** powers retrieval, reviews, proposals, and
  publishing.
- **Codex skills** guide repository analysis and safe bundle generation.
- **Zod** validates every generated bundle at the trust boundary.

Security constraints shaped the architecture: prepared D1 statements,
tenant-scoped queries and storage keys, project-scoped publish credentials
stored only as SHA-256 hashes, sanitized HTML, and no dashboard cookies on
customer custom domains.

## How I used GPT-5.6 and Codex

GPT-5.6 and Codex helped build Smolify and became part of the product itself.

I used Codex to research retrieval systems, MCP, Cloudflare Workers, OpenNext,
Better Auth, and Next.js; design the architecture; implement the platform;
diagnose integration problems; compare retrieval approaches; and build the
reproducible Next.js evidence benchmark.

Inside the product, the Smolify skill teaches Codex to:

1. Inspect the actual repository instead of guessing from a partial schema.
2. Reconcile routes, schemas, authentication, middleware, tests, and examples.
3. Generate safe Markdown plus machine-readable source provenance.
4. Validate the portable bundle.
5. Show the complete diff and stop for human review.
6. Publish only after explicit approval.

The remote MCP lets Codex and other compatible agents search deployed docs,
retrieve bounded context and source evidence, rate pages, propose improvements,
and publish approved bundles.

## The hardest parts

### Finding the right privacy boundary

Uploading every private repository would make onboarding look simpler, but it
would also create an unnecessary source-code trust boundary. The local-first
bundle workflow took more design work and produced a system I would actually
trust with a private API.

### Giving agents enough context without dumping a repository

Large repositories can contain tens of thousands of files. Sending everything
to an agent is slow, expensive, and hard to audit. Smolify combines docs search,
exact identifiers, a bounded pinned-tree resolver, call relationships, and
commit-pinned excerpts so the agent can gather complementary evidence in small
steps.

### Making community contribution safe

Agents are useful collaborators, but a useful suggestion is not the same as
permission to publish. Smolify stores proposed improvements as immutable
pending bundles and requires the owner to inspect the exact candidate before it
becomes live.

## What I am proud of

- A working two-command Codex onboarding flow
- One portable artifact serving the web UI, MCP retrieval, deployment history,
  and community review
- Local-first private-repository analysis
- OAuth-protected writes and anonymous bounded public discovery
- A reproducible benchmark against a real, large Next.js codebase
- Evidence synthesis without an embedding pipeline or separate hosted answer
  model in the audited retrieval path
- A publishing design where the human review gate is part of the protocol, not
  a promise in the UI

## What I learned

Documentation becomes more trustworthy when it behaves like code: versioned,
validated, reviewable, attributable, and reversible.

I also learned that “agentic” does not have to mean “opaque.” An agent can do
the synthesis while the surrounding system keeps retrieval bounded, exposes
provenance, records limitations, and leaves the final publishing decision with
a maintainer.

The best result was not just a nicer documentation site. It was one body of
knowledge that people can read, agents can search, communities can improve, and
maintainers can still control.

## What is next

Next I want to improve incremental updates, expand the reproducible evaluation
suite, import more major open-source repositories, support more coding agents,
and make it easier for official maintainers to claim and curate their projects.

The larger goal is simple: any developer or coding agent should be able to find
a repository, understand how it works, and leave its documentation better for
the next person—without asking everyone to trust an invisible answer pipeline.

**Polished for people. Grounded for agents. Controlled by maintainers.**
