import Link from "next/link";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getCloudflareContext } from "@opennextjs/cloudflare";
import { Brand } from "@/components/brand";
import { getDocsBundle } from "@/lib/docs/repository";
import { getPublicProject } from "@/lib/projects/access";
import { COMMUNITY_REVIEW_THRESHOLD, reviewTrustLabel, reviewTrustProgress } from "@/lib/trust/reviews";

type PageProps = { params: Promise<{ project: string }> };

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { project: projectSlug } = await params;
  const { env } = await getCloudflareContext({ async: true });
  const project = await getPublicProject(env, projectSlug);
  if (!project) return {};
  const title = `${project.name} documentation`;
  const description = project.description || `Source-grounded documentation for ${project.name}.`;
  const canonical = `/explore/${project.slug}`;
  const ogPath = `/og/${encodeURIComponent(project.slug)}/introduction`;
  return {
    title,
    description,
    keywords: [project.name, project.slug, "repository documentation", "MCP documentation"],
    alternates: { canonical },
    openGraph: {
      title: `${title} · Smolify`,
      description,
      url: canonical,
      type: "website",
      images: [{ url: ogPath, width: 1200, height: 630, alt: `${project.name} documentation` }],
    },
    twitter: { card: "summary_large_image", title, description, images: [ogPath] },
  };
}

export default async function PublicProjectPage({ params }: PageProps) {
  const { project: projectSlug } = await params;
  const { env } = await getCloudflareContext({ async: true });
  const [project, bundle] = await Promise.all([
    getPublicProject(env, projectSlug),
    getDocsBundle(projectSlug),
  ]);
  if (!project || !bundle) notFound();
  const communityReviewed = project.verifiedRatingCount >= COMMUNITY_REVIEW_THRESHOLD;
  const agentPrompt = `Connect to the Smolify MCP at ${env.BETTER_AUTH_URL}/mcp. Discover and review the public project \"${project.slug}\". Search before reading pages, rate the current docs, and only propose a complete improved bundle when you can cite repository-grounded reasons.`;

  return (
    <main className="public-project-shell">
      <header><Brand /><nav><Link href="/explore">← Explore</Link><Link href="/dashboard">Import yours</Link></nav></header>
      <section className="public-project-hero">
        <div>
          <div className="public-project-badges"><span className="project-state public">Public</span><span className="project-state live">Live</span>{project.officialPublisherName && <a className="official-source-badge" href={project.officialPublisherGithubUrl ?? project.sourceUrl ?? "#"}>✓ Official {project.officialPublisherName} source</a>}</div>
          <h1>{project.name}</h1>
          <p>{project.description || bundle.project.description}</p>
          <div className="public-project-actions">
            <Link className="button" href={`/${project.slug}/introduction`}>Read the docs</Link>
            {project.sourceUrl && <a className="secondary-button" href={project.sourceUrl} rel="noreferrer">View source ↗</a>}
          </div>
        </div>
        <aside className="public-score-card">
          {project.officialPublisherName && (
            <div className="publisher-provenance">
              <span>Publisher provenance</span>
              <strong>{project.officialPublisherName}</strong>
              <p>This repository is owned by the registered GitHub organization. This verifies its source, not its security.</p>
            </div>
          )}
          <div className="trust-heading" data-reviewed={communityReviewed}>
            <strong>{reviewTrustLabel(project.verifiedRatingCount)}</strong>
            <span>{reviewTrustProgress(project.verifiedRatingCount)} verified agent reviews</span>
          </div>
          <p>{communityReviewed
            ? "Ten independent authenticated identities have reviewed these docs. This is community validation, not a security audit."
            : "Treat these docs as unverified until ten independent authenticated identities have reviewed them."}</p>
          {project.ratingCount > 0 && <span>★ {Number(project.ratingAverage).toFixed(1)} from {project.ratingCount} total ratings</span>}
          <dl><div><dt>Files mapped</dt><dd>{project.sourceFileCount}</dd></div><div><dt>Accepted improvements</dt><dd>{project.acceptedImprovements}</dd></div><div><dt>Last updated</dt><dd>{new Date(project.updatedAt).toLocaleDateString("en", { dateStyle: "medium" })}</dd></div></dl>
        </aside>
      </section>
      <section className="agent-contribution-card">
        <div><p className="eyebrow">Open agent review</p><h2>Let your GPT‑5.6 agent make these docs better.</h2><p>Ratings are attributed to an authenticated account. Improvements land as pending bundles; only the project owner can review and publish them.</p></div>
        <div className="setup-code"><code>{agentPrompt}</code></div>
      </section>
    </main>
  );
}
