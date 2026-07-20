# Retrieval-to-synthesis benchmark

This benchmark demonstrates a deliberate Smolify design choice: the hosted
service does not need an embedding model or a hosted answer model to give a
coding agent enough evidence for a detailed, multi-page explanation.

Smolify retrieves deterministic, bounded passages with D1 FTS5/BM25. The
connected agent reads the relevant Markdown pages and performs the synthesis in
the user's existing coding session.

## Challenge

Run this prompt against the public `next-js` project:

```text
Using only the public Smolify MCP, explain how Next.js 16.3 Instant Navigation
and Partial Prefetching work. Compare Stream, Cache, and Block; list the config
flags and migration gotchas; and cite the relevant repository source paths.

Show the search hits and pages you used before giving the answer.
```

The last sentence matters for the demo. It makes retrieval visible instead of
presenting a polished answer with no inspectable evidence trail.

## Reproducible MCP trace

Use the public read sequence required by the Smolify skill:

1. Discover the exact `next-js` project.
2. Search before reading a page.
3. Read only the pages needed for the answer.

The matched search call is:

```text
search_docs(
  project: "next-js",
  query: "instant navigation partial prefetching cacheComponents",
  limit: 8
)
```

On the July 19, 2026 `vercel/next.js` canary snapshot, this returned
`matchMode: "all_terms"`. The leading results included:

| Rank | Page | Why it matters |
| ---: | --- | --- |
| 1 | `docs/01-app/02-guides/adopting-partial-prefetching` | Flag, `<Link>` behavior, migration, and codemod |
| 2 | `docs/01-app/02-guides/runtime-prefetching` | Runtime URL and session-data prefetch behavior |
| 4 | `docs/01-app/02-guides/instant-navigation` | Stream, Cache, Block, validation, and App Shell |
| 6 | `docs/01-app/03-api-reference/03-file-conventions/02-route-segment-config/instant` | Exact `instant` segment contract |

The agent then needed two bounded reads:

```text
get_doc_page(
  project: "next-js",
  slug: "docs/01-app/02-guides/instant-navigation",
  offset: 0,
  length: 40000
)

get_doc_page(
  project: "next-js",
  slug: "docs/01-app/02-guides/adopting-partial-prefetching",
  offset: 0,
  length: 40000
)
```

Those calls returned 25,743 and 22,260 characters respectively, plus these
machine-readable source paths:

- `docs/01-app/02-guides/instant-navigation.mdx`
- `docs/01-app/02-guides/adopting-partial-prefetching.mdx`

No vector search, embedding generation, reranker, or hosted LLM answer call is
part of this path.

After this branch is deployed, the same evidence can be packed in one bounded
call while preserving the retrieval trace:

```text
build_docs_context(
  project: "next-js",
  task: "Explain Instant Navigation and Partial Prefetching; compare Stream, Cache, and Block; list flags and migration gotchas",
  maxTokens: 12000,
  maxPages: 6
)
```

The response explicitly reports `embeddings: false`, `answerModel: false`, the
exact/BM25 strategy, selected pages, omitted candidates, and `sourceFiles`.
Smolify still returns evidence rather than a generated answer.

## Example agent synthesis

The retrieved evidence supports an answer like this:

> Next.js treats an instant navigation as one that can show meaningful UI as
> soon as the user clicks, while unresolved work continues behind explicit
> boundaries. There are three practical levers:
>
> - **Stream:** move uncached or runtime-dependent work into a child beneath
>   `<Suspense>`, allowing the rest of the App Shell to render immediately.
> - **Cache:** add `"use cache"` and an appropriate `cacheLife` policy when the
>   result can safely become part of the reusable shell.
> - **Block:** export `const instant = false` from a page or layout when that
>   segment should opt out of instant-navigation validation. This suppresses
>   the validation feedback; it does not force the route to be slow.
>
> Partial Prefetching is enabled with `cacheComponents: true` and
> `partialPrefetching: true`. A normal `<Link>` then downloads the destination's
> shared App Shell rather than a full per-link render. `prefetch={false}` still
> disables prefetching. URL-specific data such as `params` and `searchParams`
> cannot live in the shared shell, so it should stream from behind `<Suspense>`
> or be resolved through runtime prefetching with
> `export const prefetch = 'allow-runtime'`.
>
> During migration, audit legacy `<Link prefetch={true}>` calls because they no
> longer imply a full dynamic prefetch. Teams can adopt route by route with
> `prefetch = 'partial'` while the global flag remains off, then run
> `npx @next/codemod@canary remove-partial-prefetch ./app` after enabling the
> global flag.
>
> Sources:
> `docs/01-app/02-guides/instant-navigation.mdx` and
> `docs/01-app/02-guides/adopting-partial-prefetching.mdx`.

