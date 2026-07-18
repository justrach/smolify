"use client";

import { useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";
import { Brand } from "@/components/brand";

function ConsentForm() {
  const searchParams = useSearchParams();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const clientId = searchParams.get("client_id") ?? "an MCP client";
  const scopes = (searchParams.get("scope") ?? "").split(/\s+/).filter(Boolean);

  async function decide(accept: boolean) {
    setPending(true);
    setError(null);
    const response = await fetch("/api/auth/oauth2/consent", {
      method: "POST",
      credentials: "include",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ accept, oauth_query: window.location.search.slice(1) }),
    });
    const payload = (await response.json().catch(() => null)) as
      | { url?: string; redirect_uri?: string; message?: string }
      | null;
    const destination = payload?.url ?? payload?.redirect_uri;
    if (response.ok && destination) {
      window.location.assign(destination);
      return;
    }
    setPending(false);
    setError(payload?.message ?? "Unable to complete authorization");
  }

  return (
    <main className="auth-shell">
      <section className="auth-card consent-card">
        <Brand />
        <div>
          <p className="eyebrow">Authorize Codex</p>
          <h1>Allow access to Smolify?</h1>
          <p><code>{clientId}</code> is requesting permission to work with your documentation.</p>
        </div>
        <ul className="scope-list">
          {scopes.map((scope) => <li key={scope}><span>✓</span><code>{scope}</code></li>)}
        </ul>
        <p className="consent-note">OAuth only: no API keys are pasted into chat or committed to git. Publishing still requires an explicit tool approval, and you can revoke access later.</p>
        {error && <p className="form-error">{error}</p>}
        <div className="consent-actions">
          <button className="mode-switch" disabled={pending} onClick={() => decide(false)}>Deny</button>
          <button className="button" disabled={pending} onClick={() => decide(true)}>{pending ? "Authorizing…" : "Allow"}</button>
        </div>
      </section>
    </main>
  );
}

export default function ConsentPage() {
  return (
    <Suspense fallback={<main className="auth-shell"><section className="auth-card">Loading authorization…</section></main>}>
      <ConsentForm />
    </Suspense>
  );
}
