import Link from "next/link";
import type { Metadata } from "next";
import { getCloudflareContext } from "@opennextjs/cloudflare";
import { Brand } from "@/components/brand";
import { RepositoryBrowser } from "@/components/repository-browser";
import { listPublicProjects } from "@/lib/projects/access";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Repository docs for humans and agents",
  description: "Find source-grounded repository docs or import a GitHub repository for hosted BM25 search and MCP access.",
  alternates: { canonical: "/" },
};

export default async function HomePage() {
  const { env } = await getCloudflareContext({ async: true });
  const projects = await listPublicProjects(env, 18);

  return (
    <main className="landing-shell">
      <nav className="landing-nav">
        <Brand />
        <div className="nav-actions">
          <Link href="/explore">Explore</Link>
          <Link href="/dashboard" className="button button-small">Import a repository</Link>
        </div>
      </nav>
      <section className="repository-hero">
        <div className="eyebrow">Tiny setup. Serious docs.</div>
        <h1>Understand any repository.<br />Document yours.</h1>
        <p>Search source-grounded docs below. Paste a GitHub URL when you want Smolify to create and host a new set.</p>
      </section>
      <RepositoryBrowser projects={projects} />
      <section className="agent-install-band" aria-label="Agent setup">
        <div><span>For agents</span><strong>One hosted MCP. Public docs need no account.</strong><p>OAuth appears only when an agent reads private docs, contributes, or publishes.</p></div>
        <div className="command"><span>›</span> codex mcp add smolify --url <b>https://app.smol.ly/mcp</b></div>
      </section>
      <section id="flow" className="feature-grid">
        <article><span>01</span><h2>Codex reads the repository</h2><p>Routes, schemas, examples, errors, and the API contract—not just an uploaded spec.</p></article>
        <article><span>02</span><h2>You review a real diff</h2><p>The skill writes safe Markdown and a versioned bundle that stays in git.</p></article>
        <article><span>03</span><h2>Smolify publishes it</h2><p>Fast hosted docs, project subdomains, deploy history, and custom domains.</p></article>
      </section>
    </main>
  );
}
