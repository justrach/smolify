import { getCloudflareContext } from "@opennextjs/cloudflare";
import { z } from "zod";
import { createAuth } from "@/lib/auth";
import {
  createCloudflareCustomHostname,
  customHostnameState,
  getCloudflareCustomHostname,
  normalizeCustomHostname,
} from "@/lib/cloudflare/custom-hostnames";
import { getAccessibleProject } from "@/lib/projects/access";

type RouteContext = { params: Promise<{ project: string }> };

const createDomainSchema = z.object({ hostname: z.string().trim().min(1).max(253) });
const refreshDomainSchema = z.object({ id: z.string().uuid() });

type DomainRow = {
  id: string;
  hostname: string;
  status: "pending" | "verifying" | "active" | "failed";
  verificationErrors: string | null;
  validationRecords: string | null;
  lastCheckedAt: string | null;
};

function jsonValue<T>(value: string | null, fallback: T): T {
  if (!value) return fallback;
  try {
    return JSON.parse(value) as T;
  } catch {
    return fallback;
  }
}

function serializeDomain(env: CloudflareEnv, row: DomainRow) {
  return {
    id: row.id,
    hostname: row.hostname,
    status: row.status,
    cnameTarget: env.CLOUDFLARE_CUSTOM_HOSTNAME_TARGET ?? null,
    errors: jsonValue<string[]>(row.verificationErrors, []),
    validation: jsonValue<Record<string, unknown>>(row.validationRecords, {}),
    lastCheckedAt: row.lastCheckedAt,
  };
}

async function projectFor(request: Request, projectSlug: string) {
  const auth = await createAuth(request);
  const session = await auth.api.getSession({ headers: request.headers });
  if (!session) return { error: Response.json({ error: "Authentication required" }, { status: 401 }) };
  const { env } = await getCloudflareContext({ async: true });
  const project = await getAccessibleProject(env, session.user.id, projectSlug);
  if (!project) return { error: Response.json({ error: "Project not found" }, { status: 404 }) };
  return { env, project };
}

function canManage(role: string) {
  return role.split(",").some((value) => value === "owner" || value === "admin");
}

async function listDomains(env: CloudflareEnv, projectId: string) {
  return env.DB.prepare(
    `SELECT id, hostname, status,
       verification_errors AS verificationErrors,
       validation_records AS validationRecords,
       last_checked_at AS lastCheckedAt
     FROM domains
     WHERE project_id = ? AND kind = 'custom'
     ORDER BY created_at DESC`,
  )
    .bind(projectId)
    .all<DomainRow>();
}

export async function GET(request: Request, { params }: RouteContext) {
  const { project: projectSlug } = await params;
  const access = await projectFor(request, projectSlug);
  if ("error" in access) return access.error;
  const domains = await listDomains(access.env, access.project.id);
  return Response.json({ domains: domains.results.map((row) => serializeDomain(access.env, row)) });
}

