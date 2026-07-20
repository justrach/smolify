import type { MetadataRoute } from "next";
import { getCloudflareContext } from "@opennextjs/cloudflare";

export const dynamic = "force-dynamic";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const { env } = await getCloudflareContext({ async: true });
  const result = await env.DB.prepare(
    `SELECT projects.slug AS project, projects.updated_at AS updatedAt, doc_pages.slug
     FROM projects
     JOIN doc_pages
       ON doc_pages.project_id = projects.id
      AND doc_pages.deployment_id = projects.active_deployment_id
     WHERE projects.visibility = 'public'
       AND projects.deleted_at IS NULL
       AND projects.active_deployment_id IS NOT NULL
     ORDER BY projects.updated_at DESC, doc_pages.slug
     LIMIT 45000`,
  ).all<{ project: string; slug: string; updatedAt: string }>();
  const projectEntries = new Map<string, string>();
  for (const row of result.results) projectEntries.set(row.project, row.updatedAt);
  return [
    { url: "https://app.smol.ly", changeFrequency: "daily", priority: 1 },
    { url: "https://app.smol.ly/explore", changeFrequency: "daily", priority: 0.9 },
    { url: "https://app.smol.ly/privacy", changeFrequency: "monthly", priority: 0.3 },
    { url: "https://app.smol.ly/terms", changeFrequency: "monthly", priority: 0.3 },
    ...[...projectEntries].map(([project, updatedAt]) => ({
      url: `https://app.smol.ly/explore/${project}`,
      lastModified: new Date(updatedAt),
      changeFrequency: "weekly" as const,
      priority: 0.8,
    })),
    ...result.results.map((row) => ({
      url: `https://app.smol.ly/${row.project}/${row.slug}`,
      lastModified: new Date(row.updatedAt),
      changeFrequency: "weekly" as const,
      priority: row.slug === "introduction" ? 0.8 : 0.6,
    })),
  ];
}
