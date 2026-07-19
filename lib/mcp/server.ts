import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { docsBundleSchema } from "@/lib/docs/schema";
import { publishDocsDeployment } from "@/lib/docs/deployments";
import { getActiveDocPage, listActiveDocPages, searchActiveDocs } from "@/lib/docs/search-repository";
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
        "Smolify publishes, searches, rates, and improves repository documentation. Public project discovery, structure, search, and bounded page reads work without authentication. Search before reading a page. Private projects and every write operation use OAuth. Proposals never publish automatically: the project owner reviews them. Only call publish_docs for an owned project after the user has reviewed the generated bundle and explicitly approved publication.",
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
        "Search one active documentation deployment with weighted BM25. Returns bounded passages; lower score means more relevant.",
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
