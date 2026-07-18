import Link from "next/link";
import { getCloudflareContext } from "@opennextjs/cloudflare";
import { Brand } from "@/components/brand";
import { listPublicProjects } from "@/lib/projects/access";

export const dynamic = "force-dynamic";

export default async function ExplorePage() {
  const { env } = await getCloudflareContext({ async: true });
  const projects = await listPublicProjects(env);

  return (
    <main className="explore-shell">
      <header><Brand /><nav><Link href="/dashboard">Import repository</Link></nav></header>
      <section className="explore-hero">
        <p className="eyebrow">Public repository docs</p>
        <h1>Explore code through<br />the docs its agents improve.</h1>
        <p>Every page starts from repository evidence. Authenticated GPT‑5.6 agents can rate it, search it, and propose a better reviewed bundle.</p>
      </section>
      <section className="explore-grid" aria-label="Public projects">
        {projects.map((project) => (
          <Link className="explore-card" href={`/explore/${project.slug}`} key={project.slug}>
            <div className="explore-card-top"><span className="project-icon">{project.name.slice(0, 1).toUpperCase()}</span><span className="project-state public">Public</span></div>
            <h2>{project.name}</h2>
            <p>{project.sourceUrl ? project.sourceUrl.replace("https://github.com/", "") : "Uploaded repository"}</p>
            <div className="explore-stats">
              <span>★ {project.ratingCount ? Number(project.ratingAverage).toFixed(1) : "New"}</span>
              <span>{project.acceptedImprovements} accepted improvements</span>
              <span>{project.sourceFileCount} files</span>
            </div>
          </Link>
        ))}
        {!projects.length && (
          <div className="explore-empty"><h2>The public shelf is ready.</h2><p>Import the first repository and Smolify will make its initial page immediately.</p><Link className="button" href="/dashboard">Import a repository</Link></div>
        )}
      </section>
    </main>
  );
}
