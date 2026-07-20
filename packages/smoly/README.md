# smolify

One command installs the hosted Smolify MCP and the `smolify-api-docs` Agent
Skill without copying access tokens into a repository:

```bash
bunx smolify install
```

The installer writes an additive `smolify` entry to `~/.mcpconfig.json` (the
source-of-truth format used by
[`mcpsync`](https://github.com/justrach/mcpsync)), synchronizes detected agent
configuration files, and installs the cross-client skill at
`~/.agents/skills/smolify-api-docs`.

```bash
smoly install --agent codex,cursor
smoly install --dry-run
smoly status
smoly uninstall
```

Public repository discovery and search work without signing in. Private docs,
ratings, proposals, and publishing use the agent's MCP OAuth flow. For Codex,
you can authorize explicitly with:

```bash
codex mcp login smolify
```

The installer only updates the `smolify` MCP entry. Other MCP servers and
unrelated agent settings are preserved, and writes are atomic.