export async function POST(request: Request, { params }: RouteContext) {
  const { project: projectSlug } = await params;
  const access = await projectFor(request, projectSlug);
  if ("error" in access) return access.error;
  if (!canManage(access.project.role)) {
    return Response.json({ error: "Owner or admin access required" }, { status: 403 });
  }
  if (
    !access.env.CLOUDFLARE_API_TOKEN ||
    !access.env.CLOUDFLARE_ZONE_ID ||
    !access.env.CLOUDFLARE_CUSTOM_HOSTNAME_TARGET
  ) {
    return Response.json(
      { error: "Custom domains are not configured for this Smolify installation" },
      { status: 503 },
    );
  }
  const parsed = createDomainSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: "Enter a valid hostname" }, { status: 422 });

  let hostname: string;
  try {
    hostname = normalizeCustomHostname(parsed.data.hostname);
  } catch (error) {
    return Response.json({ error: String(error).replace(/^Error: /, "") }, { status: 422 });
  }
  const root = access.env.SMOLIFY_ROOT_DOMAIN.toLowerCase().replace(/^\./, "");
  if (hostname === root || hostname.endsWith(`.${root}`)) {
    return Response.json({ error: "Platform subdomains do not need custom-domain onboarding" }, { status: 422 });
  }
  const existing = await listDomains(access.env, access.project.id);
  if (existing.results.length) {
    return Response.json({ error: "This project already has a custom domain" }, { status: 409 });
  }

  const id = crypto.randomUUID();
  const now = new Date().toISOString();
  try {
    await access.env.DB.prepare(
      `INSERT INTO domains (id, project_id, hostname, kind, status, created_at, last_checked_at)
       VALUES (?, ?, ?, 'custom', 'pending', ?, ?)`,
    )
      .bind(id, access.project.id, hostname, now, now)
      .run();
  } catch (error) {
    if (String(error).includes("UNIQUE")) {
      return Response.json({ error: "That hostname is already connected" }, { status: 409 });
    }
    throw error;
  }

  try {
    const created = await createCloudflareCustomHostname(access.env, hostname, access.project.id);
    const state = customHostnameState(created);
    const checkedAt = new Date().toISOString();
    await access.env.DB.prepare(
      `UPDATE domains
       SET status = ?, cloudflare_hostname_id = ?, verification_errors = ?,
           validation_records = ?, last_checked_at = ?, verified_at = ?
       WHERE id = ? AND project_id = ?`,
    )
      .bind(
        state.status,
        created.id,
        JSON.stringify(state.errors),
        JSON.stringify(state.validation),
        checkedAt,
        state.status === "active" ? checkedAt : null,
        id,
        access.project.id,
      )
      .run();
  } catch (error) {
    await access.env.DB.prepare(`DELETE FROM domains WHERE id = ? AND project_id = ?`)
      .bind(id, access.project.id)
      .run();
    return Response.json({ error: String(error).replace(/^Error: /, "") }, { status: 502 });
  }

  const domains = await listDomains(access.env, access.project.id);
  return Response.json(serializeDomain(access.env, domains.results[0]), { status: 201 });
}

export async function PATCH(request: Request, { params }: RouteContext) {
  const { project: projectSlug } = await params;
  const access = await projectFor(request, projectSlug);
  if ("error" in access) return access.error;
  if (!canManage(access.project.role)) {
    return Response.json({ error: "Owner or admin access required" }, { status: 403 });
  }
  const parsed = refreshDomainSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: "Invalid domain" }, { status: 422 });
  const row = await access.env.DB.prepare(
    `SELECT id, cloudflare_hostname_id AS cloudflareHostnameId
     FROM domains WHERE id = ? AND project_id = ? AND kind = 'custom'`,
  )
    .bind(parsed.data.id, access.project.id)
    .first<{ id: string; cloudflareHostnameId: string | null }>();
  if (!row?.cloudflareHostnameId) {
    return Response.json({ error: "Domain is not registered with Cloudflare" }, { status: 409 });
  }

  try {
    const current = await getCloudflareCustomHostname(access.env, row.cloudflareHostnameId);
    const state = customHostnameState(current);
    const checkedAt = new Date().toISOString();
    await access.env.DB.prepare(
      `UPDATE domains
       SET status = ?, verification_errors = ?, validation_records = ?,
           last_checked_at = ?, verified_at = ?
       WHERE id = ? AND project_id = ?`,
    )
      .bind(
        state.status,
        JSON.stringify(state.errors),
        JSON.stringify(state.validation),
        checkedAt,
        state.status === "active" ? checkedAt : null,
        row.id,
        access.project.id,
      )
      .run();
  } catch (error) {
    return Response.json({ error: String(error).replace(/^Error: /, "") }, { status: 502 });
  }
  const domains = await listDomains(access.env, access.project.id);
  const domain = domains.results.find((candidate) => candidate.id === row.id);
  return Response.json(serializeDomain(access.env, domain!));
}
