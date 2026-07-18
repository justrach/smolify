import type { DocsBundle } from "./schema";
import { pageToSearchDocument } from "./search";

export async function publishDocsDeployment(
  env: CloudflareEnv,
  project: { id: string; slug: string },
  bundle: DocsBundle,
  options: { origin: string; tokenHash?: string },
) {
  const deploymentId = crypto.randomUUID();
  const now = new Date().toISOString();
  const objectKey = `projects/${project.id}/deployments/${deploymentId}/bundle.json`;
  await env.DOCS.put(objectKey, JSON.stringify(bundle), {
    httpMetadata: { contentType: "application/json; charset=utf-8" },
    customMetadata: { projectId: project.id, deploymentId },
  });

  try {
    await env.DB.prepare(
      `INSERT INTO deployments (id, project_id, object_key, page_count, generator_model, created_at)
       VALUES (?, ?, ?, ?, ?, ?)`,
    )
      .bind(
        deploymentId,
        project.id,
        objectKey,
        bundle.pages.length,
        bundle.generator.model,
        now,
      )
      .run();

    const pageStatements = bundle.pages.map((page) => {
      const indexed = pageToSearchDocument(page);
      return env.DB.prepare(
        `INSERT INTO doc_pages (
           id, project_id, deployment_id, slug, title, description, headings,
           symbols, body_text, source_files, markdown
         ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      ).bind(
        `${deploymentId}:${page.slug}`,
        project.id,
        deploymentId,
        page.slug,
        page.title,
        page.description,
        indexed.headings,
        indexed.symbols,
        indexed.bodyText,
        indexed.sourceFiles,
        page.markdown,
      );
    });
    for (let offset = 0; offset < pageStatements.length; offset += 25) {
      await env.DB.batch(pageStatements.slice(offset, offset + 25));
    }

    const activation = [
      env.DB.prepare(
        `UPDATE projects SET active_deployment_id = ?, updated_at = ? WHERE id = ?`,
      ).bind(deploymentId, now, project.id),
    ];
    if (options.tokenHash) {
      activation.push(
        env.DB.prepare(
          `UPDATE publish_tokens SET last_used_at = ? WHERE project_id = ? AND token_hash = ?`,
        ).bind(now, project.id, options.tokenHash),
      );
    }
    await env.DB.batch(activation);
  } catch (error) {
    await env.DB.prepare("DELETE FROM deployments WHERE id = ?").bind(deploymentId).run();
    await env.DOCS.delete(objectKey);
    throw error;
  }

  return {
    deploymentId,
    pages: bundle.pages.length,
    url: `${options.origin}/${project.slug}/${bundle.pages[0]?.slug ?? "introduction"}`,
  };
}
