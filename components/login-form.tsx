"use client";

import { useEffect, useState } from "react";
import { authClient } from "@/lib/auth-client";
import { Brand } from "@/components/brand";

function destinationAfterLogin(search: string) {
  const query = new URLSearchParams(search);
  query.delete("social");
  if (query.has("client_id")) return `/api/auth/oauth2/authorize?${query}`;
  const returnTo = query.get("returnTo");
  return returnTo?.startsWith("/") && !returnTo.startsWith("//") ? returnTo : "/dashboard";
}

export function LoginForm({ githubEnabled }: { githubEnabled: boolean }) {
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  useEffect(() => {
    const query = new URLSearchParams(window.location.search);
    if (query.get("social") === "1") window.location.replace(destinationAfterLogin(window.location.search));
  }, []);

  return (
    <main className="auth-shell">
      <section className="auth-card">
        <Brand />
        <div><p className="eyebrow">{mode === "signin" ? "Welcome back" : "Start publishing"}</p><h1>{mode === "signin" ? "Sign in to Smolify" : "Create your workspace"}</h1><p>Public docs stay open. Sign in establishes identity for imports, private repositories, reviews, and MCP publishing.</p></div>
        {githubEnabled && (
          <button
            className="github-auth-button"
            disabled={pending}
            onClick={async () => {
              setPending(true);
              setError(null);
              const query = new URLSearchParams(window.location.search);
              query.set("social", "1");
              const result = await authClient.signIn.social({
                provider: "github",
                callbackURL: `/login?${query}`,
              });
              if (result?.error) {
                setPending(false);
                setError(result.error.message ?? "GitHub authentication failed");
              }
            }}
            type="button"
          >
            Continue with GitHub
          </button>
        )}
        {githubEnabled && <div className="auth-divider"><span>or use email</span></div>}
        <form
          onSubmit={async (event) => {
            event.preventDefault();
            setPending(true);
            setError(null);
            const result = mode === "signin"
              ? await authClient.signIn.email({ email, password })
              : await authClient.signUp.email({ name, email, password });
            setPending(false);
            if (result.error) setError(result.error.message ?? "Authentication failed");
            else window.location.assign(destinationAfterLogin(window.location.search));
          }}
        >
          {mode === "signup" && <label>Name<input required autoComplete="name" value={name} onChange={(event) => setName(event.target.value)} /></label>}
          <label>Email<input required type="email" autoComplete="email" value={email} onChange={(event) => setEmail(event.target.value)} /></label>
          <label>Password<input required minLength={8} type="password" autoComplete={mode === "signin" ? "current-password" : "new-password"} value={password} onChange={(event) => setPassword(event.target.value)} /></label>
          {error && <p className="form-error">{error}</p>}
          <button className="button" disabled={pending}>{pending ? "Working…" : mode === "signin" ? "Sign in" : "Create account"}</button>
        </form>
        <button className="mode-switch" onClick={() => setMode(mode === "signin" ? "signup" : "signin")}>{mode === "signin" ? "New to Smolify? Create an account" : "Already have an account? Sign in"}</button>
      </section>
    </main>
  );
}
