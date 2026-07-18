import { z } from "zod";
import { docsBundleSchema, type DocsBundle } from "@/lib/docs/schema";
import { publishDocsDeployment } from "@/lib/docs/deployments";

export const gpt56ModelSchema = z.string()
  .trim()
  .max(80)
  .regex(/^gpt-5\.6(?:$|[-.])/i, "Contributions currently require a GPT-5.6 model identifier");

export async function rateProjectDocs(
  env: CloudflareEnv,
  input: { projectId: string; userId: string; score: number; notes?: string; model: string },
) {
  const now = new Date().toISOString();
  const id = crypto.randomUUID();
  await env.DB.prepare(
    `INSERT INTO doc_ratings (id, project_id, user_id, score, notes, model, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(project_id, user_id) DO UPDATE SET
       score = excluded.score,
       notes = excluded.notes,
       model = excluded.model,
       updated_at = excluded.updated_at`,
  ).bind(
    id,
    input.projectId,
    input.userId,
    input.score,
    input.notes?.trim().slice(0, 2_000) || null,
    gpt56ModelSchema.parse(input.model),
    now,
    now,
  ).run();

  return env.DB.prepare(
    `SELECT COALESCE(AVG(score), 0) AS average, COUNT(*) AS count
     FROM doc_ratings WHERE project_id = ?`,
  ).bind(input.projectId).first<{ average: number; count: number }>();
}

export async function createImprovementProposal(
  env: CloudflareEnv,
  input: {
    projectId: string;
    authorUserId: string;
    activeDeploymentId: string | null;
    bundle: DocsBundle;
    model: string;
    summary: string;
    rationale: string;
  },
) {
  const bundle = docsBundleSchema.parse(input.bundle);
  const model = gpt56ModelSchema.parse(input.model);
  const proposalId = crypto.randomUUID();
  const now = new Date().toISOString();
  const objectKey = `projects/${input.projectId}/proposals/${proposalId}/bundle.json`;
  await env.DOCS.put(objectKey, JSON.stringify(bundle), {
    httpMetadata: { contentType: "application/json; charset=utf-8" },
    customMetadata: { projectId: input.projectId, proposalId },
  });
  try {
    await env.DB.prepare(
      `INSERT INTO doc_improvement_proposals (
         id, project_id, author_user_id, base_deployment_id, object_key,
         model, summary, rationale, status, created_at
       ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'pending', ?)`,
    ).bind(
      proposalId,
      input.projectId,
      input.authorUserId,
      input.activeDeploymentId,
      objectKey,
      model,
      input.summary.trim().slice(0, 240),
      input.rationale.trim().slice(0, 4_000),
      now,
    ).run();
  } catch (error) {
    await env.DOCS.delete(objectKey);
    throw error;
  }
  return { proposalId, status: "pending" as const, baseDeploymentId: input.activeDeploymentId };
}

export async function listProjectProposals(
  env: CloudflareEnv,
  projectId: string,
  status: "pending" | "accepted" | "rejected" = "pending",
) {
  const result = await env.DB.prepare(
    `SELECT proposals.id, proposals.model, proposals.summary, proposals.rationale,
       proposals.status, proposals.created_at AS createdAt,
       proposals.base_deployment_id AS baseDeploymentId,
       user.name AS authorName
     FROM doc_improvement_proposals proposals
     JOIN "user" user ON user.id = proposals.author_user_id
     WHERE proposals.project_id = ? AND proposals.status = ?
     ORDER BY proposals.created_at DESC
     LIMIT 50`,
  ).bind(projectId, status).all<{
    id: string;
    model: string;
    summary: string;
    rationale: string;
    status: "pending" | "accepted" | "rejected";
    createdAt: string;
    baseDeploymentId: string | null;
    authorName: string;
  }>();
  return result.results;
}

export async function reviewImprovementProposal(
  env: CloudflareEnv,
  input: {
    proposalId: string;
    project: { id: string; slug: string };
    reviewerUserId: string;
    decision: "accept" | "reject";
    origin: string;
  },
) {
  const proposal = await env.DB.prepare(
    `SELECT id, object_key AS objectKey, status
     FROM doc_improvement_proposals
     WHERE id = ? AND project_id = ? LIMIT 1`,
  ).bind(input.proposalId, input.project.id).first<{
    id: string;
    objectKey: string;
    status: "pending" | "accepted" | "rejected";
  }>();
  if (!proposal || proposal.status !== "pending") return null;

  const now = new Date().toISOString();
  const finalStatus = input.decision === "accept" ? "accepted" : "rejected";
  const claimed = await env.DB.prepare(
    `UPDATE doc_improvement_proposals
     SET status = ?, reviewed_at = ?, reviewed_by = ?
     WHERE id = ? AND project_id = ? AND status = 'pending'`,
  ).bind(
    finalStatus,
    now,
    input.reviewerUserId,
    input.proposalId,
    input.project.id,
  ).run();
  if (!claimed.meta.changes) return null;

  let deployment: Awaited<ReturnType<typeof publishDocsDeployment>> | null = null;
  if (input.decision === "accept") {
    try {
      const object = await env.DOCS.get(proposal.objectKey);
      if (!object) throw new Error("Proposal bundle is missing");
      const bundle = docsBundleSchema.parse(await object.json());
      deployment = await publishDocsDeployment(env, input.project, bundle, { origin: input.origin });
    } catch (error) {
      await env.DB.prepare(
        `UPDATE doc_improvement_proposals
         SET status = 'pending', reviewed_at = NULL, reviewed_by = NULL
         WHERE id = ? AND project_id = ? AND status = 'accepted' AND reviewed_by = ?`,
      ).bind(input.proposalId, input.project.id, input.reviewerUserId).run();
      throw error;
    }
  }
  return { status: finalStatus, deployment };
}
