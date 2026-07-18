"use client";

import { useState } from "react";

export function CreateProjectForm() {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  if (!open) return <button className="button" onClick={() => setOpen(true)}>New project</button>;

  return (
    <form
      className="create-project-form"
      onSubmit={async (event) => {
        event.preventDefault();
        setPending(true);
        setError(null);
        const response = await fetch("/api/v1/projects", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ name, slug }),
        });
        const payload = (await response.json()) as { error?: string; slug?: string };
        if (!response.ok) {
          setPending(false);
          setError(payload.error ?? "Unable to create project");
          return;
        }
        window.location.assign(`/dashboard?project=${encodeURIComponent(payload.slug ?? slug)}#setup`);
      }}
    >
      <input
        required
        aria-label="Project name"
        placeholder="Project name"
        value={name}
        onChange={(event) => {
          setName(event.target.value);
          if (!slug) setSlug(event.target.value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, ""));
        }}
      />
      <input required aria-label="Project slug" placeholder="project-slug" value={slug} onChange={(event) => setSlug(event.target.value)} />
      {error && <span className="form-error">{error}</span>}
      <button type="button" className="ghost-button" onClick={() => setOpen(false)}>Cancel</button>
      <button className="button" disabled={pending}>{pending ? "Creating…" : "Create"}</button>
    </form>
  );
}
