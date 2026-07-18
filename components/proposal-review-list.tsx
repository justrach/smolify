"use client";

import { useState } from "react";

type Proposal = {
  id: string;
  model: string;
  summary: string;
  rationale: string;
  createdAt: string;
  authorName: string;
};

type Preview = {
  bundleHash: string;
  bundle: {
    generatedAt: string;
    pages: Array<{ slug: string; title: string; markdown: string; sourceFiles: string[] }>;
  };
};

export function ProposalReviewList({ project, proposals }: { project: string; proposals: Proposal[] }) {
  const [previews, setPreviews] = useState<Record<string, Preview>>({});
  const [pending, setPending] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  if (!proposals.length) return null;

  async function loadPreview(proposalId: string) {
    setPending(proposalId);
    setError(null);
    const response = await fetch(`/api/v1/projects/${project}/proposals/${proposalId}`);
    const payload = await response.json() as Preview & { error?: string };
    setPending(null);
    if (!response.ok) {
      setError(payload.error ?? "Unable to load proposal");
      return;
    }
    setPreviews((current) => ({ ...current, [proposalId]: payload }));
  }

  async function decide(proposalId: string, decision: "accept" | "reject") {
    setPending(proposalId);
    setError(null);
    const response = await fetch(`/api/v1/projects/${project}/proposals/${proposalId}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ decision, bundleHash: previews[proposalId]?.bundleHash }),
    });
    const payload = await response.json() as { error?: string };
    if (!response.ok) {
      setPending(null);
      setError(payload.error ?? "Unable to review proposal");
      return;
    }
    window.location.reload();
  }

  return (
    <section className="proposal-inbox" aria-labelledby="proposal-heading">
      <div><p className="eyebrow">Agent inbox</p><h2 id="proposal-heading">Review proposed improvements</h2><p>Nothing here can publish itself. Preview the full replacement bundle before accepting it.</p></div>
      {error && <p className="form-error">{error}</p>}
      <div className="proposal-list">
        {proposals.map((proposal) => {
          const preview = previews[proposal.id];
          return (
            <article className="proposal-card" key={proposal.id}>
              <div className="proposal-meta"><span>{proposal.model}</span><span>{proposal.authorName}</span><time>{new Date(proposal.createdAt).toLocaleDateString()}</time></div>
              <h3>{proposal.summary}</h3>
              <p>{proposal.rationale}</p>
              {!preview ? (
                <button className="secondary-button" disabled={pending === proposal.id} onClick={() => loadPreview(proposal.id)}>{pending === proposal.id ? "Loading bundle…" : "Preview complete bundle"}</button>
              ) : (
                <div className="proposal-preview">
                  <strong>{preview.bundle.pages.length} proposed pages · generated {new Date(preview.bundle.generatedAt).toLocaleString()}</strong>
                  {preview.bundle.pages.map((page) => (
                    <details key={page.slug}>
                      <summary>{page.title} <code>{page.slug}</code></summary>
                      <p>{page.sourceFiles.length} supporting source files</p>
                      <pre>{page.markdown}</pre>
                    </details>
                  ))}
                </div>
              )}
              <div className="proposal-actions">
                <button className="mode-switch" disabled={pending === proposal.id} onClick={() => decide(proposal.id, "reject")}>Reject</button>
                <button className="button" disabled={!preview || pending === proposal.id} onClick={() => decide(proposal.id, "accept")}>Accept and publish</button>
              </div>
            </article>
          );
        })}
      </div>
    </section>
  );
}
