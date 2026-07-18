import Link from "next/link";
import { Brand } from "@/components/brand";

export default function HomePage() {
  return (
    <main className="landing-shell">
      <nav className="landing-nav">
        <Brand />
        <div className="nav-actions">
          <Link href="/pawprint/introduction">Demo docs</Link>
          <Link href="/dashboard" className="button button-small">Open dashboard</Link>
        </div>
      </nav>
      <section className="hero">
        <div className="eyebrow">Tiny setup. Serious docs.</div>
        <h1>Your code knows the truth.<br /><span>Codex writes the docs.</span></h1>
        <p>Connect one MCP and one repository skill. Codex turns your API contract and implementation into reviewable Markdown; Smolify publishes it at a very good URL.</p>
        <div className="hero-actions">
          <Link href="/pawprint/introduction" className="button">Explore generated docs</Link>
          <a href="#flow" className="text-link">See how it works <span>→</span></a>
        </div>
        <div className="command"><span>›</span> codex <b>“Use $smolify-api-docs to document this API”</b></div>
      </section>
      <section id="flow" className="feature-grid">
        <article><span>01</span><h2>Codex reads the repository</h2><p>Routes, schemas, examples, errors, and the API contract—not just an uploaded spec.</p></article>
        <article><span>02</span><h2>You review a real diff</h2><p>The skill writes safe Markdown and a versioned bundle that stays in git.</p></article>
        <article><span>03</span><h2>Smolify publishes it</h2><p>Fast hosted docs, project subdomains, deploy history, and custom domains.</p></article>
      </section>
    </main>
  );
}
