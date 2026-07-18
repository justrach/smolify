# Smolify

Smolify is a Codex-native, open-source API documentation platform. A repository
skill asks Codex to analyze the actual API implementation, writes reviewable
Markdown into a versioned bundle, and publishes it to a hosted docs experience.

Smolify does not use Fumadocs and does not execute runtime MDX.

Live service: <https://smol.ly>

**Tiny setup. Serious docs.** The product origin is `smol.ly`; hosted projects
use `{project}.smol.ly`, and teams can attach their own custom domain.

## What works

- Original Next.js documentation UI and Markdown rendering pipeline
- Strict runtime bundle validation and sanitized HTML output
- Better Auth email/password and optional GitHub OAuth on Cloudflare D1
- Better Auth organizations for workspace membership
- Project-scoped publish tokens stored as SHA-256 hashes
- Immutable documentation bundles stored in R2
- D1 FTS5/BM25 search tuned for API identifiers and bounded agent results
- A production remote MCP with OAuth 2.1 discovery, dynamic client registration,
  authorization-code + PKCE, consent, refresh tokens, and scoped tools
- A small TypeScript SDK for CI and other agents
- Cloudflare for SaaS custom-hostname onboarding, validation status, and routing
- OpenNext build targeting Cloudflare Workers
- Installable `smolify-api-docs` Codex skill with validation and publishing scripts
- Guided, per-project onboarding for MCP authorization, skill installation, and first publish
- Public Pawprint API demo at `/pawprint/introduction`

## Brand kit

The brand guide, voice, colors, and usage rules live in
[`docs/brand.md`](docs/brand.md). Reusable SVG assets are in
[`public/brand`](public/brand).

## Architecture

See [docs/architecture.md](docs/architecture.md). The short version is:

```text
API repository
  └─ Codex + Smolify skill
       └─ .smolify/smolify.bundle.json (reviewed in git)
            └─ OAuth MCP publish_docs (or a scoped CI token)
                 └─ Smolify Worker
                      ├─ D1: auth, tenants, projects, domains, search
                      └─ R2: immutable docs bundles and assets
```

The design was checked against the DeepWiki documentation for
`opennextjs/opennextjs-cloudflare`, `cloudflare/workers-sdk`,
`better-auth/better-auth`, and `vercel/next.js` before implementation.

The evolved agent model is: Codex reads and authors in the local repository;
Smolify's remote MCP only authenticates, publishes, and searches hosted docs.
See [docs/architecture.md](docs/architecture.md) for the tool and indexing
contracts.

## SDK sketch

The SDK accepts an async token provider, so an OAuth client can refresh tokens
without teaching the API client how credentials are stored:

```ts
import { SmolifyClient } from "./sdk";

const smolify = new SmolifyClient({
  accessToken: () => oauthSession.getAccessToken(),
});

await smolify.publish("pawprint", bundle);
const hits = await smolify.search("pawprint", "createUserById 409");
const page = await smolify.getPage("pawprint", hits.results[0].slug, {
  length: 12_000,
});
```

## Local setup

Requirements: Node.js 20+ and npm.

```bash
npm install
cp .dev.vars.example .dev.vars
# Replace BETTER_AUTH_SECRET with a random value of at least 32 characters.
npm run db:migrate:local
npm run preview
```

Open:

- Landing page: <http://localhost:8787>
- Generated docs demo: <http://localhost:8787/pawprint/introduction>
- Authentication: <http://localhost:8787/login>

GitHub OAuth is optional. If enabled, add its client ID and secret to
`.dev.vars` and register this callback:

```text
http://localhost:8787/api/auth/callback/github
```

## Connect Codex and install the skill

Connect the remote MCP once. Codex opens the OAuth flow in your browser; no API
key is pasted into chat or stored in the repository.

```bash
codex mcp add smolify --url https://smol.ly/mcp
codex mcp login smolify
```

Then ask Codex inside the API repository:

```text
Install the smolify-api-docs skill from
https://github.com/justrach/smolify/tree/main/skills/smolify-api-docs
into this repository.
```

Or install it directly:

```bash
npx degit justrach/smolify/skills/smolify-api-docs .codex/skills/smolify-api-docs
```

For local development of this repository, you can also copy the checked-in
skill into another API repository:

```bash
mkdir -p /path/to/api/.codex/skills
cp -R skills/smolify-api-docs /path/to/api/.codex/skills/smolify-api-docs
```

Then open that repository in Codex and ask:

```text
Use $smolify-api-docs to document this API. Analyze the implementation,
contracts, schemas, middleware, and tests. Generate the bundle, validate it,
and stop before publishing so I can review the diff.
```

After review, ask Codex to publish with the authenticated MCP. For headless CI,
set `SMOLIFY_PROJECT` and `SMOLIFY_PUBLISH_TOKEN` and use the skill's publishing
script instead.

The skill never prints a token.

## Verification

```bash
npm test
npm run typecheck
npm run lint
npm run build
npm run cf:build
npm run preview             # in one terminal
npm run test:e2e:mcp        # in another terminal
```

## Cloudflare setup

For a fresh Cloudflare account, create the resources and put the returned D1
database ID in `wrangler.jsonc`:

```bash
npx wrangler login
npx wrangler d1 create smolify-db
npx wrangler r2 bucket create smolify-docs
npx wrangler secret put BETTER_AUTH_SECRET
npm run db:migrate:remote
npm run deploy
```

Set `BETTER_AUTH_URL` and `SMOLIFY_ROOT_DOMAIN` to the production application
origin and platform docs domain. Store OAuth credentials with `wrangler secret
put`; do not commit them.

### Custom domains

The dashboard integrates with Cloudflare for SaaS / Custom Hostnames APIs and
stores certificate validation/status in D1. Configure a SaaS zone and fallback
origin in Cloudflare, add `CLOUDFLARE_ZONE_ID` and
`CLOUDFLARE_CUSTOM_HOSTNAME_TARGET` to Wrangler vars, then set a token with
`SSL and Certificates Write` permission:

```bash
npx wrangler secret put CLOUDFLARE_API_TOKEN
```

Customers can then enter `docs.example.com`, follow the returned CNAME/TXT
instructions, and use **Check status** until the hostname and certificate are
active. The Worker resolves active custom hosts from D1. It never mutates
Wrangler configuration in response to an end-user request.

## License

MIT. See [LICENSE](LICENSE).
