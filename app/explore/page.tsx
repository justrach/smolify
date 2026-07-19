import Link from "next/link";
import type { Metadata } from "next";
import { getCloudflareContext } from "@opennextjs/cloudflare";
import { Brand } from "@/components/brand";
import { RepositoryBrowser } from "@/components/repository-browser";
import { listPublicProjects } from "@/lib/projects/access";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Explore repository documentation",
  description: "Search public, source-grounded repository documentation indexed for humans and coding agents.",
  alternates: { canonical: "/explore" },
  openGraph: {
    title: "Explore repository documentation · Smolify",
    description: "Search public, source-grounded repository documentation indexed for humans and coding agents.",
    url: "/explore",
    type: "website",
    images: [{ url: "/opengraph-image", width: 1200, height: 630 }],
  },
};

export default async function ExplorePage() {
  const { env } = await getCloudflareContext({ async: true });
  const projects = await listPublicProjects(env);

  return (
    <main className="explore-shell">
      <header><Brand /><nav><Link href="/dashboard">Import repository</Link></nav></header>
      <section className="explore-hero">
        <p className="eyebrow">Public repository docs</p>
        <h1>Find a repository.<br />Understand how it works.</h1>
        <p>Search existing source-grounded docs or paste a public GitHub URL to create another set.</p>
      </section>
      <RepositoryBrowser projects={projects} />
    </main>
  );
}
