"use client";

import { useState } from "react";
import { authClient } from "@/lib/auth-client";
import { Brand } from "@/components/brand";

export default function LoginPage() {
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  return (
    <main className="auth-shell">
      <section className="auth-card">
        <Brand />
        <div><p className="eyebrow">{mode === "signin" ? "Welcome back" : "Start publishing"}</p><h1>{mode === "signin" ? "Sign in to Smolify" : "Create your workspace"}</h1><p>Your dashboard credentials stay on the app origin and are never sent to hosted documentation domains.</p></div>
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
            else {
              const oauthQuery = window.location.search.slice(1);
              const returnTo = new URLSearchParams(oauthQuery).get("returnTo");
              window.location.assign(
                new URLSearchParams(oauthQuery).has("client_id")
                  ? `/api/auth/oauth2/authorize?${oauthQuery}`
                  : returnTo?.startsWith("/") && !returnTo.startsWith("//")
                    ? returnTo
                    : "/dashboard",
              );
            }
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
