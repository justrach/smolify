"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { COMMUNITY_REVIEW_THRESHOLD, reviewTrustLabel, reviewTrustProgress } from "@/lib/trust/reviews";

export type RepositoryBrowserProject = {
  slug: string;
  name: string;
  description: string;
  sourceUrl: string | null;
  sourceFileCount: number;
  ratingAverage: number;
  ratingCount: number;
  verifiedRatingCount: number;
  acceptedImprovements: number;
  sourceOwnerLogin: string | null;
  sourceOwnerType: "Organization" | "User" | null;
  officialPublisherName: string | null;
  officialPublisherWebsite: string | null;
  officialPublisherGithubUrl: string | null;
};

function repositoryName(sourceUrl: string | null) {
  return sourceUrl?.replace(/^https:\/\/github\.com\//, "") ?? "Uploaded repository";
}

function githubUrl(value: string) {
  const trimmed = value.trim().replace(/\/$/, "");
  if (/^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/.test(trimmed)) return `https://github.com/${trimmed}`;
  try {
    const parsed = new URL(trimmed);
    const parts = parsed.pathname.split("/").filter(Boolean);
    if (parsed.protocol === "https:" && ["github.com", "www.github.com"].includes(parsed.hostname) && parts.length === 2) {
      return `https://github.com/${parts[0]}/${parts[1].replace(/\.git$/i, "")}`;
    }
  } catch {
    // Ordinary search text is not a URL.
  }
  return null;
}

export function RepositoryBrowser({ projects }: { projects: RepositoryBrowserProject[] }) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const normalized = query.trim().toLowerCase();
  const candidateUrl = githubUrl(query);
  const candidateName = candidateUrl?.replace("https://github.com/", "").toLowerCase() ?? null;
  const exactProject = projects.find((project) => {
    const sourceName = repositoryName(project.sourceUrl).toLowerCase();
    return normalized === project.slug.toLowerCase()
      || normalized === sourceName
      || candidateName === sourceName;
  });
  const visibleProjects = useMemo(() => {
    if (!normalized || candidateUrl) return projects;
    return projects.filter((project) => [
      project.name,
      project.slug,
      project.description,
      repositoryName(project.sourceUrl),
    ].some((value) => value.toLowerCase().includes(normalized)));
  }, [candidateUrl, normalized, projects]);

  const importHref = candidateUrl
    ? `/dashboard?import=${encodeURIComponent(candidateUrl)}`
    : "/dashboard";
  const resultLabel = normalized
    ? `${visibleProjects.length} ${visibleProjects.length === 1 ? "match" : "matches"}`
    : `${projects.length} indexed`;

  return (
    <section className="repository-browser" aria-label="Repository catalog">
      <div className="repository-search-shell">
        <form
          className="repository-search"
          onSubmit={(event) => {
            event.preventDefault();
            if (exactProject) router.push(`/${exactProject.slug}/introduction`);
            else if (candidateUrl) router.push(importHref);
          }}
        >
          <span aria-hidden="true">⌕</span>
          <input
            aria-label="Search repositories or paste a GitHub URL"
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search a repository name or paste its GitHub URL"
            value={query}
          />
          {exactProject || candidateUrl
            ? <button type="submit">{exactProject ? "Open docs" : "Import repo"}</button>
            : <span className="repository-result-count" aria-live="polite">{resultLabel}</span>}
        </form>
        <div className="repository-search-guide">
          <span><strong>Search text</strong> filters public docs instantly.</span>
          <span><strong>GitHub URL</strong> starts your own docs workspace.</span>
        </div>
      </div>

      <div className="repository-grid">
        <Link className="repository-card repository-add-card" href={importHref} prefetch={false}>
          <span className="repository-add-icon">+</span>
          <div><strong>{candidateUrl && !exactProject ? `Import ${candidateName}` : "Document your repository"}</strong><p>Import from GitHub or upload a private ZIP</p></div>
          <span className="repository-arrow" aria-hidden="true">→</span>
        </Link>
        {visibleProjects.map((project) => (
          <Link className="repository-card" href={`/${project.slug}/introduction`} key={project.slug} prefetch={false}>
            <div className="repository-card-copy">
              <span className="repository-owner">{repositoryName(project.sourceUrl)}</span>
              <div className="repository-title-line">
                <strong>{project.name}</strong>
                {project.officialPublisherName && (
                  <span
                    className="official-source-badge"
                    title={`Owned by the registered ${project.officialPublisherName} GitHub organization. Source provenance, not a security audit.`}
                  >✓ Official source</span>
                )}
              </div>
              <p>{project.description}</p>
            </div>
            <div className="repository-card-meta">
              <span>{project.sourceFileCount.toLocaleString()} files</span>
              <span
                className={project.verifiedRatingCount >= COMMUNITY_REVIEW_THRESHOLD ? "trust-reviewed" : "trust-unverified"}
                title={`${project.verifiedRatingCount} verified, independent agent reviews. Ratings from unverified accounts do not advance this status.`}
              >
                {reviewTrustLabel(project.verifiedRatingCount)} · {reviewTrustProgress(project.verifiedRatingCount)}
              </span>
              {project.ratingCount > 0 && <span>★ {Number(project.ratingAverage).toFixed(1)}</span>}
              {project.acceptedImprovements > 0 && <span>{project.acceptedImprovements} accepted</span>}
              <span className="repository-arrow" aria-hidden="true">→</span>
            </div>
          </Link>
        ))}
        {!visibleProjects.length && (
          <div className="repository-card repository-no-results">
            <strong>No indexed repository matches “{query.trim()}”.</strong>
            <p>Paste its GitHub URL above to add it to Smolify.</p>
          </div>
        )}
      </div>
    </section>
  );
}
