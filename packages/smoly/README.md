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

The installer writes an additive portable `smolify` entry to
`~/.mcpconfig.json`, writes each detected agent's native configuration shape,
and installs the cross-client skill at `~/.agents/skills/smolify-api-docs`.
The native files are authoritative because remote MCP fields differ between
clients.

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

## Supported agents

| Agent | Configuration written | Transport |
|---|---|---|
| Codex | `~/.codex/config.toml` | Native Streamable HTTP |
| Claude Code | `~/.claude.json` | Native HTTP |
| Gemini CLI | `~/.gemini/settings.json` | Native Streamable HTTP |
| Devin | `~/.config/devin/config.json` | Native HTTP |
| Cursor | `~/.cursor/mcp.json` | Native Streamable HTTP |
| Windsurf | `~/.codeium/windsurf/mcp_config.json` | Native HTTP |
| OpenCode | `~/.config/opencode/opencode.json` | Native remote MCP |
| Factory Droid | `~/.factory/mcp.json` | Native HTTP |
| Forge | `~/forge/.mcp.json` | Native HTTP |
| Graff | `<current project>/.mcp.json` | Stdio through pinned `mcp-remote` |

Pass `--agent graff` from the project you want to configure. Graff currently
accepts stdio MCP servers, so Smolify uses a pinned HTTP-to-stdio bridge for
that client. All other clients connect to Smolify directly.

Smolify is hosted, so there is no platform binary to download: clients connect
directly to `https://app.smol.ly/mcp`, preserving native HTTP transport and
OAuth where the client supports it. `smolify doctor` performs a real MCP
initialize and tool-discovery handshake against that endpoint.
