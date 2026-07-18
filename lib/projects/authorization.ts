import { createAuth } from "@/lib/auth";
import { verifyMcpAccessToken } from "@/lib/mcp/auth";
import { getReadableProject } from "./access";

export async function requestUserId(request: Request, env: CloudflareEnv) {
  const auth = await createAuth(request);
  const session = await auth.api.getSession({ headers: request.headers });
  if (session) return session.user.id;

  const authorization = request.headers.get("authorization");
  if (!authorization?.startsWith("Bearer ")) return null;
  try {
    const origin = new URL(request.url).origin;
    const principal = await verifyMcpAccessToken(env, authorization.slice(7), origin);
    return principal.scopes.has("docs:read") ? principal.userId : null;
  } catch {
    return null;
  }
}

export async function authorizeProjectRead(
  request: Request,
  env: CloudflareEnv,
  projectSlug: string,
) {
  const userId = await requestUserId(request, env);
  return getReadableProject(env, userId, projectSlug);
}
