import { getCloudflareContext } from "@opennextjs/cloudflare";
import { cache } from "react";
import { demoBundle } from "./demo";
import { docsBundleSchema, type DocsBundle } from "./schema";

async function loadDocsBundle(projectSlug: string): Promise<DocsBundle | null> {
  if (projectSlug === "pawprint") return demoBundle;

  try {
    const { env } = await getCloudflareContext({ async: true });
    const project = await env.DB.prepare(
      `SELECT projects.id, projects.name,
         projects.active_deployment_id AS deploymentId,
         intro.title AS introTitle,
         intro.description AS introDescription,
         intro.markdown AS introMarkdown
       FROM projects
       LEFT JOIN doc_pages intro
         ON intro.project_id = projects.id
        AND intro.deployment_id = projects.active_deployment_id
        AND intro.slug = 'introduction'
       WHERE projects.slug = ? AND projects.deleted_at IS NULL`,
    )
      .bind(projectSlug)
      .first<{
        id: string;
        name: string;
        deploymentId: string | null;
        introTitle: string | null;
        introDescription: string | null;
        introMarkdown: string | null;
      }>();

    if (!project?.deploymentId) return null;
    const object = await env.DOCS.get(
      `projects/${project.id}/deployments/${project.deploymentId}/bundle.json`,
    );
    if (!object) return null;

    const bundle = docsBundleSchema.parse(await object.json());
    const intro = bundle.pages.find((page) => page.slug === "introduction");
    if (!intro) return bundle;

    const introTitle = project.introTitle || project.name || intro.title;
    const introDescription = project.introDescription || bundle.project.description;
    return {
      ...bundle,
      project: {
        ...bundle.project,
        name: project.name || bundle.project.name,
        description: introDescription,
      },
      navigation: bundle.navigation.map((group) => ({
        ...group,
        items: group.items.map((item) => item.slug === "introduction"
          ? { ...item, label: introTitle }
          : item),
      })),
      pages: bundle.pages.map((page) => page.slug === "introduction"
        ? {
            ...page,
            title: introTitle,
            description: introDescription,
            markdown: project.introMarkdown || page.markdown,
          }
        : page),
    };
  } catch {
    // `next build` and the plain Next.js dev server may not have provisioned
    // Cloudflare bindings yet. Only the explicit demo project falls back.
    return null;
  }
}

// A docs request uses the same bundle in both metadata and the route. R2
// objects can be large, so only fetch and validate a bundle once per render.
export const getDocsBundle = cache(loadDocsBundle);
