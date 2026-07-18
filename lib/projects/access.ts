export type AccessibleProject = {
  id: string;
  slug: string;
  name: string;
  organizationId: string;
  role: string;
};

export async function getAccessibleProject(
  env: CloudflareEnv,
  userId: string,
  projectSlug: string,
): Promise<AccessibleProject | null> {
  return env.DB.prepare(
    `SELECT projects.id, projects.slug, projects.name,
       projects.organization_id AS organizationId, member.role
     FROM projects
     JOIN member ON member.organizationId = projects.organization_id
     WHERE projects.slug = ?
       AND member.userId = ?
       AND projects.deleted_at IS NULL`,
  )
    .bind(projectSlug, userId)
    .first<AccessibleProject>();
}

export async function listAccessibleProjects(env: CloudflareEnv, userId: string) {
  const result = await env.DB.prepare(
    `SELECT projects.slug, projects.name,
       projects.active_deployment_id AS activeDeploymentId,
       domains.id AS domainId, domains.hostname, domains.status AS domainStatus
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
      slug: string;
      name: string;
      activeDeploymentId: string | null;
      domainId: string | null;
      hostname: string | null;
      domainStatus: "pending" | "verifying" | "active" | "failed" | null;
    }>();
  return result.results;
}
