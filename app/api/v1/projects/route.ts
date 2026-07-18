import { getCloudflareContext } from "@opennextjs/cloudflare";
import { z } from "zod";
import { createAuth } from "@/lib/auth";
import { listAccessibleProjects } from "@/lib/projects/access";

const createProjectSchema = z.object({
  name: z.string().trim().min(2).max(80),
  slug: z
    .string()
    .trim()
    .toLowerCase()
    .min(2)
    .max(60)
    .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),
});

async function sessionFor(request: Request) {
  const auth = await createAuth(request);
  return auth.api.getSession({ headers: request.headers });
}

export async function GET(request: Request) {
  const session = await sessionFor(request);
  if (!session) return Response.json({ error: "Authentication required" }, { status: 401 });
  const { env } = await getCloudflareContext({ async: true });
  return Response.json({ projects: await listAccessibleProjects(env, session.user.id) });
}

export async function POST(request: Request) {
  const session = await sessionFor(request);
  if (!session) return Response.json({ error: "Authentication required" }, { status: 401 });
  const parsed = createProjectSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return Response.json({ error: "Invalid project", issues: parsed.error.issues }, { status: 422 });
  }

  const { env } = await getCloudflareContext({ async: true });
  const existingMembership = await env.DB.prepare(
    `SELECT organization.id, organization.slug
     FROM organization
     JOIN member ON member.organizationId = organization.id
     WHERE member.userId = ?
     ORDER BY member.createdAt
     LIMIT 1`,
  )
    .bind(session.user.id)
    .first<{ id: string; slug: string }>();

  const organizationId = existingMembership?.id ?? crypto.randomUUID();
  const nowMs = Date.now();
  const now = new Date(nowMs).toISOString();
  const projectId = crypto.randomUUID();
  const statements: D1PreparedStatement[] = [];

  if (!existingMembership) {
    const organizationSlug = `${parsed.data.slug}-${session.user.id.slice(0, 8)}`;
    statements.push(
      env.DB.prepare(
        `INSERT INTO organization (id, name, slug, createdAt) VALUES (?, ?, ?, ?)`,
      ).bind(organizationId, `${session.user.name}'s workspace`, organizationSlug, nowMs),
      env.DB.prepare(
        `INSERT INTO member (id, organizationId, userId, role, createdAt)
         VALUES (?, ?, ?, 'owner', ?)`,
      ).bind(crypto.randomUUID(), organizationId, session.user.id, nowMs),
    );
  }

  statements.push(
    env.DB.prepare(
      `INSERT INTO projects (id, organization_id, slug, name, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?)`,
    ).bind(projectId, organizationId, parsed.data.slug, parsed.data.name, now, now),
  );

  try {
    await env.DB.batch(statements);
  } catch (error) {
    if (String(error).includes("UNIQUE")) {
      return Response.json({ error: "That project slug is already taken" }, { status: 409 });
    }
    console.error("Failed to create project", error);
    throw error;
  }

  return Response.json(
    { id: projectId, slug: parsed.data.slug, name: parsed.data.name },
    { status: 201 },
  );
}
