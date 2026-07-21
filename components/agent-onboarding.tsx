"use client";

import { useEffect, useRef, useState } from "react";
import type { KeyboardEvent } from "react";

const MCP_ENDPOINT = "https://app.smol.ly/mcp";
const CODEX_COMMAND = `codex mcp add smolify --url ${MCP_ENDPOINT}`;
const AGENT_PROMPT = `Onboard Smolify for this workspace.

1. If you are running inside Codex, run:
   ${CODEX_COMMAND}
2. Otherwise, use your client's MCP setup mechanism to add an HTTP server named "smolify" at:
   ${MCP_ENDPOINT}
3. Verify the connection by listing the available Smolify tools and searching its public documentation.
4. Tell me when setup is complete and show one search result.

Public documentation needs no account. Only start OAuth if I later ask you to access private docs, contribute, or publish.`;

type CopyState = "idle" | "copied" | "failed";

export function AgentOnboarding() {
  const dialogRef = useRef<HTMLDivElement>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const [open, setOpen] = useState(false);
  const [copyState, setCopyState] = useState<CopyState>("idle");

  useEffect(() => {
    if (!open) return;
    const previousOverflow = document.body.style.overflow;
    const trigger = triggerRef.current;
    document.body.style.overflow = "hidden";
    closeButtonRef.current?.focus();
    return () => {
      document.body.style.overflow = previousOverflow;
      trigger?.focus();
    };
  }, [open]);

  function closeModal() {
    setCopyState("idle");
    setOpen(false);
  }

  function keepFocusInside(event: KeyboardEvent<HTMLDivElement>) {
    if (event.key === "Escape") {
      event.preventDefault();
      closeModal();
      return;
    }
    if (event.key !== "Tab") return;

    const focusable = dialogRef.current?.querySelectorAll<HTMLElement>(
      "button, a[href], input, select, textarea, [tabindex]:not([tabindex='-1'])",
    );
    if (!focusable?.length) return;
    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  }

  async function copyPrompt() {
    try {
      await navigator.clipboard.writeText(AGENT_PROMPT);
      setCopyState("copied");
      window.setTimeout(() => setCopyState("idle"), 1800);
    } catch {
      setCopyState("failed");
    }
  }

  return (
    <>
      <button
        className="button agent-onboarding-trigger"
        ref={triggerRef}
        type="button"
        onClick={() => setOpen(true)}
      >
        Onboard your agent <span aria-hidden="true">→</span>
      </button>
      {open && (
        <div
          className="agent-onboarding-backdrop"
          onMouseDown={(event) => {
            if (event.currentTarget === event.target) closeModal();
          }}
        >
          <div
            aria-describedby="agent-onboarding-description"
            aria-labelledby="agent-onboarding-title"
            aria-modal="true"
            className="agent-onboarding-modal"
            onKeyDown={keepFocusInside}
            ref={dialogRef}
            role="dialog"
          >
            <div className="agent-onboarding-card">
              <button
                aria-label="Close agent onboarding"
                className="agent-onboarding-close"
                ref={closeButtonRef}
                type="button"
                onClick={closeModal}
              >
                ×
              </button>
              <p className="eyebrow">Agent setup · about 30 seconds</p>
              <h2 id="agent-onboarding-title">Give your agent the setup job.</h2>
              <p id="agent-onboarding-description">
                Paste this instruction into Codex or another MCP-capable agent. It will install Smolify, verify the connection, and report back.
              </p>
              <div className="agent-onboarding-prompt">
                <pre><code>{AGENT_PROMPT}</code></pre>
                <button className="copy-button" type="button" onClick={copyPrompt} aria-live="polite">
                  {copyState === "copied" ? "Copied ✓" : copyState === "failed" ? "Select and copy" : "Copy agent prompt"}
                </button>
              </div>
              <div className="agent-onboarding-meta">
                <span><strong>Endpoint</strong><code>{MCP_ENDPOINT}</code></span>
                <span><strong>Public docs</strong>No login required</span>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
