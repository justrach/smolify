import type { Metadata } from "next";
import "./styles.css";

export const metadata: Metadata = {
  title: { default: "Smolify", template: "%s · Smolify" },
  description: "Source-grounded repository documentation that humans and coding agents can search, review, and publish through one hosted MCP.",
  metadataBase: new URL("https://app.smol.ly"),
  applicationName: "Smolify",
  creator: "Smolify",
  keywords: ["repository documentation", "API documentation", "MCP", "Codex", "developer tools", "BM25 search"],
  alternates: { canonical: "/" },
  icons: { icon: "/favicon.svg" },
  openGraph: {
    title: "Smolify — Tiny setup. Serious docs.",
    description: "Codex-native API documentation generated from your repository, reviewed in git, and hosted beautifully.",
    url: "https://app.smol.ly",
    siteName: "Smolify",
    type: "website",
    images: [{ url: "/opengraph-image", width: 1200, height: 630, alt: "Smolify — Tiny setup. Serious docs." }],
  },
  twitter: {
    card: "summary_large_image",
    title: "Smolify — Tiny setup. Serious docs.",
    description: "Source-grounded repository documentation for humans and coding agents.",
    images: ["/opengraph-image"],
  },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
