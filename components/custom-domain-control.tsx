"use client";

import { useState } from "react";

type Domain = {
  id: string;
  hostname: string;
  status: "pending" | "verifying" | "active" | "failed";
  cnameTarget: string | null;
  errors: string[];
  validation: {
    ownership?: { name?: string; type?: string; value?: string };
    certificate?: Array<{ txt_name?: string; txt_value?: string }>;
  };
};

type Props = {
  project: string;
  initialDomain: Pick<Domain, "id" | "hostname" | "status"> | null;
};

export function CustomDomainControl({ project, initialDomain }: Props) {
  const [open, setOpen] = useState(false);
  const [hostname, setHostname] = useState("");
  const [domain, setDomain] = useState<Domain | null>(initialDomain as Domain | null);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function request(method: "POST" | "PATCH") {
    setPending(true);
    setError(null);
    const response = await fetch(`/api/v1/projects/${encodeURIComponent(project)}/domains`, {
      method,
      headers: { "content-type": "application/json" },
      body: JSON.stringify(method === "POST" ? { hostname } : { id: domain?.id }),
    });
    const payload = (await response.json().catch(() => null)) as (Domain & { error?: string }) | null;
    setPending(false);
    if (!response.ok || !payload) {
      setError(payload?.error ?? "Unable to update custom domain");
      return;
    }
    setDomain(payload);
    setOpen(true);
  }

  if (!open) {
    return (
      <button className="domain-button" onClick={() => setOpen(true)}>
        {domain ? `${domain.hostname} · ${domain.status}` : "Custom domain"}
      </button>
    );
  }

  return (
    <div className="domain-control">
      {domain ? (
        <>
          <strong>{domain.hostname}</strong><span className={`domain-status ${domain.status}`}>{domain.status}</span>
          {domain.cnameTarget && <p>CNAME <code>{domain.hostname}</code> to <code>{domain.cnameTarget}</code>.</p>}
          {domain.validation?.ownership?.name && <p>Add {domain.validation.ownership.type?.toUpperCase() ?? "TXT"} <code>{domain.validation.ownership.name}</code> with value <code>{domain.validation.ownership.value}</code>.</p>}
          {domain.validation?.certificate?.map((record) => record.txt_name && (
            <p key={record.txt_name}>Add TXT <code>{record.txt_name}</code> with value <code>{record.txt_value}</code>.</p>
          ))}
          {domain.errors?.map((message) => <p className="form-error" key={message}>{message}</p>)}
          {domain.status !== "active" && <button className="ghost-button" disabled={pending} onClick={() => request("PATCH")}>{pending ? "Checking…" : "Check status"}</button>}
        </>
      ) : (
        <form onSubmit={(event) => { event.preventDefault(); void request("POST"); }}>
          <input required aria-label="Custom hostname" placeholder="docs.example.com" value={hostname} onChange={(event) => setHostname(event.target.value)} />
          <button className="button" disabled={pending}>{pending ? "Connecting…" : "Connect"}</button>
        </form>
      )}
      {error && <p className="form-error">{error}</p>}
      <button className="domain-close" onClick={() => setOpen(false)}>Close</button>
    </div>
  );
}
