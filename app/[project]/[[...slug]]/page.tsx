import type { Metadata } from "next";
import Link from "next/link";
import { headers } from "next/headers";
import { notFound, redirect } from "next/navigation";
import { getCloudflareContext } from "@opennextjs/cloudflare";
import { renderMarkdown } from "@/lib/docs/markdown";
import { getDocsBundle } from "@/lib/docs/repository";
import { BrandMark } from "@/components/brand";
import { createAuth } from "@/lib/auth";
import { getAccessibleProject } from "@/lib/projects/access";
import { COMMUNITY_REVIEW_THRESHOLD, reviewTrustLabel, reviewTrustProgress } from "@/lib/trust/reviews";

type PageProps = {
  params: Promise<{ project: string; slug?: string[] }>;
};

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { project, slug } = await params;
  const currentSlug = slug?.join("/") || "introduction";
  let projectName = project;
  let sourceUrl: string | null = null;
  let updatedAt: string | null = null;
  if (project !== "pawprint") {
    const { env } = await getCloudflareContext({ async: true });
    const record = await env.DB.prepare(
      "SELECT visibility, name, source_url AS sourceUrl, updated_at AS updatedAt FROM projects WHERE slug = ? AND deleted_at IS NULL",
    ).bind(project).first<{ visibility: "public" | "private"; name: string; sourceUrl: string | null; updatedAt: string }>();
    if (record?.visibility === "private") {
      return { title: "Private documentation", robots: { index: false, follow: false } };
    }
    projectName = record?.name ?? project;
    sourceUrl = record?.sourceUrl ?? null;
    updatedAt = record?.updatedAt ?? null;
  }
  const bundle = await getDocsBundle(project);
  const page = bundle?.pages.find((item) => item.slug === currentSlug);
  if (!page) return {};
  const canonical = `/${project}/${currentSlug}`;
  const ogPath = `/og/${encodeURIComponent(project)}/${currentSlug.split("/").map(encodeURIComponent).join("/")}`;
  const title = `${page.title} — ${projectName}`;
  return {
    title,
    description: page.description,
    keywords: [projectName, page.title, "repository documentation", "developer documentation", ...page.sourceFiles.slice(0, 4)],
    alternates: { canonical },
    robots: { index: true, follow: true },
    openGraph: {
      title: `${title} · Smolify`,
      description: page.description,
      url: canonical,
      type: "article",
      modifiedTime: updatedAt ?? undefined,
      images: [{ url: ogPath, width: 1200, height: 630, alt: `${page.title} — ${projectName}` }],
    },
    twitter: { card: "summary_large_image", title, description: page.description, images: [ogPath] },
    other: sourceUrl ? { "code-repository": sourceUrl } : undefined,
  };
}

