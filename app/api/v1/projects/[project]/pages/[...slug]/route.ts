import { getCloudflareContext } from "@opennextjs/cloudflare";
import { getActiveDocPage } from "@/lib/docs/search-repository";

type RouteContext = { params: Promise<{ project: string; slug: string[] }> };

export async function GET(request: Request, { params }: RouteContext) {
  const { project, slug } = await params;
  const url = new URL(request.url);
  const offset = Math.max(0, Number.parseInt(url.searchParams.get("offset") ?? "0", 10) || 0);
  const requestedLength = Number.parseInt(url.searchParams.get("length") ?? "12000", 10) || 12000;
  const length = Math.min(40_000, Math.max(1_000, requestedLength));
  const { env } = await getCloudflareContext({ async: true });

  const page = await getActiveDocPage(env, project, slug.join("/"), offset, length);

  if (!page) return Response.json({ error: "Page not found" }, { status: 404 });
  return Response.json({ ...page, offset, length });
}
