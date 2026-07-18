"use client";

import { useEffect, useMemo, useState } from "react";
import type { CSSProperties } from "react";

type SetupAssistantProps = {
  endpoint: string;
  mcpConnected: boolean;
  projectName: string;
  projectSlug: string;
  published: boolean;
};

type SourceMode = "openapi" | "routes" | "mixed";

function CopyButton({ label = "Copy", value }: { label?: string; value: string }) {
  const [copied, setCopied] = useState(false);

  return (
    <button
      className="copy-button"
      type="button"
      onClick={async () => {
        await navigator.clipboard.writeText(value);
        setCopied(true);
        window.setTimeout(() => setCopied(false), 1600);
      }}
    >
      {copied ? "Copied ✓" : label}
    </button>
  );
}

function CodeBlock({ children, value = children }: { children: string; value?: string }) {
  return (
    <div className="setup-code">
      <code>{children}</code>
      <CopyButton value={value} />
    </div>
  );
}

export function SetupAssistant({ endpoint, mcpConnected, projectName, projectSlug, published }: SetupAssistantProps) {
  const storageKey = `smolify:skill-installed:${projectSlug}`;
  const sourceKey = `smolify:source-mode:${projectSlug}`;
  const [skillInstalled, setSkillInstalled] = useState(false);
  const [sourceMode, setSourceMode] = useState<SourceMode>("mixed");

  useEffect(() => {
    const hydration = window.setTimeout(() => {
      setSkillInstalled(window.localStorage.getItem(storageKey) === "true");
      const storedSource = window.localStorage.getItem(sourceKey);
      if (storedSource === "openapi" || storedSource === "routes" || storedSource === "mixed") {
        setSourceMode(storedSource);
      }
    }, 0);
    return () => window.clearTimeout(hydration);
  }, [sourceKey, storageKey]);

  const installPrompt = "Install the smolify-api-docs skill from https://github.com/justrach/smolify/tree/main/skills/smolify-api-docs into this repository.";
  const sourceHint = sourceMode === "openapi"
    ? "Treat the OpenAPI contract as the primary source, then verify it against the implementation."
    : sourceMode === "routes"
      ? "Infer the API from the route handlers, schemas, tests, and examples in this repository."
      : "Reconcile the OpenAPI contract with route handlers, schemas, tests, and examples; call out disagreements.";
  const generationPrompt = `Use $smolify-api-docs to document this API for the Smolify project \"${projectSlug}\". ${sourceHint} Generate the bundle, show me the complete docs diff, and wait for my explicit approval before calling publish_docs.`;

  const completed = [true, mcpConnected, skillInstalled, published];
  const completedCount = completed.filter(Boolean).length;
  const activeStep = completed.findIndex((item) => !item);
  const active = activeStep === -1 ? 3 : activeStep;
  const progress = Math.round((completedCount / completed.length) * 100);

  const statusLabel = useMemo(() => {
    if (published) return "Your docs are live";
    if (!mcpConnected) return "Connect Codex next";
    if (!skillInstalled) return "Add the repository skill next";
    return "Generate and review your first docs";
  }, [mcpConnected, published, skillInstalled]);

  return (
    <section className="setup-assistant" id="setup" aria-labelledby="setup-title">
      <div className="setup-overview">
        <div>
          <p className="eyebrow">Setup co-pilot · about 4 minutes</p>
          <h2 id="setup-title">Take {projectName} from code to live docs.</h2>
          <p>{statusLabel}. Smolify verifies every milestone and keeps publishing behind an explicit review.</p>
        </div>
        <div className="progress-ring" style={{ "--progress": `${progress * 3.6}deg` } as CSSProperties}>
          <span>{progress}%</span>
        </div>
      </div>

      <ol className="setup-steps">
        <li className="setup-step complete">
          <div className="step-marker">✓</div>
          <div className="step-content">
            <div className="step-heading"><div><span>Project</span><h3>{projectName} is ready</h3></div><strong>Done</strong></div>
            <p className="step-summary">Hosted address: <code>{projectSlug}.smol.ly</code></p>
          </div>
        </li>

        <li className={`setup-step ${mcpConnected ? "complete" : active === 1 ? "active" : ""}`}>
          <div className="step-marker">{mcpConnected ? "✓" : "2"}</div>
          <div className="step-content">
            <div className="step-heading"><div><span>MCP connection</span><h3>{mcpConnected ? "Codex is authorized" : "Connect Codex with OAuth"}</h3></div><strong>{mcpConnected ? "Done" : "Next"}</strong></div>
            {!mcpConnected && (
              <div className="step-details">
                <p>Run these once on your device. The second command opens a browser so you can approve the exact permissions Codex requests.</p>
                <CodeBlock>{`codex mcp add smolify --url ${endpoint}/mcp`}</CodeBlock>
                <CodeBlock>codex mcp login smolify</CodeBlock>
                <div className="trust-note"><span>◎</span><p><strong>No API keys.</strong> OAuth tokens stay in Codex, never in your repository or chat. Publishing still asks for explicit approval. Revoke locally with <code>codex mcp remove smolify</code>.</p></div>
                <button className="secondary-button" type="button" onClick={() => window.location.reload()}>I authorized Codex · check again</button>
              </div>
            )}
          </div>
        </li>

        <li className={`setup-step ${skillInstalled ? "complete" : active === 2 ? "active" : ""}`}>
          <div className="step-marker">{skillInstalled ? "✓" : "3"}</div>
          <div className="step-content">
            <div className="step-heading"><div><span>Repository skill</span><h3>{skillInstalled ? "The Smolify skill is installed" : "Teach Codex the docs workflow"}</h3></div><strong>{skillInstalled ? "Done" : mcpConnected ? "Next" : "Waiting"}</strong></div>
            {!skillInstalled && (
              <div className="step-details">
                <p>Open Codex in your API repository and paste this instruction. Codex installs the versioned skill locally, where your team can review it.</p>
                <CodeBlock value={installPrompt}>Ask Codex to install the smolify-api-docs skill</CodeBlock>
                <details className="manual-install">
                  <summary>Prefer a terminal command?</summary>
                  <CodeBlock>npx degit justrach/smolify/skills/smolify-api-docs .codex/skills/smolify-api-docs</CodeBlock>
                </details>
                <button
                  className="secondary-button"
                  type="button"
                  onClick={() => {
                    window.localStorage.setItem(storageKey, "true");
                    setSkillInstalled(true);
                  }}
                >
                  I installed the skill
                </button>
              </div>
            )}
          </div>
        </li>

        <li className={`setup-step ${published ? "complete" : active === 3 ? "active" : ""}`}>
          <div className="step-marker">{published ? "✓" : "4"}</div>
          <div className="step-content">
            <div className="step-heading"><div><span>First publish</span><h3>{published ? "Your docs are live" : "Generate, review, then publish"}</h3></div><strong>{published ? "Live" : skillInstalled ? "Next" : "Waiting"}</strong></div>
            {!published && (
              <div className="step-details">
                <p>What should Codex treat as the source of truth?</p>
                <div className="choice-row" role="radiogroup" aria-label="API source type">
                  {([
                    ["openapi", "OpenAPI-first"],
                    ["routes", "Code-first"],
                    ["mixed", "Both / mixed"],
                  ] as const).map(([value, label]) => (
                    <button
                      aria-checked={sourceMode === value}
                      className="choice-chip"
                      data-active={sourceMode === value}
                      key={value}
                      onClick={() => {
                        setSourceMode(value);
                        window.localStorage.setItem(sourceKey, value);
                      }}
                      role="radio"
                      type="button"
                    >
                      {label}
                    </button>
                  ))}
                </div>
                <p>Paste this into Codex. It must show you the docs diff and wait before the MCP can change the live deployment.</p>
                <CodeBlock value={generationPrompt}>Copy the tailored generation prompt</CodeBlock>
              </div>
            )}
            {published && <p className="step-summary">Updates stay immutable and searchable; publishing a new reviewed bundle atomically replaces the live version.</p>}
          </div>
        </li>
      </ol>
    </section>
  );
}
