import { ImageResponse } from "next/og";
import { getCloudflareContext } from "@opennextjs/cloudflare";
import { SmolifyOpenGraphCard } from "@/lib/seo/opengraph";
import { getDocsBundle } from "@/lib/docs/repository";
import { getPublicProject } from "@/lib/projects/access";

type RouteContext = {
  params: Promise<{ project: string; slug: string[] }>;
};

const imageSize = { width: 1200, height: 630 };

function truncate(value: string, length: number) {
  return value.length > length ? `${value.slice(0, length - 1).trim()}…` : value;
}

export async function GET(_request: Request, { params }: RouteContext) {
  const { project, slug } = await params;
  const pageSlug = slug.join("/");
  const { env } = await getCloudflareContext({ async: true });
  const [publicProject, bundle] = await Promise.all([
    project === "pawprint" ? Promise.resolve(null) : getPublicProject(env, project),
    getDocsBundle(project),
  ]);
  if (!bundle || (project !== "pawprint" && !publicProject)) {
    return new Response("Open Graph image not found", { status: 404 });
  }
  const page = bundle.pages.find((candidate) => candidate.slug === pageSlug);
  if (!page) return new Response("Open Graph image not found", { status: 404 });

  const publisher = publicProject?.officialPublisherName;
  const sourceCount = page.sourceFiles.length;
  const sourceLabel = sourceCount
    ? `${sourceCount} source ${sourceCount === 1 ? "file" : "files"}`
    : "Source-grounded docs";
  const path = `app.smol.ly/${project}/${page.slug}`;

  return new ImageResponse(
    <SmolifyOpenGraphCard
      badge={publisher ? `Official ${publisher} source · ${sourceLabel}` : sourceLabel}
      description={truncate(page.description, 170)}
      eyebrow={page.slug === "introduction" ? "Get started" : bundle.project.name}
      path={path.length > 58 ? `app.smol.ly/${project}/…/${page.slug.split("/").at(-1)}` : path}
      project={bundle.project.name}
      title={truncate(page.title, 92)}
    />,
    imageSize,
  );
}
