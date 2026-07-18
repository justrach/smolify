import { getCloudflareContext } from "@opennextjs/cloudflare";
import { z } from "zod";
import { createAuth } from "@/lib/auth";
import { getAccessibleProject } from "@/lib/projects/access";
import { docsBundleSchema } from "@/lib/docs/schema";
import { reviewImprovementProposal } from "@/lib/contributions/repository";
import { sha256 } from "@/lib/security/tokens";

type RouteContext = { params: Promise<{ project: string; proposal: string }> };
const decisionSchema = z.object({
  decision: z.enum(["accept", "reject"]),
  bundleHash: z.string().length(64).optional(),
});

async function ownerContext(request: Request, projectSlug: string) {
  const auth = await createAuth(request);
  const session = await auth.api.getSession({ headers: request.headers });
  if (!session) return null;
  const { env } = await getCloudflareContext({ async: true });
  const project = await getAccessibleProject(env, session.user.id, projectSlug);
  if (!project || !["owner", "admin"].includes(project.role)) return null;
  return { env, session, project };
}

async function proposalBundle(env: CloudflareEnv, projectId: string, proposalId: string) {
  const proposal = await env.DB.prepare(
    `SELECT id, object_key AS objectKey, status, model, summary, rationale
     FROM doc_improvement_proposals
     WHERE id = ? AND project_id = ? LIMIT 1`,
  ).bind(proposalId, projectId).first<{
    id: string;
    objectKey: string;
    status: "pending" | "accepted" | "rejected";
    model: string;
    summary: string;
    rationale: string;
  }>();
  if (!proposal) return null;
  const object = await env.DOCS.get(proposal.objectKey);
  if (!object) return null;
  const bundle = docsBundleSchema.parse(await object.json());
  const bundleHash = await sha256(JSON.stringify(bundle));
  return { proposal, bundle, bundleHash };
}

export async function GET(request: Request, { params }: RouteContext) {
  const { project, proposal } = await params;
  const context = await ownerContext(request, project);
  if (!context) return Response.json({ error: "Proposal not found" }, { status: 404 });
  const result = await proposalBundle(context.env, context.project.id, proposal);
  if (!result) return Response.json({ error: "Proposal not found" }, { status: 404 });
  return Response.json(result);
}

export async function PATCH(request: Request, { params }: RouteContext) {
  const { project, proposal } = await params;
  const context = await ownerContext(request, project);
  if (!context) return Response.json({ error: "Proposal not found" }, { status: 404 });
  const parsed = decisionSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: "Invalid review decision" }, { status: 422 });
  if (parsed.data.decision === "accept") {
    const result = await proposalBundle(context.env, context.project.id, proposal);
    if (!result || parsed.data.bundleHash !== result.bundleHash) {
      return Response.json({ error: "Preview the current proposal bundle before accepting it" }, { status: 409 });
    }
  }
  const reviewed = await reviewImprovementProposal(context.env, {
    proposalId: proposal,
    project: context.project,
    reviewerUserId: context.session.user.id,
    decision: parsed.data.decision,
    origin: new URL(request.url).origin,
  });
  if (!reviewed) return Response.json({ error: "Proposal is no longer pending" }, { status: 409 });
  return Response.json(reviewed);
}
