import { ImageResponse } from "next/og";
import { SmolifyOpenGraphCard } from "@/lib/seo/opengraph";

export const alt = "Smolify — Tiny setup. Serious docs.";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function OpenGraphImage() {
  return new ImageResponse(
    <SmolifyOpenGraphCard
      badge="Hosted docs · BM25 search · MCP"
      description="Source-grounded repository documentation that humans and coding agents can search, review, and improve."
      eyebrow="Tiny setup. Serious docs."
      project="smol.ly"
      title="Docs your agent can actually understand."
    />,
    size,
  );
}
