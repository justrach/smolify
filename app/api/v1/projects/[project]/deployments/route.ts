import { getCloudflareContext } from "@opennextjs/cloudflare";
import { publishDocsDeployment } from "@/lib/docs/deployments";
import { docsBundleSchema } from "@/lib/docs/schema";
import { readBearerToken, sha256 } from "@/lib/security/tokens";

const MAX_BUNDLE_BYTES = 2_000_000;

type RouteContext = { params: Promise<{ project: string }> };

export async function POST(request: Request, { params }: RouteContext) {
  const token = readBearerToken(request);
  if (!token) return Response.json({ error: "Missing publish token" }, { status: 401 });

  const declaredLength = Number(request.headers.get("content-length") ?? 0);
  if (declaredLength > MAX_BUNDLE_BYTES) {
    return Response.json({ error: "Bundle exceeds 2 MB" }, { status: 413 });
  }

  let raw: string;
  try {
    raw = await request.text();
  } catch {
    return Response.json({ error: "Unable to read bundle" }, { status: 400 });
  }
  if (new TextEncoder().encode(raw).byteLength > MAX_BUNDLE_BYTES) {
    return Response.json({ error: "Bundle exceeds 2 MB" }, { status: 413 });
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return Response.json({ error: "Bundle must be valid JSON" }, { status: 400 });
  }

  const bundle = docsBundleSchema.safeParse(parsed);
  if (!bundle.success) {
    return Response.json(
      { error: "Invalid docs bundle", issues: bundle.error.issues.slice(0, 20) },
      { status: 422 },
    );
  }

  const { project: projectSlug } = await params;
  const { env } = await getCloudflareContext({ async: true });
  const tokenHash = await sha256(token);
  const project = await env.DB.prepare(
    `SELECT projects.id, projects.slug
     FROM projects
     JOIN publish_tokens ON publish_tokens.project_id = projects.id
     WHERE projects.slug = ?
       AND publish_tokens.token_hash = ?
       AND publish_tokens.revoked_at IS NULL
       AND projects.deleted_at IS NULL`,
  )
    .bind(projectSlug, tokenHash)
    .first<{ id: string; slug: string }>();

  if (!project) return Response.json({ error: "Invalid publish token" }, { status: 403 });

  const deployment = await publishDocsDeployment(env, project, bundle.data, {
    origin: new URL(request.url).origin,
    tokenHash,
  });
  return Response.json(deployment, { status: 201 });
}
