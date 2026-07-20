# Smolify benchmark

This branch is tested on a real Next.js architecture question: can bounded,
deterministic retrieval give a coding agent enough evidence to explain the
segment-cache navigation flow without embeddings or a hosted answer model?

On the July 19, 2026 pinned `vercel/next.js` canary snapshot
`0491db047b8f9c4a5f9d0285ad9ed514bb134873`:

| Audited check | Result |
| --- | ---: |
| Sampled identifiers captured | **5/5** |
| Exact definitions resolved | **3/3** |
| Relationship scan | **3 files · 204,948 bytes** |
| Cross-file connector | **`navigateImpl` reaches all 3** |
| Evidence provenance | **2 commit-pinned excerpts** |
| Embeddings / hosted answer model | **None / none** |

Run the deterministic and opt-in live gates:

```bash
npm run test:retrieval-parity
npm run test:retrieval-parity:live
```

Read the [full reproducible methodology, MCP trace, DeepWiki comparison,
CodeDB design comparison, and limitations](docs/retrieval-synthesis-benchmark.md).

> This is evidence-level parity on one audited architecture task. It is not a
> universal answer-quality claim over DeepWiki or CodeDB. The recorded public
> Smolify deployment predates the branch-local relationship tools; a fresh
> import and deployment are required to reproduce them through the public MCP.