export default async function DocsPage({ params }: PageProps) {
  const { project, slug } = await params;
  let sourceUrl: string | null = null;
  let visibility: "public" | "private" = "public";
  let ratingAverage = 0;
  let ratingCount = 0;
  let verifiedRatingCount = 0;
  let officialPublisherName: string | null = null;
  let officialPublisherWebsite: string | null = null;
  let officialPublisherGithubUrl: string | null = null;
  if (project !== "pawprint") {
    const { env } = await getCloudflareContext({ async: true });
    const record = await env.DB.prepare(
      `SELECT projects.visibility, projects.source_url AS sourceUrl,
         official_publishers.display_name AS officialPublisherName,
         official_publishers.website_url AS officialPublisherWebsite,
         official_publishers.github_url AS officialPublisherGithubUrl,
         COALESCE(AVG(doc_ratings.score), 0) AS ratingAverage,
         COUNT(doc_ratings.id) AS ratingCount,
         (SELECT COUNT(*) FROM doc_ratings verified_ratings
          WHERE verified_ratings.project_id = projects.id
            AND verified_ratings.identity_assurance IN ('verified_email', 'github')) AS verifiedRatingCount
       FROM projects
       LEFT JOIN github_official_publishers official_publishers
         ON official_publishers.github_owner_id = projects.source_owner_github_id
       LEFT JOIN doc_ratings ON doc_ratings.project_id = projects.id
       WHERE projects.slug = ? AND projects.deleted_at IS NULL
       GROUP BY projects.id`,
    ).bind(project).first<{
      visibility: "public" | "private";
      sourceUrl: string | null;
      ratingAverage: number;
      ratingCount: number;
      verifiedRatingCount: number;
      officialPublisherName: string | null;
      officialPublisherWebsite: string | null;
      officialPublisherGithubUrl: string | null;
    }>();
    if (!record) notFound();
    ({ visibility, sourceUrl, ratingAverage, ratingCount, verifiedRatingCount, officialPublisherName, officialPublisherWebsite, officialPublisherGithubUrl } = record);
    if (visibility === "private") {
      const requestHeaders = await headers();
      const host = requestHeaders.get("host") ?? new URL(env.BETTER_AUTH_URL).host;
      const protocol = requestHeaders.get("x-forwarded-proto")
        ?? (host.startsWith("localhost") || host.startsWith("127.0.0.1") ? "http" : "https");
      const auth = await createAuth(new Request(`${protocol}://${host}/${project}`, { headers: requestHeaders }));
      const session = await auth.api.getSession({ headers: requestHeaders });
      const returnTo = `/${project}/${slug?.join("/") || "introduction"}`;
      if (!session) redirect(`${env.BETTER_AUTH_URL}/login?returnTo=${encodeURIComponent(returnTo)}`);
      if (!await getAccessibleProject(env, session.user.id, project)) notFound();
    }
  }
  const bundle = await getDocsBundle(project);
  if (!bundle) notFound();

  const currentSlug = slug?.join("/") || "introduction";
  const page = bundle.pages.find((item) => item.slug === currentSlug);
  if (!page) notFound();
  const rendered = await renderMarkdown(page.markdown);
  const canonicalUrl = `https://app.smol.ly/${project}/${currentSlug}`;
  const structuredData = JSON.stringify({
    "@context": "https://schema.org",
    "@type": "TechArticle",
    headline: page.title,
    description: page.description,
    url: canonicalUrl,
    isPartOf: { "@type": "WebSite", name: "Smolify", url: "https://app.smol.ly" },
    about: bundle.project.name,
    ...(sourceUrl ? { codeRepository: sourceUrl } : {}),
    ...(officialPublisherName ? { publisher: { "@type": "Organization", name: officialPublisherName, url: officialPublisherWebsite } } : {}),
  }).replace(/</g, "\\u003c");

  return (
    <div className="docs-shell" style={{ "--accent": bundle.project.accent } as React.CSSProperties}>
      <script dangerouslySetInnerHTML={{ __html: structuredData }} type="application/ld+json" />
      <header className="docs-header">
        <Link href={`/${project}/introduction`} className="docs-brand"><span>{bundle.project.name.slice(0, 1)}</span>{bundle.project.name}</Link>
        <div className="docs-search"><kbd>⌘ K</kbd><span>Search documentation</span></div>
        {sourceUrl
          ? <a className="github-link" href={sourceUrl} rel="noreferrer">Source ↗</a>
          : <span className="github-link">{visibility === "private" ? "Private repository" : "Generated docs"}</span>}
      </header>
      <aside className="docs-sidebar">
        <p className="powered-by"><BrandMark compact />Hosted by Smolify · {visibility}</p>
        {visibility === "public" && (
          <>
            {officialPublisherName && <a className="docs-official-source" href={officialPublisherGithubUrl ?? sourceUrl ?? "#"}><strong>✓ Official {officialPublisherName} source</strong><span>Verified repository ownership · not a security audit</span></a>}
            <p className="community-trust" data-reviewed={verifiedRatingCount >= COMMUNITY_REVIEW_THRESHOLD}>
              <strong>{reviewTrustLabel(verifiedRatingCount)}</strong>
              <span>{reviewTrustProgress(verifiedRatingCount)} verified reviews</span>
            </p>
          </>
        )}
        {visibility === "public" && ratingCount > 0 && <p className="community-score">★ {Number(ratingAverage).toFixed(1)} from {ratingCount} agent {ratingCount === 1 ? "rating" : "ratings"}</p>}
        {bundle.navigation.map((group) => (
          <nav key={group.label}>
            <h2>{group.label}</h2>
            {group.items.map((item) => (
              <Link key={item.slug} href={`/${project}/${item.slug}`} data-active={item.slug === currentSlug}>{item.label}</Link>
            ))}
          </nav>
        ))}
      </aside>
      <main className="docs-main">
        <div className="page-kicker">{page.description}</div>
        <article className="prose" dangerouslySetInnerHTML={{ __html: rendered.html }} />
        <footer className="source-note">Generated by {bundle.generator.name} with {bundle.generator.model} · {page.sourceFiles.length} source {page.sourceFiles.length === 1 ? "file" : "files"}</footer>
      </main>
      <aside className="docs-toc">
        <h2>On this page</h2>
        {rendered.tableOfContents.map((item) => <a key={item.id} href={`#${item.id}`} data-depth={item.depth}>{item.label}</a>)}
      </aside>
    </div>
  );
}
