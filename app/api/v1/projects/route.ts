import { getCloudflareContext } from "@opennextjs/cloudflare";
import { z } from "zod";
import { createAuth } from "@/lib/auth";
import { listAccessibleProjects } from "@/lib/projects/access";
import { createProjectForUser } from "@/lib/projects/service";

const createProjectSchema = z.object({
  name: z.string().trim().min(2).max(80),
  slug: z
    .string()
    .trim()
    .toLowerCase()
    .min(2)
    .max(60)
    .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),
  visibility: z.enum(["public", "private"]).default("public"),
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
  try {
    const project = await createProjectForUser(env, session.user, parsed.data);
    return Response.json(project, { status: 201 });
  } catch (error) {
    if (String(error).includes("UNIQUE")) {
      return Response.json({ error: "That project slug is already taken" }, { status: 409 });
    }
    console.error("Failed to create project", error);
    throw error;
  }

}
