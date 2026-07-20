import { getCloudflareContext } from "@opennextjs/cloudflare";
import { createAuth } from "@/lib/auth";
import { docsBundleSchema } from "@/lib/docs/schema";
import { buildRepositoryBundle, snapshotFromZip } from "@/lib/imports/repository";
import { publishDocsDeployment } from "@/lib/docs/deployments";
import { createProjectForUser, uniqueProjectSlug } from "@/lib/projects/service";

export async function POST(request: Request) {
  const auth = await createAuth(request);
  const session = await auth.api.getSession({ headers: request.headers });
  if (!session) return Response.json({ error: "Authentication required" }, { status: 401 });

  try {
    const form = await request.formData();
    const repository = form.get("repository");
    const visibility = form.get("visibility") === "public" ? "public" : "private";
    if (!repository || typeof repository === "string" || !("arrayBuffer" in repository)) {
      return Response.json({ error: "Choose a repository ZIP" }, { status: 422 });
    }
    const filename = "name" in repository && typeof repository.name === "string"
      ? repository.name
      : "repository.zip";
    if (!filename.toLowerCase().endsWith(".zip")) {
      return Response.json({ error: "Repository uploads must be ZIP files" }, { status: 422 });
    }
    const snapshot = snapshotFromZip(new Uint8Array(await repository.arrayBuffer()), filename);
    const bundle = docsBundleSchema.parse(buildRepositoryBundle(snapshot));
    const { env } = await getCloudflareContext({ async: true });
    const slug = await uniqueProjectSlug(env, snapshot.name);
    const project = await createProjectForUser(env, session.user, {
      name: snapshot.name,
      slug,
      visibility,
      sourceType: "archive",
      sourceUrl: null,
      sourceRevision: snapshot.revision,
      sourceCommit: snapshot.sourceCommit,
      sourceRetention: snapshot.sourceRetention,
      sourceFileCount: snapshot.totalFiles,
      importedAt: bundle.generatedAt,
    });
    try {
      const deployment = await publishDocsDeployment(env, project, bundle, {
        origin: new URL(request.url).origin,
      });
      return Response.json({ project, deployment }, { status: 201 });
    } catch (error) {
      await env.DB.prepare("DELETE FROM projects WHERE id = ?").bind(project.id).run();
      throw error;
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to import repository ZIP";
    const expected = /zip|archive|files|repository|safety limit|supported/i.test(message);
    if (!expected) console.error("Archive import failed", error);
    return Response.json({ error: message }, { status: expected ? 422 : 500 });
  }
}