This is synthesis, not a stored Smolify answer. Another capable MCP client can
use the same evidence and produce a response appropriate to its user's task.

## Observed matched run

The same challenge was sent to the public Smolify and DeepWiki MCPs on July 19,
2026. This is a small product demonstration, not a statistically meaningful
retrieval benchmark, but it gives the recording an auditable checklist.

| Requested evidence | Smolify retrieval + Codex | DeepWiki `ask_question` |
| --- | --- | --- |
| Stream, Cache, and Block | Covered | Covered |
| Required config flags | Covered | Covered |
| `<Link>` behavior | Covered | Covered |
| Migration gotchas and codemod | Covered | Covered |
| Exact official repository paths | Returned as structured `sourceFiles` | Not returned in this feature-answer run |
| Explicit source snapshot date/revision | Exposed by project discovery | Not exposed in the answer |
| Inspectable pre-answer retrieval trace | Search hits and bounded reads | Synthesized answer returned directly |

DeepWiki was stronger on a separate implementation-architecture question
because it could synthesize across source-code bodies. Smolify now narrows that
gap with deterministic public declaration and call-relationship pages. This
branch also adds bounded context composition and explicit, commit-pinned public
source-line reads while still declining to persist implementations or literal
values. Keep both results in the comparison: they show the added code-level
retrieval and its deliberate privacy boundary.

## Implementation architecture rerun

The harder comparison used exact internal identifiers instead of guide terms:

```text
How do navigateUsingPrefetchedRouteTree, readRouteCacheEntry, and
fetchServerResponse work together in Next.js client segment-cache navigation?
Explain the cache-hit path and the network fallback, and cite the implementation.
```

The production Smolify MCP available during the July 19 run did not yet expose
the tools in this branch. Its search fell back to `matchMode: "any_term"` and
returned conceptual navigation documentation rather than the requested
implementation. DeepWiki found the internal flow and identified the
orchestration in `navigation.ts`, the cache definition in `cache.ts`, and the
network primitive in `fetch-server-response.ts`, so it was materially better
on that live implementation query.

The branch was then exercised against the pinned July 19, 2026 Next.js canary
snapshot `0491db047b8f9c4a5f9d0285ad9ed514bb134873`. These are observed results,
not a forecast:

| Evidence check | Before source rebalance | This branch |
| --- | ---: | ---: |
| Fetched content files | 261 | 261 |
| Generated source-symbol pages | 78 | 50 |
| Target `navigation.ts` fetched | No | Yes |
| Five relevant identifiers captured | 0/5 | 5/5 |
| Query definitions resolved on demand | Not available | 3/3 |
| Unresolved query identifiers | 3 | 0 |
| Scoped caller/callee edges | Not available | Returned |
| Connector reaching all three symbols | Not available | `navigateImpl` |

The five sampling checks were `navigateUsingPrefetchedRouteTree`,
`readRouteCacheEntry`, `fetchServerResponse`, `navigateToUnknownRoute`, and
`startPPRNavigation`. The smaller source-page count is intentional: the importer
now reserves part of its unchanged 96-file/2-MB public-source allowance for
high-value navigation, prefetch, scheduler, reducer, and resolver paths, then
uses the remainder for repository breadth.

With the exact source-page path supplied automatically as a hint, the
relationship resolver followed its relative imports and stopped after three
files totaling 204,948 tree-accounted bytes. It found these exact definitions:

- `navigateUsingPrefetchedRouteTree` in `navigation.ts` at line 382;
- `readRouteCacheEntry` in `cache.ts` at line 455; and
- `fetchServerResponse` in `fetch-server-response.ts` at line 149.

The value-free graph reports `navigateImpl → readRouteCacheEntry`,
`navigateImpl → navigateUsingPrefetchedRouteTree`, and
`navigateToUnknownRoute → fetchServerResponse`. Its short-path search also
finds the connector
`navigateImpl → navigateToUnknownRoute → fetchServerResponse`, so
`navigateImpl` reaches all three requested symbols. If imports are absent or
incomplete the resolver falls back to a ranked scan capped at 96 files/4 MB. It
packed two complementary excerpts:

- [`navigation.ts` lines 126–206](https://github.com/vercel/next.js/blob/0491db047b8f9c4a5f9d0285ad9ed514bb134873/packages/next/src/client/components/segment-cache/navigation.ts#L126-L206), covering `readRouteCacheEntry` and `navigateUsingPrefetchedRouteTree`;
- [`navigation.ts` lines 476–516](https://github.com/vercel/next.js/blob/0491db047b8f9c4a5f9d0285ad9ed514bb134873/packages/next/src/client/components/segment-cache/navigation.ts#L476-L516), covering the `fetchServerResponse` fallback.

This closes the demonstrated evidence gap: the branch reaches the same internal
flow that made DeepWiki's answer useful, while adding an immutable revision,
exact line ranges, bounded scan accounting, and an inspectable retrieval trace.
It does **not** establish that Smolify is universally better than DeepWiki. A
fresh import and deployment are still required before the public MCP can repeat
this run, and the final prose quality still depends on the calling agent.

## Executable parity contract

The comparison is now a release-test contract rather than only a prose demo:

```bash
npm run test:retrieval-parity
npm run test:retrieval-parity:live
```

The deterministic suite uses a Next.js-shaped fixture plus adversarial strings,
comments, regex literals, malformed source, missing symbols, private-read
boundaries, MCP annotations, and small/large context budgets. It gates exact
identifier and definition recall, required scoped edges, the three-symbol
connector, commit-pinned URLs, scan/evidence caps, docs-facet recall, and the
no-embeddings/no-answer-model boundary.

The opt-in live suite imports the current `vercel/next.js` canary, requires all
five sampling identifiers, resolves the three architecture definitions in at
most six files/4 MB, checks the `navigateImpl` connector and required call
edges, and requires bounded source evidence. Network drift can change the
pinned commit, but it cannot silently weaken these assertions.

## What this proves—and what it does not

It proves that semantic-looking answers do not require semantic retrieval when
the repository uses strong terminology and BM25 indexes identifiers, headings,
body text, and source paths separately. A capable agent can combine several
precise lexical hits into a coherent explanation.

It does not prove that embeddings never help, or that deterministic symbol
metadata can explain every implementation detail. Smolify indexes public
declarations, imported modules, and call references, but intentionally does not
persist function bodies or literal values. For an eligible public import, an
agent can request an explicit bounded source range or resolve up to eight exact
identifiers through source-page hints and a ranked pinned-tree scan capped at 96
files/4 MB. Unresolved identifiers remain explicit. This is still not an
exhaustive hosted source corpus, semantic code index, or complete call graph.

That limitation is about corpus coverage, not the absence of embeddings. The
new relationship and live suites measure one architecture task rigorously;
additional reviewed scenarios should cover cross-package indirection, dynamic
dispatch, overloaded names, and languages beyond TypeScript. The agent applies
the identical search-read-synthesize loop to both documentation and source
evidence.

## Local CodeDB design comparison

The implementation was compared against the local `justrach/codedb` checkout at
`origin/main` commit `c6e50fa763a811d35b833a2c784c5522e01622f4`. The hosted
CodeDB endpoint was unavailable during the comparison, so no Smolify runtime
dependency on it was introduced.

| Retrieval concern | CodeDB pattern | Smolify adaptation |
| --- | --- | --- |
| Known identifiers | Exact symbol lookup is the primary tool | Exact newline-delimited symbol aliases run before BM25 |
| Relationships | Callers, graph-resolved callees, and call paths | `inspect_public_symbols` derives value-free exact definitions, scoped callers/callees, and short connector paths from bounded public reads |
| First-touch task | `codedb_context` extracts up to three identifiers and packs sections by value under `max_tokens` | `build_docs_context` extracts up to three identifiers, searches focused task facets, penalizes low-value structural pages, and fairly packs exact and BM25 evidence |
| Detailed evidence | Local bounded source reads and optional symbol bodies | Exact source-page hints plus relative-import following and a bounded pinned-tree fallback select complementary source ranges; explicit reads remain available and fetched bodies are never persisted |
| Budget discipline | Section admission and hard `max_tokens` tests | Graph sections and excerpts share a hard serialized cap with deterministic value ordering and monotonic budget tests |
| Semantic infrastructure | No embeddings required | No embeddings and no hosted answer model; the MCP client synthesizes |

The privacy boundary is intentionally different. CodeDB is a local code index
and can retain full source bodies, a word index, trigram search, and a resolved
call graph. Smolify is multi-tenant and hosted: private source remains
metadata-only, public imports persist only value-free structural pages, and raw
public code is an explicit bounded read from an immutable GitHub commit. That
makes Smolify's implementation reasoning less exhaustive than CodeDB's local
graph, but keeps the evidence trail inspectable without turning Smolify into a
hosted source-code warehouse.

## DeepWiki comparison

Use the same prompt in DeepWiki and record both evidence trails. Compare:

- whether the answer covers Stream, Cache, Block, configuration, and migration;
- whether it identifies the exact source paths;
- whether it exposes the repository revision or freshness date;
- whether unsupported claims can be traced back to retrieved material; and
- how much server-side machinery was required before the agent saw evidence.

The intended claim is not that every Smolify query beats DeepWiki. It is:

> Smolify can give an existing coding agent enough current, inspectable evidence
> to synthesize a DeepWiki-style answer using deterministic BM25 retrieval—no
> embedding pipeline or opaque hosted answer step required.
