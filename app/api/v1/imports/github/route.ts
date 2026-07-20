import { getCloudflareContext } from "@opennextjs/cloudflare";
import { z } from "zod";
import { createAuth } from "@/lib/auth";
import { docsBundleSchema } from "@/lib/docs/schema";
import { buildRepositoryBundle, fetchGithubSnapshot, parseGithubRepositoryUrl } from "@/lib/imports/repository";
import { publishDocsDeployment } from "@/lib/docs/deployments";
import { createProjectForUser, uniqueProjectSlug } from "@/lib/projects/service";
import { githubAccessTokenForUser } from "@/lib/github/access";

const importSchema = z.object({
  url: z.string().url().max(500),
  visibility: z.enum(["public", "private"]).default("public"),
});

export async function POST(request: Request) {
  const auth = await createAuth(request);
  const session = await auth.api.getSession({ headers: request.headers });
  if (!session) return Response.json({ error: "Authentication required" }, { status: 401 });

  const parsed = importSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: "Enter a valid GitHub repository URL" }, { status: 422 });

  try {
    const { env } = await getCloudflareContext({ async: true });
    const github = parseGithubRepositoryUrl(parsed.data.url);
    const accessToken = await githubAccessTokenForUser(env, session.user.id);
    const snapshot = await fetchGithubSnapshot(github.url, accessToken);
    const bundle = docsBundleSchema.parse(buildRepositoryBundle(snapshot));
    const slug = await uniqueProjectSlug(env, snapshot.name);
    const project = await createProjectForUser(env, session.user, {
      name: snapshot.name,
      slug,
      visibility: parsed.data.visibility,
      sourceType: "github",
      sourceUrl: snapshot.sourceUrl,
      sourceRevision: snapshot.revision,
      sourceCommit: snapshot.sourceCommit,
      sourceRetention: snapshot.sourceRetention,
      sourceFileCount: snapshot.totalFiles,
      importedAt: bundle.generatedAt,
      sourceOwnerGithubId: snapshot.sourceOwner?.githubId,
      sourceOwnerLogin: snapshot.sourceOwner?.login,
      sourceOwnerType: snapshot.sourceOwner?.type,
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
    const message = error instanceof Error ? error.message : "Unable to import repository";
    const expected = /repository|github|rate limit|private/i.test(message);
    if (!expected) console.error("GitHub import failed", error);
    return Response.json({ error: message }, { status: expected ? 422 : 500 });
  }
}
