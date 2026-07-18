import { getCloudflareContext } from "@opennextjs/cloudflare";
import { searchActiveDocs } from "@/lib/docs/search-repository";

type RouteContext = { params: Promise<{ project: string }> };

export async function GET(request: Request, { params }: RouteContext) {
  const query = new URL(request.url).searchParams.get("q")?.trim() ?? "";
  if (!query) return Response.json({ error: "Missing search query" }, { status: 400 });

  const requestedLimit = Number(new URL(request.url).searchParams.get("limit") ?? 8);
  const limit = Number.isFinite(requestedLimit)
    ? Math.min(20, Math.max(1, Math.trunc(requestedLimit)))
    : 8;
  const { project } = await params;
  const { env } = await getCloudflareContext({ async: true });

  return Response.json(await searchActiveDocs(env, project, query, limit));
}
