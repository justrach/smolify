import { getCloudflareContext } from "@opennextjs/cloudflare";
import { demoBundle } from "./demo";
import { docsBundleSchema, type DocsBundle } from "./schema";

export async function getDocsBundle(projectSlug: string): Promise<DocsBundle | null> {
  if (projectSlug === "pawprint") return demoBundle;

  try {
    const { env } = await getCloudflareContext({ async: true });
    const project = await env.DB.prepare(
      `SELECT id, active_deployment_id AS deploymentId
       FROM projects
       WHERE slug = ? AND deleted_at IS NULL`,
    )
      .bind(projectSlug)
      .first<{ id: string; deploymentId: string | null }>();

    if (!project?.deploymentId) return null;
    const object = await env.DOCS.get(
      `projects/${project.id}/deployments/${project.deploymentId}/bundle.json`,
    );
    if (!object) return null;

    return docsBundleSchema.parse(await object.json());
  } catch {
    // `next build` and the plain Next.js dev server may not have provisioned
    // Cloudflare bindings yet. Only the explicit demo project falls back.
    return null;
  }
}
