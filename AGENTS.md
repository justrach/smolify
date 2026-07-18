# Smolify agent guide

Smolify is a hosted, multi-tenant API documentation platform. It does not use
Fumadocs, Mintlify code, or runtime MDX evaluation. Codex generates a portable
docs bundle in the user's repository; Smolify validates, stores, renders, and
hosts that bundle.

## Product constraints

- Treat generated documentation as untrusted input.
- Accept Markdown, never executable MDX or arbitrary JSX.
- Sanitize rendered HTML and validate every publish payload.
- Scope every database query and R2 key by project/tenant.
- Never send dashboard authentication cookies to customer custom domains.
- Store large documents and images in R2; D1 stores metadata and references.
- Use prepared D1 statements. Never interpolate SQL.
- A publish token is project-scoped, shown once, and stored only as a SHA-256 hash.
- Custom-domain onboarding uses Cloudflare for SaaS APIs. Do not mutate Wrangler
  configuration in response to an end-user request.

## Commands

- `npm run dev` — Next.js development server with local Cloudflare bindings
- `npm test` — unit tests
- `npm run typecheck` — strict TypeScript validation
- `npm run build` — Next.js production build
- `npm run cf:build` — OpenNext Cloudflare production build
- `npm run db:migrate:local` — apply D1 migrations locally

## Done means

Run tests, typecheck, and the production build. For deployment-sensitive work,
also run the OpenNext build. Update `docs/architecture.md` when storage,
security boundaries, tenant routing, or deployment topology changes.
