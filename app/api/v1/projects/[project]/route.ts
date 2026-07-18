import { getCloudflareContext } from "@opennextjs/cloudflare";
import { z } from "zod";
import { createAuth } from "@/lib/auth";
import { getAccessibleProject } from "@/lib/projects/access";

type RouteContext = { params: Promise<{ project: string }> };
const updateSchema = z.object({ visibility: z.enum(["public", "private"]) });

export async function PATCH(request: Request, { params }: RouteContext) {
  const auth = await createAuth(request);
  const session = await auth.api.getSession({ headers: request.headers });
  if (!session) return Response.json({ error: "Authentication required" }, { status: 401 });
  const parsed = updateSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: "Invalid project visibility" }, { status: 422 });
  const { project: slug } = await params;
  const { env } = await getCloudflareContext({ async: true });
  const project = await getAccessibleProject(env, session.user.id, slug);
  if (!project || !["owner", "admin"].includes(project.role)) {
    return Response.json({ error: "Project not found" }, { status: 404 });
  }
  await env.DB.prepare(
    "UPDATE projects SET visibility = ?, updated_at = ? WHERE id = ?",
  ).bind(parsed.data.visibility, new Date().toISOString(), project.id).run();
  return Response.json({ slug, visibility: parsed.data.visibility });
}
