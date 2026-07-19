import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { docsBundleSchema } from "@/lib/docs/schema";
import { publishDocsDeployment } from "@/lib/docs/deployments";
import { getActiveDocPage, listActiveDocPages, searchActiveDocs } from "@/lib/docs/search-repository";
import { buildDocsContext } from "@/lib/docs/context";
import { readPublicSource } from "@/lib/imports/public-source";
import { buildPublicSourceEvidence, resolvePublicSymbols } from "@/lib/imports/public-symbols";
import { getAccessibleProject, getReadableProject, listAccessibleProjects, listPublicProjects } from "@/lib/projects/access";
import { createImprovementProposal, gpt56ModelSchema, rateProjectDocs } from "@/lib/contributions/repository";
import { getUserIdentity } from "@/lib/auth/identity";
import type { McpPrincipal } from "./auth";

function toolResult(value: Record<string, unknown>) {
  return {
    content: [{ type: "text" as const, text: JSON.stringify(value) }],
    structuredContent: value,
  };
}

function requireScope(principal: McpPrincipal, scope: string) {
  if (!principal.scopes.has(scope)) throw new Error(`OAuth authentication and scope required: ${scope}`);
}

function requireAuthenticated(principal: McpPrincipal) {
  if (!principal.authenticated || !principal.userId) throw new Error("OAuth authentication required");
  return principal.userId;
}

async function requireProject(env: CloudflareEnv, principal: McpPrincipal, project: string) {
  const accessible = await getAccessibleProject(env, requireAuthenticated(principal), project);
  if (!accessible) throw new Error(`Project not found or not accessible: ${project}`);
  return accessible;
}

async function requireReadableProject(env: CloudflareEnv, principal: McpPrincipal, project: string) {
  const readable = await getReadableProject(env, principal.userId, project);
  if (!readable) throw new Error(`Project not found or not readable: ${project}`);
  return readable;
}

