export type AccessibleProject = {
  id: string;
  slug: string;
  name: string;
  organizationId: string;
  role: string;
  visibility: "public" | "private";
  activeDeploymentId: string | null;
  sourceUrl: string | null;
};

export async function getAccessibleProject(
  env: CloudflareEnv,
  userId: string,
  projectSlug: string,
): Promise<AccessibleProject | null> {
  return env.DB.prepare(
    `SELECT projects.id, projects.slug, projects.name,
       projects.organization_id AS organizationId, member.role,
       projects.visibility,
       projects.active_deployment_id AS activeDeploymentId,
       projects.source_url AS sourceUrl
     FROM projects
     JOIN member ON member.organizationId = projects.organization_id
     WHERE projects.slug = ?
       AND member.userId = ?
       AND projects.deleted_at IS NULL`,
  )
    .bind(projectSlug, userId)
    .first<AccessibleProject>();
}

export async function getReadableProject(
  env: CloudflareEnv,
  userId: string | null,
  projectSlug: string,
): Promise<(AccessibleProject & { isMember: boolean }) | null> {
  return env.DB.prepare(
    `SELECT projects.id, projects.slug, projects.name,
       projects.organization_id AS organizationId,
       COALESCE(member.role, '') AS role,
       projects.visibility,
       projects.active_deployment_id AS activeDeploymentId,
       projects.source_url AS sourceUrl,
       CASE WHEN member.userId IS NULL THEN 0 ELSE 1 END AS isMember
     FROM projects
     LEFT JOIN member
       ON member.organizationId = projects.organization_id
      AND member.userId = ?
     WHERE projects.slug = ?
       AND projects.deleted_at IS NULL
       AND (projects.visibility = 'public' OR member.userId IS NOT NULL)
     LIMIT 1`,
  )
    .bind(userId ?? "", projectSlug)
    .first<AccessibleProject & { isMember: boolean }>();
}

export async function getPublicProject(env: CloudflareEnv, projectSlug: string) {
  return env.DB.prepare(
    `SELECT projects.id, projects.slug, projects.name, projects.source_url AS sourceUrl,
       projects.source_type AS sourceType, projects.source_file_count AS sourceFileCount,
       projects.active_deployment_id AS activeDeploymentId,
       projects.updated_at AS updatedAt,
       COALESCE(AVG(doc_ratings.score), 0) AS ratingAverage,
       COUNT(doc_ratings.id) AS ratingCount,
       (SELECT COUNT(*) FROM doc_improvement_proposals proposals
        WHERE proposals.project_id = projects.id AND proposals.status = 'accepted') AS acceptedImprovements
     FROM projects
     LEFT JOIN doc_ratings ON doc_ratings.project_id = projects.id
     WHERE projects.slug = ?
       AND projects.visibility = 'public'
       AND projects.deleted_at IS NULL
       AND projects.active_deployment_id IS NOT NULL
     GROUP BY projects.id
     LIMIT 1`,
  )
    .bind(projectSlug)
    .first<{
      id: string;
      slug: string;
      name: string;
      sourceUrl: string | null;
      sourceType: "manual" | "github" | "archive";
      sourceFileCount: number;
      activeDeploymentId: string;
      updatedAt: string;
      ratingAverage: number;
      ratingCount: number;
      acceptedImprovements: number;
    }>();
}

export async function listPublicProjects(env: CloudflareEnv, limit = 48) {
  const result = await env.DB.prepare(
    `SELECT projects.slug, projects.name, projects.source_url AS sourceUrl,
       projects.source_type AS sourceType, projects.source_file_count AS sourceFileCount,
       projects.updated_at AS updatedAt,
       COALESCE(AVG(doc_ratings.score), 0) AS ratingAverage,
       COUNT(doc_ratings.id) AS ratingCount,
       (SELECT COUNT(*) FROM doc_improvement_proposals proposals
        WHERE proposals.project_id = projects.id AND proposals.status = 'accepted') AS acceptedImprovements
     FROM projects
     LEFT JOIN doc_ratings ON doc_ratings.project_id = projects.id
     WHERE projects.visibility = 'public'
       AND projects.deleted_at IS NULL
       AND projects.active_deployment_id IS NOT NULL
     GROUP BY projects.id
     ORDER BY projects.updated_at DESC
     LIMIT ?`,
  )
    .bind(limit)
    .all<{
      slug: string;
      name: string;
      sourceUrl: string | null;
      sourceType: "manual" | "github" | "archive";
      sourceFileCount: number;
      updatedAt: string;
      ratingAverage: number;
      ratingCount: number;
      acceptedImprovements: number;
    }>();
  return result.results;
}

export async function listAccessibleProjects(env: CloudflareEnv, userId: string) {
  const result = await env.DB.prepare(
    `SELECT projects.id, projects.slug, projects.name, projects.visibility,
       projects.source_type AS sourceType, projects.source_url AS sourceUrl,
       projects.source_file_count AS sourceFileCount,
       projects.active_deployment_id AS activeDeploymentId,
       domains.id AS domainId, domains.hostname, domains.status AS domainStatus,
       COALESCE((SELECT AVG(score) FROM doc_ratings WHERE project_id = projects.id), 0) AS ratingAverage,
       (SELECT COUNT(*) FROM doc_ratings WHERE project_id = projects.id) AS ratingCount,
       (SELECT COUNT(*) FROM doc_improvement_proposals
        WHERE project_id = projects.id AND status = 'pending') AS pendingProposals
     FROM projects
     JOIN member ON member.organizationId = projects.organization_id
     LEFT JOIN domains ON domains.id = (
       SELECT candidate.id FROM domains AS candidate
       WHERE candidate.project_id = projects.id AND candidate.kind = 'custom'
       ORDER BY candidate.created_at DESC LIMIT 1
     )
     WHERE member.userId = ? AND projects.deleted_at IS NULL
     ORDER BY projects.updated_at DESC`,
  )
    .bind(userId)
    .all<{
      id: string;
      slug: string;
      name: string;
      visibility: "public" | "private";
      sourceType: "manual" | "github" | "archive";
      sourceUrl: string | null;
      sourceFileCount: number;
      activeDeploymentId: string | null;
      domainId: string | null;
      hostname: string | null;
      domainStatus: "pending" | "verifying" | "active" | "failed" | null;
      ratingAverage: number;
      ratingCount: number;
      pendingProposals: number;
    }>();
  return result.results;
}
