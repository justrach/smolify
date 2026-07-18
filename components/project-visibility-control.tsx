"use client";

import { useState } from "react";

export function ProjectVisibilityControl({ project, visibility }: { project: string; visibility: "public" | "private" }) {
  const [pending, setPending] = useState(false);
  const next = visibility === "public" ? "private" : "public";
  return (
    <button
      className="domain-button"
      disabled={pending}
      onClick={async () => {
        setPending(true);
        const response = await fetch(`/api/v1/projects/${project}`, {
          method: "PATCH",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ visibility: next }),
        });
        if (response.ok) window.location.reload();
        else setPending(false);
      }}
      type="button"
    >
      {pending ? "Updating…" : `Make ${next}`}
    </button>
  );
}
