# Smolify brand kit

Smolify makes excellent API documentation feel disproportionately easy. The
brand should feel compact, warm, technically credible, and a little cheeky —
never toy-like or unserious.

## Core idea

- **Name:** Smolify
- **Pronunciation:** “smol-ify”
- **Primary domain:** `smol.ly`
- **Descriptor:** Codex-native API documentation
- **Tagline:** Tiny setup. Serious docs.
- **Product promise:** Your code knows the truth. Codex turns it into docs.

The short domain is the brand. Use `smol.ly` for the product origin and
`{project}.smol.ly` for hosted documentation. Custom domains remain available
for teams that want their documentation fully under their own brand.

## Voice

Write like a calm senior engineer helping another engineer ship:

- concise, specific, and reassuring;
- playful in headlines, literal in setup and security copy;
- prefer “connect,” “review,” and “publish” over vague AI language;
- explain what a permission does at the moment it is requested;
- never imply that generated documentation can skip review.

## Visual system

| Token | Value | Use |
| --- | --- | --- |
| Ink | `#151515` | Text, buttons, dark surfaces |
| Milk | `#FBFAF5` | Product background |
| Paper | `#FFFFFF` | Cards and documentation pages |
| Smol lime | `#C7FF5A` | Primary brand mark and active states |
| Periwinkle | `#7467F0` | Links, focus, agent actions |
| Coral | `#FF6B57` | Human review and caution moments |
| Mint wash | `#E8FFD1` | Success backgrounds |
| Line | `#E4E2DA` | Borders and dividers |

Use the system stack headed by Geist or Inter for product UI and SFMono/Geist
Mono for code. Headlines are tight and bold; body copy is relaxed and never
smaller than 14px in primary flows.

The lime mark contains a compact lowercase-style `s` and a periwinkle terminal
dot. Keep clear space equal to one quarter of the mark width. Never recolor the
mark with gradients or place it on another bright color.

Assets live in [`public/brand`](../public/brand):

- `smolify-mark.svg` — square icon;
- `smolify-lockup.svg` — horizontal lockup;
- `/favicon.svg` — browser icon.

## Product language

- Primary CTA: **Start a docs project**
- Setup CTA: **Continue setup**
- Publish CTA: **Review and publish**
- Completion: **Your docs are live**
- Security line: **OAuth only. No API keys pasted into chat or committed to git.**

## Onboarding pattern

The first-run experience is a per-project setup co-pilot, not a generic command
card. It shows four milestones — project, MCP authorization, repository skill,
and first publish — with one next action, a time estimate, inline permission
context, and an explicit review gate.

This direction came from a Lazyweb critique of the original dashboard, which
identified missing progress, trust context, effort expectations, and
project-specific next actions. The generated research artifact is available in
the [Smolify onboarding report](https://www.lazyweb.com/report/lazyweb/9fba66b2-71eb-4076-a939-ee0b6a129c10/?source=create).