export function createSmolifyMcpServer(
  env: CloudflareEnv,
  principal: McpPrincipal,
  origin: string,
) {
  const server = new McpServer(
    { name: "smolify", version: "0.1.0" },
    {
      instructions:
        "Smolify publishes, searches, rates, and improves repository documentation. Public project discovery, structure, exact-identifier/BM25 search, bounded context packs, and page reads work without authentication. Use build_docs_context for facet-diverse answer-sized evidence; it can resolve exact identifiers against bounded commit-pinned public source without embeddings. Inspect confidence, unresolved identifiers, and fallback use, synthesize the answer yourself, and cite sourceFiles/sourceUrl values. No hosted answer model runs in Smolify. Public GitHub imports expose deterministic value-free source-symbol pages and optional commit-pinned line reads; private and uploaded source remains metadata-only. Private projects and every write operation use OAuth. Proposals never publish automatically: the project owner reviews them. Only call publish_docs for an owned project after the user has reviewed the generated bundle and explicitly approved publication.",
    },
  );

  server.registerTool(
    "discover_public_projects",
    {
      title: "Discover public repository documentation",
      description: "List public Smolify projects that agents may search, rate, and propose improvements for.",
      inputSchema: z.object({ query: z.string().trim().max(120).optional() }),
      annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
    },
    async ({ query }) => {
      requireScope(principal, "projects:read");
      const projects = await listPublicProjects(env, 48);
      const normalized = query?.toLowerCase();
      return toolResult({
        projects: normalized
          ? projects.filter((project) => `${project.name} ${project.slug} ${project.sourceUrl ?? ""}`.toLowerCase().includes(normalized))
          : projects,
      });
    },
  );

  server.registerTool(
    "whoami",
    {
      title: "Inspect authenticated Smolify identity",
      description: "Return the signed-in identity, connected providers, granted OAuth scopes, and identity assurance used for community review status.",
      inputSchema: z.object({}),
      annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
    },
    async () => {
      const userId = requireAuthenticated(principal);
      const identity = await getUserIdentity(env, userId);
      if (!identity) throw new Error("Authenticated Smolify identity was not found");
      return toolResult({
        identity,
        scopes: [...principal.scopes].sort(),
        canPublishOwnedProjects: principal.scopes.has("docs:publish"),
        note: "Identity assurance affects the 10-review community status. Publishing still requires project ownership and the docs:publish OAuth scope.",
      });
    },
  );

  server.registerTool(
    "list_projects",
    {
      title: "List Smolify projects",
      description: "List documentation projects accessible to the authenticated user.",
      inputSchema: z.object({}),
      annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
    },
    async () => {
      requireScope(principal, "projects:read");
      return toolResult({ projects: await listAccessibleProjects(env, requireAuthenticated(principal)) });
    },
  );

  server.registerTool(
    "read_docs_structure",
    {
      title: "Read documentation structure",
      description: "List the active documentation pages for one public or accessible Smolify project before searching or reading them.",
      inputSchema: z.object({ project: z.string().min(1).max(120) }),
      annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
    },
    async ({ project }) => {
      requireScope(principal, "docs:read");
      await requireReadableProject(env, principal, project);
      return toolResult({ project, pages: await listActiveDocPages(env, project) });
    },
  );

  server.registerTool(
    "search_docs",
    {
      title: "Search hosted documentation",
      description:
        "Search one active documentation deployment. Exact code identifiers are matched before weighted BM25; the response reports confidence, fallback use, identifier coverage, source files, and bounded passages.",
      inputSchema: z.object({
        project: z.string().min(1).max(120),
        query: z.string().min(1).max(500),
        limit: z.number().int().min(1).max(20).default(8),
      }),
      annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
    },
    async ({ project, query, limit }) => {
      requireScope(principal, "docs:read");
      await requireReadableProject(env, principal, project);
      return toolResult(await searchActiveDocs(env, project, query, limit));
    },
  );

  server.registerTool(
    "get_doc_page",
    {
      title: "Read a hosted documentation page",
      description:
        "Read a bounded Markdown slice from an active page. Use search_docs first and continue with offset when totalLength exceeds the returned slice.",
      inputSchema: z.object({
        project: z.string().min(1).max(120),
        slug: z.string().min(1).max(160),
        offset: z.number().int().min(0).default(0),
        length: z.number().int().min(1_000).max(40_000).default(12_000),
      }),
      annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
    },
    async ({ project, slug, offset, length }) => {
      requireScope(principal, "docs:read");
      await requireReadableProject(env, principal, project);
      const page = await getActiveDocPage(env, project, slug, offset, length);
      if (!page) throw new Error(`Documentation page not found: ${slug}`);
      return toolResult({ ...page, offset, length });
    },
  );

  server.registerTool(
    "build_docs_context",
    {
      title: "Build bounded documentation context",
      description:
        "Compose an answer-sized evidence pack with exact identifier lookup, focused FTS5/BM25 facets, and eligible commit-pinned public source ranges. Smolify does not call embeddings or an answer model; the calling agent synthesizes and cites the evidence.",
      inputSchema: z.object({
        project: z.string().min(1).max(120),
        task: z.string().min(3).max(1_000),
        maxTokens: z.number().int().min(1_000).max(12_000).default(4_000),
        maxPages: z.number().int().min(1).max(10).default(6),
      }),
      annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: true },
    },
    async ({ project, task, maxTokens, maxPages }) => {
      requireScope(principal, "docs:read");
      const readable = await requireReadableProject(env, principal, project);
      const canResolveSource = readable.sourceType === "github"
        && readable.sourceRetention === "public-symbols";
      const docsTokenBudget = canResolveSource ? Math.max(1_000, Math.floor(maxTokens * 0.65)) : maxTokens;
      const context = await buildDocsContext(env, project, task, {
        maxTokens: docsTokenBudget,
        maxPages,
      });
      const resolvableIdentifiers = context.strategy.exactIdentifiers.filter((identifier) =>
        /^[A-Za-z_$][\w$]{2,120}$/.test(identifier),
      );
      if (!canResolveSource || !resolvableIdentifiers.length) return toolResult(context);
      const sourceCharacterBudget = Math.max(
        0,
        (maxTokens - context.approximateTokensUsed - 300) * 4,
      );
      if (sourceCharacterBudget < 300) {
        return toolResult({
          ...context,
          sourceResolution: { skipped: "token_budget" },
          instruction: "Synthesize from the documentation evidence, cite sourceFiles, and call resolve_public_symbols or read_public_source when more implementation detail is necessary.",
        });
      }
      try {
        const pathHints = [...new Set(context.pages
          .filter((page) => page.retrieval === "exact_identifier")
          .flatMap((page) => page.sourceFiles))];
        const source = await buildPublicSourceEvidence(
          readable,
          resolvableIdentifiers,
          { maxCharacters: sourceCharacterBudget, pathHints },
          env.GITHUB_TOKEN?.trim() || undefined,
        );
        const sourceCharacters = source.evidence.reduce((sum, item) => sum + item.content.length, 0);
        return toolResult({
          ...context,
          sourceResolution: {
            commit: source.resolution.commit,
            requested: source.resolution.requested,
            matched: source.resolution.matched,
            unresolved: source.resolution.unresolved,
            treeTruncated: source.resolution.treeTruncated,
            candidateFiles: source.resolution.candidateFiles,
            scannedFiles: source.resolution.scannedFiles,
            scannedBytes: source.resolution.scannedBytes,
            files: source.resolution.files.map((file) => ({
              path: file.path,
              matchedSymbols: file.matchedSymbols,
            })),
          },
          sourceEvidence: source.evidence,
          approximateTokensUsed: context.approximateTokensUsed + Math.ceil(sourceCharacters / 4),
          instruction: "Synthesize from the documentation and source evidence, cite sourceFiles and commit-pinned sourceUrl values, and label unresolved identifiers or uncertainty.",
        });
      } catch (error) {
        return toolResult({
          ...context,
          sourceResolution: {
            error: error instanceof Error ? error.message : "Public source resolution failed",
          },
        });
      }
    },
  );

  server.registerTool(
    "resolve_public_symbols",
    {
      title: "Resolve identifiers in pinned public source",
      description:
        "Resolve up to eight exact code identifiers without embeddings by checking source-file hints first, then ranking the imported GitHub tree and scanning at most 96 files/4 MB. Returns value-free paths, line numbers, match kinds, and commit-pinned links.",
      inputSchema: z.object({
        project: z.string().min(1).max(120),
        symbols: z.array(z.string().regex(/^[A-Za-z_$][\w$]{2,120}$/)).min(1).max(8),
        pathHints: z.array(z.string().min(1).max(500)).max(20).optional(),
        maxResults: z.number().int().min(1).max(20).default(8),
      }),
      annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: true },
    },
    async ({ project, symbols, pathHints, maxResults }) => {
      requireScope(principal, "docs:read");
      const readable = await requireReadableProject(env, principal, project);
      return toolResult(await resolvePublicSymbols(
        readable,
        symbols,
        { maxResults, pathHints },
        env.GITHUB_TOKEN?.trim() || undefined,
      ));
    },
  );

  server.registerTool(
    "read_public_source",
    {
      title: "Read commit-pinned public source lines",
      description:
        "Read at most 200 explicit lines from a safe source-code path at the public GitHub commit imported by Smolify. Disabled for private repositories, ZIP uploads, and metadata-only projects.",
      inputSchema: z.object({
        project: z.string().min(1).max(120),
        path: z.string().min(1).max(500),
        startLine: z.number().int().min(1).default(1),
        lineCount: z.number().int().min(1).max(200).default(80),
      }),
      annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: true },
    },
    async ({ project, path, startLine, lineCount }) => {
      requireScope(principal, "docs:read");
      const readable = await requireReadableProject(env, principal, project);
      return toolResult(await readPublicSource(readable, {
        path,
        startLine,
        endLine: startLine + lineCount - 1,
      }));
    },
  );

  server.registerTool(
    "rate_docs",
    {
      title: "Rate public documentation",
      description: "Record or update one authenticated GPT-5.6 agent rating for a readable project.",
      inputSchema: z.object({
        project: z.string().min(1).max(120),
        score: z.number().int().min(1).max(5),
        notes: z.string().trim().max(2_000).optional(),
        model: gpt56ModelSchema,
      }),
      annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: true, openWorldHint: false },
    },
    async ({ project, score, notes, model }) => {
      requireScope(principal, "docs:contribute");
      const readable = await requireReadableProject(env, principal, project);
      const aggregate = await rateProjectDocs(env, {
        projectId: readable.id,
        userId: requireAuthenticated(principal),
        score,
        notes,
        model,
      });
      return toolResult({ project, score, aggregate });
    },
  );

  server.registerTool(
    "propose_doc_improvement",
    {
      title: "Propose improved documentation",
      description: "Submit a complete validated replacement bundle for owner review. This never changes the live deployment by itself.",
      inputSchema: z.object({
        project: z.string().min(1).max(120),
        model: gpt56ModelSchema,
        summary: z.string().trim().min(8).max(240),
        rationale: z.string().trim().min(20).max(4_000),
        bundle: docsBundleSchema,
      }),
      annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: true },
    },
    async ({ project, model, summary, rationale, bundle }) => {
      requireScope(principal, "docs:contribute");
      const readable = await requireReadableProject(env, principal, project);
      const proposal = await createImprovementProposal(env, {
        projectId: readable.id,
        authorUserId: requireAuthenticated(principal),
        activeDeploymentId: readable.activeDeploymentId,
        bundle,
        model,
        summary,
        rationale,
      });
      return toolResult({ project, ...proposal, publicationChanged: false });
    },
  );

  server.registerTool(
    "publish_docs",
    {
      title: "Publish a documentation bundle",
      description:
        "Validate, store, index, and activate an immutable Smolify bundle. This changes the public documentation deployment and requires explicit user approval.",
      inputSchema: z.object({
        project: z.string().min(1).max(120),
        bundle: docsBundleSchema,
      }),
      annotations: { readOnlyHint: false, destructiveHint: true, idempotentHint: false, openWorldHint: true },
    },
    async ({ project, bundle }) => {
      requireScope(principal, "docs:publish");
      const accessible = await requireProject(env, principal, project);
      const deployment = await publishDocsDeployment(env, accessible, bundle, { origin });
      return toolResult(deployment);
    },
  );

  return server;
}
