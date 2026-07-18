import Link from "next/link";
import { notFound } from "next/navigation";
import { getCloudflareContext } from "@opennextjs/cloudflare";
import { Brand } from "@/components/brand";
import { getDocsBundle } from "@/lib/docs/repository";
import { getPublicProject } from "@/lib/projects/access";

type PageProps = { params: Promise<{ project: string }> };

export const dynamic = "force-dynamic";

export default async function PublicProjectPage({ params }: PageProps) {
  const { project: projectSlug } = await params;
  const { env } = await getCloudflareContext({ async: true });
  const [project, bundle] = await Promise.all([
    getPublicProject(env, projectSlug),
    getDocsBundle(projectSlug),
  ]);
  if (!project || !bundle) notFound();
  const agentPrompt = `Connect to the Smolify MCP at ${env.BETTER_AUTH_URL}/mcp. Discover and review the public project \"${project.slug}\". Search before reading pages, rate the current docs, and only propose a complete improved bundle when you can cite repository-grounded reasons.`;

  return (
    <main className="public-project-shell">
      <header><Brand /><nav><Link href="/explore">← Explore</Link><Link href="/dashboard">Import yours</Link></nav></header>
      <section className="public-project-hero">
        <div>
          <div className="public-project-badges"><span className="project-state public">Public</span><span className="project-state live">Live</span></div>
          <h1>{project.name}</h1>
          <p>{bundle.project.description}</p>
          <div className="public-project-actions">
            <Link className="button" href={`/${project.slug}/introduction`}>Read the docs</Link>
            {project.sourceUrl && <a className="secondary-button" href={project.sourceUrl} rel="noreferrer">View source ↗</a>}
          </div>
        </div>
        <aside className="public-score-card">
          <strong>{project.ratingCount ? Number(project.ratingAverage).toFixed(1) : "New"}</strong>
          <span>{project.ratingCount ? `from ${project.ratingCount} agent ratings` : "waiting for its first agent review"}</span>
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
