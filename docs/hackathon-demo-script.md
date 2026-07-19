# OpenAI Build Week demo script

Target length: **2:35–2:45**. The submission limit is three minutes, so keep at
least fifteen seconds of margin for page loads and natural pauses.

## The story in one sentence

> Smolify lets Codex read an API where it is most accurate—inside the local
> repository—then turns its reviewed Markdown into hosted documentation that
> humans and agents can search through the same MCP.

The Developer Tools track is the clearest fit. The demo should emphasize four
things: GPT-5.6 and Codex did real repository analysis, the user remains in
control of publishing, the result is immediately useful, and another developer
can try it without rebuilding Smolify.

## Word-for-word recording script

### 0:00–0:18 — Hook

**Show:** Start on <https://app.smol.ly>. Keep the terminal and Codex ready in
the background.

**Say:**

> API documentation usually goes stale because it is written somewhere away
> from the code. This is Smolify: an open-source, Codex-native documentation
> platform. GPT-5.6 reads the real implementation through Codex, I review the
> result in git, and Smolify hosts it for both people and coding agents.

### 0:18–0:38 — Install it for an agent

**Show:** Switch to the README installation section, then a terminal where the
install has already completed. Run only the quick status command on camera.

```bash
bunx smoly status --agent codex
```

Keep this fresh-install command visible in the README:

```bash
bunx smoly install --agent codex
```

**Say:**

> A developer installs the Smolify MCP and skill with one command. Public docs
> work immediately. OAuth is only needed for private projects or publishing,
> and the source repository stays on the developer's own device.

### 0:38–1:13 — Let Codex document the implementation

**Show:** Open a prepared Codex task in a small API repository. Paste or reveal
this prompt, then jump to the already-completed result rather than waiting for
generation:

```text
Use $smolify-api-docs to document this API for the Smolify project "pawprint".
Reconcile the contract with routes, schemas, authentication, tests, and
examples. Generate the bundle, show me the complete docs diff, and stop before
publishing.
```

Open the generated `.smolify/smolify.bundle.json` diff. Briefly point at a page,
an endpoint example, and its `sourceFiles` evidence.

**Say:**

> Here GPT-5.6 in Codex is doing the important work. It reconciles routes,
> schemas, middleware, tests, and examples instead of paraphrasing a README. It
> creates safe Markdown, records the source files behind each page, validates
> the complete bundle, and stops. Nothing is live yet: I can inspect this exact
> diff and correct it like any other code change.

### 1:13–1:32 — Review, then publish through the MCP

**Show:** In the prepared Codex task, show the explicit approval message and
the successful `publish_docs` result. Do not expose OAuth tokens or environment
variables.

```text
The diff looks good. Publish this reviewed bundle to pawprint.
```

**Say:**

> Only after approval does Codex call Smolify's authenticated MCP. The OAuth
> grant is project-scoped, and publishing is deliberately marked as a mutating
> action. Smolify validates the entire payload again before activating it.

### 1:32–1:58 — Show the hosted result

**Show:** Open <https://app.smol.ly/pawprint/introduction>. Navigate to one API
reference page and run a search that uses an endpoint or error code.

**Say:**

> Seconds later, the same reviewed bundle is a fast hosted documentation site.
> It has navigation, code samples, SEO metadata, deploy history, and BM25 full-
> text search. Teams start on an app.smol.ly address and can attach their own
> domain without changing the application deployment.

### 1:58–2:20 — The same docs are an agent tool

**Show:** Return to Codex and reveal an already-completed Smolify MCP search,
followed by the retrieved page. If live tool latency is consistently low, this
can be run live; otherwise use the prepared result.

```text
Search the public pawprint docs for the authentication requirements and the
errors returned when creating a user. Cite the relevant pages.
```

**Say:**

> The hosted site is not the end product. An agent connects to the same remote
> MCP, searches before reading, and retrieves only the relevant pages. That
> means the documentation is useful inside the coding workflow, without
> stuffing an entire repository into every prompt.

### 2:20–2:38 — Scale and trust

**Show:** Open <https://app.smol.ly/explore/openclaw>. Point to the repository
size, official-source badge if present, and community-review state. Do not claim
that “official source” is a security audit.

**Say:**

> This also works on large repositories. Smolify separates source provenance
> from documentation quality: verified company-owned GitHub accounts can earn
> an official-source badge, while ten independent authenticated reviews are
> required for community-reviewed status. Agent improvements remain proposals;
> only the project owner can activate them.

### 2:38–2:52 — Close

**Show:** Return to the landing page, with the GitHub repository link and live
demo visible.

**Say:**

> Under the hood, D1 stores tenant-scoped metadata and the BM25 index, while R2
> stores immutable bundles and large assets. Smolify is open source, the live
> demo needs no login, and the repository includes the installer and sample
> project. Tiny setup, serious docs—that is Smolify.

Stop here. Do not fill the remaining seconds.

## What to prepare before recording

### Browser tabs, in this order

1. `https://app.smol.ly`
2. The README installation section on GitHub
3. `https://app.smol.ly/pawprint/introduction`
4. One useful Pawprint API reference page
5. `https://app.smol.ly/explore/openclaw`
6. The signed-in dashboard or custom-domain screen, only if it is stable

Load every tab once before recording. Use a clean browser profile or hide the
bookmarks bar and personal extensions.

### Codex and terminal

- Use a small API fixture whose generated diff fits on screen.
- Complete the slow generation once before recording and leave the task at the
  final summary.
- Keep one task showing the generated bundle diff and another showing the MCP
  search result, or use clear checkpoints in one task.
- Increase terminal and editor text until it remains readable in a 1080p video.
- Run `bunx smoly install --agent codex` before recording. On camera, run only
  `bunx smoly status --agent codex`.
- If the `smoly` package is not publicly available by recording time, show the
  direct Codex setup instead and do not pretend the package install works:

  ```bash
  codex mcp add smolify --url https://app.smol.ly/mcp
  codex mcp login smolify
  ```

### Recording hygiene

- Record at 1440p or 1080p and keep the pointer movement deliberate.
- Turn off notifications, password-manager popovers, and autocomplete history.
- Never open `.env`, authentication callbacks, cookies, or token output.
- Use cuts during page loads, but do not cut in a way that implies an action
  succeeded when it did not.
- Speak at roughly 145 words per minute and pause after the hook and final line.
- Record the narration and screen together if that feels natural; clean audio is
  more valuable than a perfectly continuous take.

## Recovery lines for an imperfect take

If generation is slow:

> I have pre-generated this bundle so you do not have to watch the model wait;
> this is the exact diff Codex produced from the repository.

If OAuth has expired:

> Public search needs no account. Publishing uses a normal OAuth grant, so I am
> switching to the deployment I authorized before this recording.

If the live publish is slow:

> Publishing validates and indexes the complete deployment atomically. I will
> open the deployment I prepared with this same bundle.

If a badge is missing on the large-repository page, skip the badge claim and
say:

> Smolify shows source provenance separately from the community review state,
> so users know exactly what has and has not been verified.

## Submission checklist outside the video

- Keep the final YouTube video public and under three minutes.
- Put the live demo URL and public GitHub repository near the top of the README.
- Include installation instructions, supported agents/platforms, and the
  Pawprint test project so judges do not need to rebuild the app.
- Explain in the submission text where GPT-5.6 and Codex accelerated the work:
  architecture research, repository-grounded documentation generation, bundle
  review, and implementation/testing.
- Include the required `/feedback` Codex Session ID from the task that built the
  core functionality.
- Verify every public link in a signed-out browser immediately before submitting.
