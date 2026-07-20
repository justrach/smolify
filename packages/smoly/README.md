# smolify

One command installs the hosted Smolify MCP and the `smolify-api-docs` Agent
Skill without copying access tokens into a repository:

```bash
npx -y smolify
```

Or install it once. Like CodeDB's installer, a global npm install detects the
agents already present on the machine and registers Smolify additively:

```bash
npm install -g smolify
smolify doctor
```

`smolify` is the primary executable; `smoly` remains as a compatible alias.
Local dependency installs do not edit user configuration. Set
`SMOLIFY_SKIP_POSTINSTALL=1` to skip global auto-registration too.

The installer writes an additive `smolify` entry to `~/.mcpconfig.json` (the
source-of-truth format used by
[`mcpsync`](https://github.com/justrach/mcpsync)), synchronizes detected agent
configuration files, and installs the cross-client skill at
`~/.agents/skills/smolify-api-docs`.

```bash
smolify install --agent codex,cursor
smolify install --dry-run
smolify status
smolify doctor
smolify uninstall
```

Public repository discovery and search work without signing in. Private docs,
ratings, proposals, and publishing use the agent's MCP OAuth flow. For Codex,
you can authorize explicitly with:

```bash
codex mcp login smolify
```

The installer only updates the `smolify` MCP entry. Other MCP servers and
unrelated agent settings are preserved, and writes are atomic.

Smolify is hosted, so there is no platform binary to download: clients connect
directly to `https://app.smol.ly/mcp`, preserving native HTTP transport and
OAuth. `smolify doctor` performs a real MCP initialize and tool-discovery
handshake against that endpoint.
