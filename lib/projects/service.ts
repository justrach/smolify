export type ProjectVisibility = "public" | "private";
export type ProjectSourceType = "manual" | "github" | "archive";

type CreateProjectInput = {
  name: string;
  slug: string;
  visibility?: ProjectVisibility;
  sourceType?: ProjectSourceType;
  sourceUrl?: string | null;
  sourceRevision?: string | null;
  sourceFileCount?: number;
  importedAt?: string | null;
};

export async function uniqueProjectSlug(env: CloudflareEnv, desired: string) {
  const base = desired
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 54) || "repository";

  for (let suffix = 0; suffix < 100; suffix += 1) {
    const candidate = suffix === 0 ? base : `${base}-${suffix + 1}`;
    const existing = await env.DB.prepare(
      "SELECT id FROM projects WHERE slug = ? LIMIT 1",
    ).bind(candidate).first<{ id: string }>();
    if (!existing) return candidate;
  }
  return `${base}-${crypto.randomUUID().slice(0, 6)}`;
}

export async function createProjectForUser(
  env: CloudflareEnv,
  user: { id: string; name: string },
  input: CreateProjectInput,
) {
  const existingMembership = await env.DB.prepare(
    `SELECT organization.id, organization.slug
     FROM organization
     JOIN member ON member.organizationId = organization.id
     WHERE member.userId = ?
     ORDER BY member.createdAt
     LIMIT 1`,
  )
    .bind(user.id)
    .first<{ id: string; slug: string }>();

  const organizationId = existingMembership?.id ?? crypto.randomUUID();
  const nowMs = Date.now();
  const now = new Date(nowMs).toISOString();
  const projectId = crypto.randomUUID();
  const statements: D1PreparedStatement[] = [];

  if (!existingMembership) {
    const organizationSlug = `${input.slug}-${user.id.slice(0, 8)}`;
    statements.push(
      env.DB.prepare(
        `INSERT INTO organization (id, name, slug, createdAt) VALUES (?, ?, ?, ?)`,
      ).bind(organizationId, `${user.name}'s workspace`, organizationSlug, nowMs),
      env.DB.prepare(
        `INSERT INTO member (id, organizationId, userId, role, createdAt)
         VALUES (?, ?, ?, 'owner', ?)`,
      ).bind(crypto.randomUUID(), organizationId, user.id, nowMs),
    );
  }

  statements.push(
    env.DB.prepare(
      `INSERT INTO projects (
         id, organization_id, slug, name, visibility, source_type, source_url,
         source_revision, source_file_count, imported_at, created_at, updated_at
       ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    ).bind(
      projectId,
      organizationId,
      input.slug,
      input.name,
      input.visibility ?? "public",
      input.sourceType ?? "manual",
      input.sourceUrl ?? null,
      input.sourceRevision ?? null,
      input.sourceFileCount ?? 0,
      input.importedAt ?? null,
      now,
      now,
    ),
  );

  await env.DB.batch(statements);
  return {
    id: projectId,
    slug: input.slug,
    name: input.name,
    visibility: input.visibility ?? "public",
  };
}
