"use client";

import { useState } from "react";

type Visibility = "public" | "private";
type ImportMode = "github" | "archive";

export function ImportRepositoryForm({ initialOpen = false, initialUrl = "" }: { initialOpen?: boolean; initialUrl?: string }) {
  const [open, setOpen] = useState(initialOpen);
  const [mode, setMode] = useState<ImportMode>("github");
  const [visibility, setVisibility] = useState<Visibility>("public");
  const [url, setUrl] = useState(initialUrl);
  const [archive, setArchive] = useState<File | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  if (!open) {
    return <button className="button import-trigger" onClick={() => setOpen(true)}>Import a repository</button>;
  }

  return (
    <form
      className="import-form"
      onSubmit={async (event) => {
        event.preventDefault();
        setPending(true);
        setError(null);
        const response = mode === "github"
          ? await fetch("/api/v1/imports/github", {
              method: "POST",
              headers: { "content-type": "application/json" },
              body: JSON.stringify({ url, visibility }),
            })
          : await (async () => {
              const form = new FormData();
              if (archive) form.set("repository", archive);
              form.set("visibility", visibility);
              return fetch("/api/v1/imports/archive", { method: "POST", body: form });
            })();
        const payload = (await response.json().catch(() => null)) as
          | { error?: string; project?: { slug: string; visibility: Visibility } }
          | null;
        if (!response.ok || !payload?.project) {
          setPending(false);
          setError(payload?.error ?? "Unable to import this repository");
          return;
        }
        window.location.assign(
          `/dashboard?project=${encodeURIComponent(payload.project.slug)}&imported=1#setup`,
        );
      }}
    >
      <div className="import-form-heading">
        <div><strong>Import repository</strong><span>Instant docs scaffold; no API key.</span></div>
        <button className="domain-close" type="button" onClick={() => setOpen(false)}>Close</button>
      </div>
      <div className="import-tabs" role="tablist" aria-label="Repository source">
        <button aria-selected={mode === "github"} data-active={mode === "github"} onClick={() => setMode("github")} role="tab" type="button">GitHub URL</button>
        <button aria-selected={mode === "archive"} data-active={mode === "archive"} onClick={() => { setMode("archive"); setVisibility("private"); }} role="tab" type="button">Upload ZIP</button>
      </div>
      {mode === "github" ? (
        <label className="import-field">GitHub repository URL
          <input required type="url" placeholder="https://github.com/owner/repository" value={url} onChange={(event) => setUrl(event.target.value)} />
          <small>Public repositories work immediately. Connect GitHub to use your account quota or import a private repository.</small>
        </label>
      ) : (
        <label className="import-field">Repository ZIP
          <input required accept=".zip,application/zip" type="file" onChange={(event) => setArchive(event.target.files?.[0] ?? null)} />
          <small>Private by default. Source files are analyzed in memory; only the generated docs bundle is retained.</small>
        </label>
      )}
      <fieldset className="visibility-picker">
        <legend>Who can view the generated page?</legend>
        <label data-active={visibility === "public"}>
          <input checked={visibility === "public"} name="visibility" onChange={() => setVisibility("public")} type="radio" />
          <span><strong>Public</strong><small>Listed in Explore and open to agent ratings and proposals.</small></span>
        </label>
        <label data-active={visibility === "private"}>
          <input checked={visibility === "private"} name="visibility" onChange={() => setVisibility("private")} type="radio" />
          <span><strong>Private</strong><small>Only workspace members can view or search it.</small></span>
        </label>
      </fieldset>
      {error && <p className="form-error">{error}</p>}
      <button className="button" disabled={pending || (mode === "archive" && !archive)}>
        {pending ? "Reading repository…" : "Create starter docs"}
      </button>
    </form>
  );
}
